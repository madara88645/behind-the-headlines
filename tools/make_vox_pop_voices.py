#!/usr/bin/env python3
"""Generate the pre-recorded NPC voice clips for Vox Pop as one voices.js file.

What it does
------------
Reads a lines file - a JSON list of {"speaker", "text", "say"?} objects, where
`text` is the exact line shown on screen (and the lookup key) and `say`
optionally overrides what the speech engine reads - and for every line:

1. synthesises it offline in the voice VOICES below gives the speaker
   (Kokoro-82M v1.0, British English voices);
2. trims leading and trailing silence, keeping about 40 ms of room, and drops
   stray clicks the model sometimes leaves after the last word;
3. loudness-normalises to about -16 LUFS integrated with a -1.5 dBTP true-peak
   ceiling: EBU R128 measurement by ffmpeg's loudnorm filter, one constant
   gain per clip, and a look-ahead limiter for the few peaks that would cross
   the ceiling (see normalise() for why not dynamic loudnorm);
4. encodes mono 24 kHz MP3 at 48 kbit/s CBR, which the Web Audio API decodes
   in Chrome and Safari;
5. decodes that MP3 again and checks it: not silent, not clipped, at most 6 s
   long, and - unless --no-check - a faster-whisper transcript that matches
   the on-screen text, ignoring case and punctuation. A failing clip is
   rendered again with small variations (spelling/pause hints, speed, style)
   until one passes;
6. writes voices.js, a plain script for a classic <script src> tag:
       window.VP_VOICES = { format, credit, speakers, clips }
   where clips maps "speaker|text" to a base64 MP3.

Requirements (tested with Python 3.11, kokoro-onnx 0.6.1, faster-whisper
1.2.1, onnxruntime 1.30, ffmpeg 7.0; piper-tts 1.8.0 for the optional Piper voices)
------------
    pip install kokoro-onnx soundfile numpy
    pip install faster-whisper            # only for the transcript check
    pip install piper-tts                 # only to try a Piper voice with --voice
    ffmpeg built with libmp3lame, on PATH or given with --ffmpeg

Models - downloaded into --cache on first use, sha256-checked:
    https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
    https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
    https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx  (--int8)
    Whisper "small.en" for the check: faster-whisper fetches
    https://huggingface.co/Systran/faster-whisper-small.en into <cache>/whisper
  only when a Piper voice is asked for:
    https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/vctk/medium/en_GB-vctk-medium.onnx
    https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/vctk/medium/en_GB-vctk-medium.onnx.json

Licences
--------
Kokoro-82M weights and voice packs: Apache-2.0, by hexgrad
(https://huggingface.co/hexgrad/Kokoro-82M); the ONNX export and the
kokoro-onnx package: MIT (https://github.com/thewh1teagle/kokoro-onnx).
If a Piper voice is used: en_GB-vctk-medium is MIT
(https://huggingface.co/rhasspy/piper-voices), trained on the CSTR VCTK Corpus,
CC BY 4.0, University of Edinburgh (https://datashare.ed.ac.uk/handle/10283/3443),
and the credit line in voices.js then says so. espeak-ng, phonemizer and
piper-tts (GPL-3.0) and Whisper are build-time tools only; nothing of theirs
ends up in voices.js.

Usage
-----
    python tools/make_vox_pop_voices.py --lines lines.json --out games/vox-pop/voices.js
    python tools/make_vox_pop_voices.py --lines lines.json --out voices.js \\
        --clips out/clips --report out/report.json --cache ~/.cache/vox-pop-voices
    --no-check                  skip the Whisper round-trip (faster, no ASR check)
    --voice m1=bm_daniel        try another voice for a speaker; also e.g.
    --voice m3=bm_lewis:0.7+bm_daniel:0.3   (a Kokoro blend) or f2=piper:p283@1.1
                                (a Piper VCTK speaker; "@" sets the speed)

Exit status is 1 when any clip still fails its checks (voices.js is written
anyway, so it can be inspected), 0 otherwise. Kokoro is deterministic, so a
re-run gives the same clips; Piper voices are not.
"""
import argparse
import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request

import numpy as np

SR = 24000                 # output sample rate (Kokoro's native rate)
TARGET_LUFS = -16.0
TRUE_PEAK_MAX = -1.5       # dBTP, of the final MP3
MP3_HEADROOM = 0.3         # dB kept free before encoding: MP3 coding adds a little peak
MAX_LIMITING_DB = 8.0      # deepest peak limiting allowed before lowering the gain instead
EDGE_PAD = 0.040           # seconds of silence kept at each end
MAX_SECONDS = 6.0
BITRATE_KBPS = 48

KOKORO_URL = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/'
PIPER_URL = 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/vctk/medium/'
MODEL_FILES = {   # name: (base url, sha256)
    'kokoro-v1.0.onnx': (KOKORO_URL, '7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5'),
    'kokoro-v1.0.int8.onnx': (KOKORO_URL, '6e742170d309016e5891a994e1ce1559c702a2ccd0075e67ef7157974f6406cb'),
    'voices-v1.0.bin': (KOKORO_URL, 'bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d'),
    'en_GB-vctk-medium.onnx': (PIPER_URL, '4e9fc85ab9009385319fc6bae7f55577f8a2d7ee77fd9159a5500eb6531f41e6'),
    'en_GB-vctk-medium.onnx.json': (PIPER_URL, '7f85e6391ed0f7f46e4abd19345929a16be931a0c9945086f96692dce2087fa8'),
}

CREDITS = {
    'kokoro': 'Kokoro-82M by hexgrad (Apache-2.0)',
    'piper': 'Piper en_GB-vctk-medium (MIT), trained on the CSTR VCTK Corpus (CC BY 4.0, University of Edinburgh)',
}


class Voice:
    """A voice for one speaker.

    engine 'kokoro': `mix` is a voice pack name or a list of (pack, weight) to blend.
    engine 'piper':  `mix` is a VCTK speaker id of en_GB-vctk-medium, e.g. 'p288'.
    """

    def __init__(self, mix, engine='kokoro', speed=1.0, nudge=None, asr=True,
                 min_s=0.0, max_s=MAX_SECONDS, fx=None, note=''):
        self.engine = engine
        self.mix = [(mix, 1.0)] if isinstance(mix, str) else list(mix)
        self.speed = speed        # 1.0 = the engine's natural pace
        self.nudge = nudge        # Kokoro pack blended in at 10% as a last-resort retry
        self.asr = asr            # run the transcript check for this speaker?
        self.min_s, self.max_s = min_s, max_s
        self.fx = fx              # optional ffmpeg filter chain applied after synthesis
        self.note = note          # shown after the voice id

    def label(self):
        if self.engine == 'piper':
            name = f'piper en_GB-vctk-medium {self.mix[0][0]}'
        elif len(self.mix) == 1:
            name = self.mix[0][0]
        else:
            name = ' + '.join(f'{v} {round(w * 100)}%' for v, w in self.mix)
        return f'{name} ({self.note})' if self.note else name


# Speaker -> voice. Chosen without listening, from an ASR round-trip
# (faster-whisper word accuracy and confidence), UTMOS naturalness scores and
# speaker-embedding distances; see the report that came with voices.js.
# Irish speakers of Piper's en_GB-vctk-medium were tried too: the best one was
# about as clear, but an accent classifier heard it as English (the model reads
# RP phonemes), so it brought no Irish accent for a second engine's costs.
VOICES = {
    # Maura, the radio editor: the most mature, warm British female voice, a touch slower.
    'editor': Voice('bf_emma', speed=0.95, nudge='bf_isabella'),
    # Residents: three clearly different women and three clearly different men.
    'f1': Voice('bf_isabella', nudge='bf_emma'),
    'f2': Voice('bf_alice', nudge='bf_emma'),
    'f3': Voice('bf_lily', nudge='bf_emma'),
    'm1': Voice('bm_george', nudge='bm_daniel'),
    'm2': Voice('bm_fable', nudge='bm_george'),
    # bm_lewis alone is the deepest but least natural voice; 30% bm_daniel fixes
    # that and it stays far from m1 and m2.
    'm3': Voice([('bm_lewis', 0.7), ('bm_daniel', 0.3)], nudge='bm_george'),
    # The sheep: a short bleat, pitched up with a wobble. No transcript check.
    'sheep': Voice('bf_alice', asr=False, min_s=0.3, max_s=1.5, note='pitched up, with a bleat wobble',
                   fx='rubberband=pitch=1.35,vibrato=f=7:d=0.35,tremolo=f=7:d=0.45'),
}

# Hints tried on the spoken text (never the key) when a line fails the check.
HINTS = [
    # A contraction swallowed by a next word starting with the same sound
    # ("It's stayed", "I'd disagree" are heard as "It stayed", "I disagree"):
    # a short hesitation keeps it audible.
    (r"\b(\w+'([sd])) (?=\2)", [r'\1... ', r'\1, ']),
    (r'\bAh no\b', ['Ah, no', 'Ah... no', 'Aah no']),   # else some voices are heard as "Oh no"
    (r'\byeah\b', ['yeh']),
]

# Words the check treats as the same: other spellings, and sound-alikes an ASR
# model cannot tell apart ("hall" and "haul" are the same sound in British English).
SAME_WORD = {'center': 'centre', 'centers': 'centres', 'ok': 'okay', 'aah': 'ah', 'ahh': 'ah',
             'yeh': 'yeah', 'yea': 'yeah', 'haul': 'hall'}


# ---------------------------------------------------------------- small helpers
def log(msg):
    print(msg, flush=True)


def slug(text, n=60):
    s = re.sub(r"['\u2019]", '', text.lower())
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s[:n].rstrip('-') or 'line'


def fetch_model(cache, name):
    base, digest = MODEL_FILES[name]
    path = os.path.join(cache, name)
    if not os.path.exists(path):
        os.makedirs(cache, exist_ok=True)
        log(f'downloading {base + name}')
        with urllib.request.urlopen(base + name) as r, open(path + '.part', 'wb') as f:
            shutil.copyfileobj(r, f, 1 << 20)
        os.replace(path + '.part', path)
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    if h.hexdigest() != digest:
        sys.exit(f'{path}: sha256 mismatch - delete it and run again')
    return path


def ffmpeg_run(ffmpeg, args, data=None):
    p = subprocess.run([ffmpeg, '-hide_banner', '-nostdin', *args], input=data, capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(f'ffmpeg {" ".join(args)} failed:\n{p.stderr.decode(errors="replace")[-2000:]}')
    return p


def pcm(sr=SR):
    return ['-f', 'f32le', '-ar', str(sr), '-ac', '1']


# ---------------------------------------------------------------- transcript comparison
_ONES = ('zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen '
         'fifteen sixteen seventeen eighteen nineteen').split()
_TENS = 'x x twenty thirty forty fifty sixty seventy eighty ninety'.split()


def _number_words(n):
    if n < 20:
        return _ONES[n]
    if n < 100:
        return _TENS[n // 10] + ('' if n % 10 == 0 else ' ' + _ONES[n % 10])
    if n < 1000:
        return _ONES[n // 100] + ' hundred' + ('' if n % 100 == 0 else ' ' + _number_words(n % 100))
    if n < 1000000:
        return _number_words(n // 1000) + ' thousand' + ('' if n % 1000 == 0 else ' ' + _number_words(n % 1000))
    return str(n)


def norm_words(s):
    """Lower case, numbers as words, no punctuation or apostrophes (so I'd == Id)."""
    s = s.lower().replace('\u2019', "'").replace('\u2018', "'")
    s = re.sub(r'\d+', lambda m: ' ' + _number_words(int(m.group())) + ' ', s)
    s = re.sub(r"[^a-z' ]+", ' ', s.replace('-', ' ')).replace("'", '')
    return [SAME_WORD.get(w, w) for w in s.split() if w != 'and']


def same_words(expected, heard):
    a, b = norm_words(expected), norm_words(heard)
    return a == b or ''.join(a) == ''.join(b)   # also accept "lunch time" for "lunchtime"


def merge_contractions(text):
    """What a line sounds like when a contraction runs into a next word that
    starts with the same consonant: "It's stayed" -> "It stayed", "I'd
    disagree" -> "I disagree". Accepted only when no try gives the full words."""
    return re.sub(r"\b(\w+)'([sd]) (?=\2)", r'\1 ', text)


# ---------------------------------------------------------------- audio steps
def trim(x, pad=EDGE_PAD, rel_db=-45.0, floor_db=-60.0):
    """Cut leading/trailing silence and keep `pad` seconds; fade the outer edges.

    A short, quiet blip separated from the speech by a gap (a click or breath
    the model leaves at the very end) is cut away too.
    """
    hop, win = int(0.010 * SR), int(0.030 * SR)
    if len(x) <= win:
        return x.astype(np.float32)
    frames = np.lib.stride_tricks.sliding_window_view(x, win)[::hop]
    db = 10 * np.log10(np.mean(frames.astype(np.float64) ** 2, axis=1) + 1e-12)
    top = db.max()
    active = np.where(db > max(top + rel_db, floor_db))[0]
    if len(active) == 0:
        return x.astype(np.float32)
    # runs of active frames, bridging gaps up to 100 ms
    runs, start = [], active[0]
    for a, b in zip(active[:-1], active[1:]):
        if b - a > 10:
            runs.append((start, a))
            start = b
    runs.append((start, active[-1]))

    def blip(run):   # under ~100 ms and 15 dB below the loudest frame
        return (run[1] - run[0] + 1) * 10 + 20 <= 120 and db[run[0]:run[1] + 1].max() < top - 15

    while len(runs) > 1 and blip(runs[-1]):
        runs.pop()
    while len(runs) > 1 and blip(runs[0]):
        runs.pop(0)
    begin = max(0, runs[0][0] * hop - int(pad * SR))
    end = min(len(x), runs[-1][1] * hop + win + int(pad * SR))
    y = x[begin:end].astype(np.float32).copy()
    fi, fo = int(0.005 * SR), int(0.010 * SR)
    y[:fi] *= np.linspace(0, 1, fi, dtype=np.float32)
    y[-fo:] *= np.linspace(1, 0, fo, dtype=np.float32)
    return y


def loudness(ffmpeg, x):
    """EBU R128 integrated loudness (LUFS) and true peak (dBTP) via ffmpeg loudnorm.

    Short clips are looped to at least 4 s first: the R128 gate works on 400 ms
    blocks, so a sub-second clip measured on its own gives no or unstable
    readings, while its looped copy has the same loudness and true peak.
    """
    looped = np.tile(x, int(np.ceil(4.0 * SR / max(1, len(x))))).astype(np.float32)
    p = ffmpeg_run(ffmpeg, [*pcm(), '-i', '-', '-af',
                            f'loudnorm=I={TARGET_LUFS}:TP={TRUE_PEAK_MAX}:print_format=json',
                            '-f', 'null', '-'], looped.tobytes())
    m = json.loads(re.findall(r'\{[^{}]*\}', p.stderr.decode(errors='replace'))[-1])
    return float(m['input_i']), float(m['input_tp'])   # -inf for digital silence


def normalise(ffmpeg, x, headroom=MP3_HEADROOM):
    """Bring a clip to TARGET_LUFS with its true peak `headroom` dB under TRUE_PEAK_MAX.

    Two-pass loudnorm in linear mode - an EBU R128 measurement, then one
    constant gain - rather than plain loudnorm, whose dynamic mode (used
    whenever a linear gain would break the peak ceiling) pumps and misjudges
    levels on clips shorter than its 3 s window. Speech peaks often sit more
    than 14.5 dB above its loudness, so the few peaks that would cross the
    ceiling go through a look-ahead limiter (ffmpeg alimiter, run at 4x the
    sample rate so it also catches peaks between samples), at most
    MAX_LIMITING_DB deep; beyond that the gain is lowered instead, which is
    peak normalisation. The peaks that need it are mostly short consonant
    bursts ("s", "t"), where limiting is inaudible.
    """
    lufs, tp = loudness(ffmpeg, x)
    if not np.isfinite(lufs) or lufs < -70:
        return x, {'gain_db': 0.0, 'limiting_db': 0.0}   # silent: the checks will reject it
    ceiling = TRUE_PEAK_MAX - headroom
    gain, limiting, y = TARGET_LUFS - lufs, 0.0, x
    for _ in range(2):   # the limiter takes a little loudness away: one top-up pass
        over = max(0.0, tp + gain - ceiling)
        limiting = min(over, MAX_LIMITING_DB)
        gain -= over - limiting
        y = (x * np.float32(10 ** (gain / 20))).astype(np.float32)
        if limiting > 0:
            y = filter_audio(ffmpeg, y, f'aresample={4 * SR},alimiter=limit={10 ** ((ceiling - 0.2) / 20):.4f}'
                                        f':attack=3:release=40:level=0:latency=1,aresample={SR}')[:len(x)]
        lufs_now, tp_now = loudness(ffmpeg, y)
        if limiting == 0 or lufs_now > TARGET_LUFS - 0.5 or limiting >= MAX_LIMITING_DB:
            break
        gain += TARGET_LUFS - lufs_now
    if tp_now > ceiling:   # an inter-sample peak the limiter missed
        y = (y * np.float32(10 ** ((ceiling - tp_now) / 20))).astype(np.float32)
    return y, {'gain_db': round(gain, 2), 'limiting_db': round(limiting, 2)}


def filter_audio(ffmpeg, x, af, sr_in=SR):
    p = ffmpeg_run(ffmpeg, [*pcm(sr_in), '-i', '-', '-af', af, *pcm(), '-'], x.astype(np.float32).tobytes())
    return np.frombuffer(p.stdout, dtype=np.float32).copy()


def encode_mp3(ffmpeg, x, kbps):
    # A real file, not a pipe, so ffmpeg can go back and fill in the Xing/LAME
    # header that tells decoders how much encoder delay to skip.
    fd, path = tempfile.mkstemp(suffix='.mp3')
    os.close(fd)
    try:
        ffmpeg_run(ffmpeg, ['-y', *pcm(), '-i', '-', '-c:a', 'libmp3lame', '-b:a', f'{kbps}k',
                            '-ar', str(SR), '-ac', '1', '-map_metadata', '-1', '-id3v2_version', '0',
                            '-write_id3v1', '0', '-fflags', '+bitexact', path], x.astype(np.float32).tobytes())
        with open(path, 'rb') as f:
            return f.read()
    finally:
        os.unlink(path)


def decode(ffmpeg, mp3, sr=SR):
    p = ffmpeg_run(ffmpeg, ['-f', 'mp3', '-i', '-', *pcm(sr), '-'], mp3)
    return np.frombuffer(p.stdout, dtype=np.float32).copy()


def signal_problems(y, voice):
    """Checks on the decoded MP3 that need no ASR: length, silence, clipping."""
    dur = len(y) / SR
    peak = float(np.max(np.abs(y))) if len(y) else 0.0
    hop = int(0.010 * SR)
    frames = y[:len(y) // hop * hop].reshape(-1, hop).astype(np.float64)
    loud_ms = int(np.sum(np.sqrt(np.mean(frames ** 2, axis=1)) > 0.01)) * 10 if len(frames) else 0
    problems = []
    if not voice.min_s <= dur <= voice.max_s:
        problems.append(f'duration {dur:.2f}s outside {voice.min_s}-{voice.max_s}s')
    if peak < 0.1 or loud_ms < 150:
        problems.append('silent or nearly silent')
    if peak >= 0.99:
        problems.append(f'clipped (peak {peak:.3f})')
    return problems, {'duration': round(dur, 3), 'peak_dbfs': round(20 * np.log10(max(peak, 1e-9)), 2)}


# ---------------------------------------------------------------- engines
class Kokoro:
    def __init__(self, cache, int8=False):
        from kokoro_onnx import Kokoro as KokoroOnnx
        from kokoro_onnx.config import EspeakConfig
        model = fetch_model(cache, 'kokoro-v1.0.int8.onnx' if int8 else 'kokoro-v1.0.onnx')
        self.model_name = os.path.basename(model)
        self.k = KokoroOnnx(model, fetch_model(cache, 'voices-v1.0.bin'),
                            espeak_config=EspeakConfig(data_path=self._espeak_data(cache)))

    @staticmethod
    def _espeak_data(cache):
        # espeak-ng silently ignores a data path longer than ~160 bytes and then
        # looks in the build machine's path; deep virtualenvs hit that. Use a
        # short copy when the bundled path is long.
        import espeakng_loader
        data = espeakng_loader.get_data_path()
        if len(data) <= 140:
            return data
        for base in (cache, tempfile.gettempdir()):
            short = os.path.join(base, 'espeak-ng-data')
            if len(short) <= 140:
                if not os.path.isdir(short):
                    shutil.copytree(data, short)
                return short
        return data

    def speak(self, text, mix, speed, style_floor=0):
        style = sum(w * self.k.get_voice_style(v) for v, w in mix).astype(np.float32)
        if style_floor:
            # Kokoro picks the style row by phoneme count; very short replies can
            # borrow the row of a longer utterance instead.
            style = style.copy()
            style[:style_floor] = style[style_floor]
        audio, sr = self.k.create(text, voice=style, speed=speed, lang='en-gb', trim=False)
        assert sr == SR
        return audio.astype(np.float32)


class Piper:
    """Optional: Piper en_GB-vctk-medium, for --voice SPEAKER=piper:<VCTK id>."""
    LENGTH_SCALE = 1.4   # the model's own default pace

    def __init__(self, cache, ffmpeg):
        from piper import PiperVoice
        model = fetch_model(cache, 'en_GB-vctk-medium.onnx')
        config = fetch_model(cache, 'en_GB-vctk-medium.onnx.json')
        self.v = PiperVoice.load(model, config_path=config)
        with open(config, encoding='utf-8') as f:
            self.ids = json.load(f)['speaker_id_map']
        self.ffmpeg = ffmpeg

    def speak(self, text, speaker, speed):
        from piper import SynthesisConfig
        cfg = SynthesisConfig(speaker_id=self.ids[speaker], length_scale=self.LENGTH_SCALE / speed,
                              normalize_audio=False)
        chunks = list(self.v.synthesize(text, syn_config=cfg))   # one chunk per sentence
        gap = np.zeros(int(0.25 * chunks[0].sample_rate), np.float32)
        audio = np.concatenate([p for c in chunks for p in (c.audio_float_array, gap)][:-1])
        return filter_audio(self.ffmpeg, audio, 'aresample=24000:resampler=soxr', chunks[0].sample_rate)


class Checker:
    def __init__(self, cache, model_name, ffmpeg):
        from faster_whisper import WhisperModel
        self.ffmpeg = ffmpeg
        self.m = WhisperModel(model_name, device='cpu', compute_type='int8',
                              download_root=os.path.join(cache, 'whisper'))

    def hear(self, mp3):
        pad = np.zeros(int(0.3 * 16000), np.float32)   # Whisper does better with a little room
        x = np.concatenate([pad, decode(self.ffmpeg, mp3, 16000), pad])
        segs = list(self.m.transcribe(x, language='en', beam_size=5, temperature=0.0,
                                      condition_on_previous_text=False, vad_filter=False)[0])
        text = ' '.join(s.text.strip() for s in segs).strip()
        return text, (float(np.mean([s.avg_logprob for s in segs])) if segs else -9.0)


# ---------------------------------------------------------------- per line
def attempts(say, voice):
    """The render to try first, then variations for retries, as
    (label, spoken text, voice mix, speed, style floor)."""
    s0, mix = voice.speed, voice.mix
    yield 'base', say, mix, s0, 0
    if voice.engine == 'piper':   # random each time: plain re-draws first
        for i in (2, 3):
            yield f'redraw {i}', say, mix, s0, 0
    for pattern, alternatives in HINTS:
        if re.search(pattern, say):
            for alt in alternatives:
                hinted = re.sub(pattern, alt, say, count=1)
                for f in (1.0, 0.95):
                    yield f'hint {hinted!r} speed x{f}', hinted, mix, round(s0 * f, 3), 0
    if say.endswith('.'):
        yield 'no final full stop', say[:-1], mix, s0, 0
    if voice.engine == 'kokoro':
        yield 'longer-utterance style', say, mix, s0, 40
    for f in (0.95, 1.05, 0.9, 1.1):
        yield f'speed x{f}', say, mix, round(s0 * f, 3), 0
    if voice.engine == 'kokoro' and voice.nudge:
        nudged = [(v, w * 0.9) for v, w in mix] + [(voice.nudge, 0.1)]
        for f in (1.0, 0.95, 1.05):
            yield f'blend +10% {voice.nudge} speed x{f}', say, nudged, round(s0 * f, 3), 0


def render_line(item, voice, engines, checker, ffmpeg, kbps):
    text, say = item['text'], item.get('say') or item['text']
    targets = [text] + ([item['say']] if item.get('say') else [])   # what the transcript may match
    tries, best = [], None
    for label, spoken, mix, speed, floor in attempts(say, voice):
        if voice.engine == 'piper':
            raw = engines['piper'].speak(spoken, mix[0][0], speed)
        else:
            raw = engines['kokoro'].speak(spoken, mix, speed, floor)
        clean = trim(raw)
        if voice.fx:
            clean = trim(filter_audio(ffmpeg, clean, voice.fx))
        headroom = MP3_HEADROOM
        for _ in range(8):
            x, norm_info = normalise(ffmpeg, clean, headroom)
            mp3 = encode_mp3(ffmpeg, x, kbps)
            y = decode(ffmpeg, mp3)
            lufs, tp = loudness(ffmpeg, y)
            if tp <= TRUE_PEAK_MAX:
                break
            # At 48 kbit/s a loud "s" can come back from the MP3 coder up to 2 dB
            # higher: limit the peaks harder (and, past MAX_LIMITING_DB, turn the
            # clip down) until the decoded MP3 is under the ceiling.
            headroom += tp - TRUE_PEAK_MAX + 0.1
        problems, signal = signal_problems(y, voice)
        heard, logprob, match = None, None, 'not checked'
        if checker and voice.asr:
            heard, logprob = checker.hear(mp3)
            if any(same_words(t, heard) for t in targets):
                match = 'exact'
            elif any(same_words(merge_contractions(t), heard) for t in targets):
                match = 'contraction merged'   # a pass, but keep looking for the full words
            else:
                match = 'wrong words'
                problems.append(f'heard "{heard}"')
        result = {'variant': label, 'spoken': spoken, 'speed': speed,
                  'lufs': round(lufs, 1), 'true_peak_dbtp': round(tp, 1), **norm_info, **signal,
                  'heard': heard, 'match': match, 'avg_logprob': None if logprob is None else round(logprob, 3),
                  'problems': problems, 'bytes': len(mp3)}
        tries.append(result)
        score = (not problems, match != 'contraction merged', -len(problems), logprob if logprob is not None else 0.0)
        if best is None or score > best[0]:
            best = (score, mp3, result)
        if not problems and match != 'contraction merged':
            break
    _, mp3, result = best
    return mp3, dict(result, ok=not result['problems'], attempts=len(tries),
                     failed_tries=[{'variant': t['variant'], 'match': t['match'], 'problems': t['problems']}
                                   for t in tries if t['problems'] or t['match'] == 'contraction merged'])


# ---------------------------------------------------------------- voices.js
def js_str(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n') + "'"


def write_js(path, clips, voices, kokoro_model):
    engines_used = sorted({v.engine for v in voices.values()})
    credit = 'Voices: ' + ' and '.join(CREDITS[e] for e in engines_used) + ', generated offline.'
    models = [f'Kokoro-82M v1.0 ({kokoro_model} via kokoro-onnx, Apache-2.0, en-gb)'] if 'kokoro' in engines_used else []
    if 'piper' in engines_used:
        models.append('Piper en_GB-vctk-medium (MIT, VCTK data CC BY 4.0)')
    mapping = ', '.join(f'{sp} {v.label()}' + (f' at speed {v.speed:g}' if v.speed != 1.0 else '')
                        for sp, v in voices.items())
    lines = ['/* Generated by tools/make_vox_pop_voices.py - do not edit by hand.',
             f" * {' + '.join(models)}; voices: {mapping}. */",
             'window.VP_VOICES = {',
             "  format: 'audio/mpeg',",
             f'  credit: {js_str(credit)},',
             '  speakers: { ' + ', '.join(f'{sp}: {js_str(v.label())}' for sp, v in voices.items()) + ' },',
             '  clips: {']
    keys = list(clips)
    for i, key in enumerate(keys):
        b64 = base64.b64encode(clips[key]).decode('ascii')
        lines.append(f'    {json.dumps(key)}: "{b64}"' + (',' if i < len(keys) - 1 else ''))
    lines += ['  }', '};', '']
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    return credit


def parse_voice(spec):
    """'bf_alice', 'bm_lewis:0.7+bm_daniel:0.3', 'piper:p288' - each optionally '@speed'."""
    spec, _, speed = spec.partition('@')
    speed = float(speed) if speed else 1.0
    if spec.startswith('piper:'):
        return Voice(spec[len('piper:'):], engine='piper', speed=speed)
    mix = [(p.split(':')[0], float(p.split(':')[1]) if ':' in p else 1.0) for p in spec.split('+')]
    return Voice(mix, speed=speed)


def main():
    ap = argparse.ArgumentParser(description='Generate the Vox Pop NPC voice clips (voices.js).')
    ap.add_argument('--lines', required=True, help='lines JSON: [{"speaker", "text", "say"?}, ...]')
    ap.add_argument('--out', required=True, help='voices.js to write')
    ap.add_argument('--clips', help='also write every clip as <speaker>__<slug>.mp3 into this folder')
    ap.add_argument('--report', help='write per-clip results (checks, durations, loudness) as JSON here')
    ap.add_argument('--cache', default=os.path.join(os.path.expanduser('~'), '.cache', 'vox-pop-voices'),
                    help='folder for downloaded models (default: %(default)s)')
    ap.add_argument('--int8', action='store_true', help='use the smaller, faster int8 Kokoro model')
    ap.add_argument('--no-check', action='store_true', help='skip the Whisper transcript check')
    ap.add_argument('--whisper-model', default='small.en', help='faster-whisper model for the check (default: %(default)s)')
    ap.add_argument('--bitrate', type=int, default=BITRATE_KBPS, help='MP3 bitrate in kbit/s (default: %(default)s)')
    ap.add_argument('--voice', action='append', default=[], metavar='SPEAKER=VOICE',
                    help='override a voice, e.g. m1=bm_daniel, m3=bm_lewis:0.7+bm_daniel:0.3, f2=piper:p283@1.1')
    ap.add_argument('--ffmpeg', default=shutil.which('ffmpeg') or 'ffmpeg', help='ffmpeg binary with libmp3lame')
    args = ap.parse_args()

    voices = dict(VOICES)
    for override in args.voice:
        speaker, _, spec = override.partition('=')
        voices[speaker] = parse_voice(spec)
    with open(args.lines, encoding='utf-8') as f:
        items = json.load(f)
    unknown = sorted({it['speaker'] for it in items} - set(voices))
    if unknown:
        sys.exit(f'no voice for speaker(s): {", ".join(unknown)} - add them to VOICES')
    if 'libmp3lame' not in ffmpeg_run(args.ffmpeg, ['-encoders']).stdout.decode():
        sys.exit(f'{args.ffmpeg} has no libmp3lame encoder')

    used = {sp: voices[sp] for sp in voices if any(it['speaker'] == sp for it in items)}
    engines = {'kokoro': Kokoro(args.cache, args.int8)}
    if any(v.engine == 'piper' for v in used.values()):
        engines['piper'] = Piper(args.cache, args.ffmpeg)
    checker = None if args.no_check else Checker(args.cache, args.whisper_model, args.ffmpeg)
    if args.clips:
        os.makedirs(args.clips, exist_ok=True)

    clips, report, names, t0 = {}, [], set(), time.time()
    for n, item in enumerate(items, 1):
        key = f"{item['speaker']}|{item['text']}"
        if key in clips:
            continue
        mp3, res = render_line(item, used[item['speaker']], engines, checker, args.ffmpeg, args.bitrate)
        clips[key] = mp3
        name = f"{item['speaker']}__{slug(item['text'])}.mp3"
        while name in names:
            name = name[:-4] + '-2.mp3'
        names.add(name)
        if args.clips:
            with open(os.path.join(args.clips, name), 'wb') as f:
                f.write(mp3)
        report.append({'key': key, 'speaker': item['speaker'], 'text': item['text'], 'file': name, **res})
        log(f"[{n:3d}/{len(items)}] {'ok  ' if res['ok'] else 'FAIL'} {res['duration']:.2f}s {key}"
            + ('' if res['variant'] == 'base' else f"  ({res['variant']}, try {res['attempts']})")
            + (f"  [heard {res['heard']!r}: contraction merged]" if res['match'] == 'contraction merged' else '')
            + ('' if res['ok'] else f"  {'; '.join(res['problems'])}"))

    credit = write_js(args.out, clips, used, engines['kokoro'].model_name)
    size = os.path.getsize(args.out)
    failed = [r for r in report if not r['ok']]
    summary = {'clips': len(report), 'passed': len(report) - len(failed), 'failed': len(failed),
               'asr_checked': sum(1 for r in report if r['heard'] is not None),
               'contraction_merged': sum(1 for r in report if r['match'] == 'contraction merged'),
               'check_model': None if args.no_check else f'faster-whisper {args.whisper_model}',
               'voices_js_bytes': size, 'seconds': round(time.time() - t0, 1), 'credit': credit,
               'speakers': {sp: v.label() + (f' at speed {v.speed:g}' if v.speed != 1.0 else '') for sp, v in used.items()}}
    if args.report:
        with open(args.report, 'w', encoding='utf-8') as f:
            json.dump({'summary': summary, 'clips': report}, f, indent=1)
    log(f"\n{summary['passed']}/{summary['clips']} clips passed; {args.out}: {size / 1e6:.2f} MB")
    if size > 2.5e6:
        log('warning: voices.js is over 2.5 MB - try a lower --bitrate')
    for r in failed:
        log(f"FAILED {r['key']}: {'; '.join(r['problems'])}")
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
