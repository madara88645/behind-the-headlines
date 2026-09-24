/*
 * Vox Pop - audio.js
 * The sound layer: a quiet looping music bed and the recorded voice lines, under one "sound on/off" switch.
 *
 * Script order (classic <script src>, no modules, works from file://):
 *   games/vox-pop/music.js    optional - window.VP_MUSIC  (the music loop, MP3 as base64)
 *   games/vox-pop/voices.js   optional - window.VP_VOICES (voiced page only: { clips: { 'speaker|text': base64 MP3 } })
 *   games/vox-pop/audio.js    this file - window.VP.Audio
 *   ... then game.js
 *
 * Browsers only allow sound after the player clicks or presses a key, and Chrome prints a warning when an
 * AudioContext is created before that. So nothing is created until unlock() runs inside a click/key handler.
 * Audio is decoded from the embedded base64 with the Web Audio API (no fetch, no <audio>), which is what
 * makes it work when the page is opened by double-clicking the file in Safari and Chrome.
 *
 * window.VP.Audio - no method throws:
 *   unlock()               call from any click/keydown handler; cheap, safe to call on every gesture.
 *                          First call: creates the AudioContext and starts the music with a 2.5 s fade-in (unless muted).
 *   say(speaker, text)     -> Promise<boolean>. Plays VP_VOICES.clips[speaker + '|' + text]; stops the line before it
 *                          (latest call wins) and ducks the music while it plays. Resolves true when the clip played to
 *                          the end; false straight away when muted, not unlocked yet, no such clip, or it can't be
 *                          decoded; false when it is stopped or replaced by a newer say().
 *   stopVoice()            stop the current line (its say() resolves false).
 *   hasVoices()            true when window.VP_VOICES has clips (the voiced version of the page).
 *   prepare(list)          optional: decode [[speaker, text], ...] ahead of time, one clip at a time, when idle.
 *   isMuted(), setMuted(bool), toggleMuted(), onChange(fn)
 *                          one switch for music and voices, remembered on this device (localStorage
 *                          'vp-sound-muted'). onChange(fn) calls fn(muted) on every change; returns an "off" function.
 *   isUnlocked()           true after the first successful unlock().
 *   musicInfo()            { title, author, url, license, licenseUrl, credit } of the music (for "How this works"), or null.
 *   credits()              the credit lines to show: the music's, plus VP_VOICES.credit when voices are loaded.
 *   _qa                    test hook: _qa.tap() -> MediaStream of the master output (for recording demo videos);
 *                          _qa.events -> [{ t, type, key, ct }] (t = performance.timeOrigin + performance.now(),
 *                          ct = AudioContext time); _qa.state() -> a read-only snapshot for tests; set _qa.force = true
 *                          to let a script call unlock() without a click (with Chrome's --autoplay-policy=no-user-gesture-required).
 *
 * No per-frame work: everything is event driven (Web Audio automation, one AudioBufferSourceNode loop).
 */
(function () {
  'use strict';

  const VP = (window.VP = window.VP || {});
  if (VP.Audio) return;   // loaded twice: keep the first engine

  /* ============================================================ tuning (the team may tweak these) */
  // Loudness of the music on its own, in LUFS. The voice clips are normalised to about -16 LUFS, so -31 keeps the
  // music a quiet bed about 15 LU under them. Louder bed: -28. Quieter: -34.
  const MUSIC_LUFS = -31;
  const MUSIC_FILE_LUFS = -18;    // loudness of VP_MUSIC.data if music.js doesn't state it (VP_MUSIC.lufs)
  const VOICE_GAIN = 1;           // voice clips as recorded
  const DUCK = 0.33;              // music level while someone speaks (fraction of normal; 1 = no ducking)
  const DUCK_ATTACK = 0.08;       // s, music goes down this fast when a line starts
  const DUCK_HOLD = 0.1;          // s, stays down this long after the line ends (bridges back-to-back lines)
  const DUCK_RELEASE = 0.45;      // s, then comes back up over this long
  const FADE_IN = 2.5;            // s, first music fade-in after unlock()
  const MUTE_FADE = 0.3;          // s, music fade-out when muted
  const UNMUTE_FADE = 1.2;        // s, music fade-in when unmuted
  const STORE_KEY = 'vp-sound-muted';
  const MAX_CACHED = 80;          // decoded voice clips kept in memory

  /* ============================================================ state */
  const AC = window.AudioContext || window.webkitAudioContext || null;
  const noop = function () {};
  const own = Object.prototype.hasOwnProperty;

  let ctx = null;                 // AudioContext, created by the first unlock()
  let master = null, musicLevel = null, musicFade = null, duckGain = null, voiceBus = null, tapNode = null;
  let fadeEnv = null, duckEnv = null, pageEnv = null;
  let unlocked = false;
  let muted = readMuted();
  let musicState = 'idle';        // idle | loading | ready | playing | failed
  let musicBuf = null, musicSrc = null, musicBytes = null;
  let voice = null;               // the line playing (or decoding): { key, resolve, src, done, stopped }
  let suspendTimer = 0, hideTimer = 0;
  const cache = new Map();        // clip key -> Promise<AudioBuffer|null>
  const prepQueue = [];
  let prepBusy = false;
  let normIndex = null, normFor = null, normCount = -1;
  const listeners = [];
  const qa = { events: [], tap: tap, force: false, state: qaState };

  /* ============================================================ small helpers */
  const T0 = (window.performance && performance.timeOrigin) || (Date.now() - (window.performance ? performance.now() : 0));
  function wallNow() { return window.performance ? T0 + performance.now() : Date.now(); }
  function log(type, key) {
    const ev = { t: wallNow(), type: type };
    if (key !== undefined) ev.key = key;
    if (ctx) ev.ct = ctx.currentTime;
    qa.events.push(ev);
    if (qa.events.length > 1000) qa.events.splice(0, qa.events.length - 1000);
  }
  function hidden() { return !!document.hidden; }
  function idle(fn) {
    if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 1000 });
    else setTimeout(fn, 60);
  }
  function readMuted() {
    try { return window.localStorage.getItem(STORE_KEY) === '1'; } catch (e) { return false; }
  }
  function writeMuted(v) {
    try { window.localStorage.setItem(STORE_KEY, v ? '1' : '0'); } catch (e) { /* storage blocked: remember for this visit only */ }
  }
  function emit() {
    listeners.slice().forEach(function (fn) { try { fn(muted); } catch (e) { /* a listener's problem, not ours */ } });
  }

  /** base64 (or a data: URL) -> ArrayBuffer, or null. */
  function bytesOf(b64) {
    try {
      let s = String(b64);
      if (s.slice(0, 5) === 'data:') s = s.slice(s.indexOf(',') + 1);
      const bin = window.atob(s);
      const n = bin.length, u8 = new Uint8Array(n);
      for (let i = 0; i < n; i++) u8[i] = bin.charCodeAt(i);
      return u8.buffer;
    } catch (e) { return null; }
  }

  /** decodeAudioData as a Promise, using the callback form (older Safari has no promise version). */
  function decode(ab) {
    return new Promise(function (resolve, reject) {
      let settled = false;
      const ok = function (buf) { if (!settled) { settled = true; if (buf) resolve(buf); else reject(new Error('empty')); } };
      const bad = function (err) { if (!settled) { settled = true; reject(err || new Error('decode')); } };
      if (!ctx || !ab) { bad(); return; }
      try {
        const p = ctx.decodeAudioData(ab, ok, bad);
        if (p && typeof p.then === 'function') p.then(ok, bad);   // handled: no "uncaught (in promise)" in Chrome
      } catch (e) { bad(e); }
    });
  }

  /* A gain envelope we can always read back: piecewise-linear ramps, tracked here because AudioParam.value
     doesn't report automation reliably in every browser. go([[time, value], ...]) ramps from "now". */
  function Env(param, v) {
    this.p = param;
    this.pts = [{ t: 0, v: v }];
    try { param.value = v; } catch (e) { /* ignore */ }
  }
  Env.prototype.at = function (t) {
    const a = this.pts;
    if (t <= a[0].t) return a[0].v;
    for (let i = 1; i < a.length; i++) {
      if (t <= a[i].t) {
        const p = a[i - 1], q = a[i];
        return q.t <= p.t ? q.v : p.v + (q.v - p.v) * (t - p.t) / (q.t - p.t);
      }
    }
    return a[a.length - 1].v;
  };
  Env.prototype.go = function (pts) {
    if (!ctx) return;
    const t0 = ctx.currentTime, v0 = this.at(t0), p = this.p, arr = [{ t: t0, v: v0 }];
    try {
      p.cancelScheduledValues(t0);
      p.setValueAtTime(v0, t0);
      for (let i = 0; i < pts.length; i++) {
        const t = Math.max(pts[i][0], arr[arr.length - 1].t), v = pts[i][1];
        p.linearRampToValueAtTime(v, t);
        arr.push({ t: t, v: v });
      }
    } catch (e) { /* ignore */ }
    this.pts = arr;
  };
  /** Points for a smooth fade from the envelope's current value to `to`: quarter-sine in, cosine out. */
  function fadePts(env, start, dur, to) {
    const from = env.at(start), pts = [[start, from]], N = 8;
    for (let i = 1; i <= N; i++) {
      const x = i / N;
      const k = to > from ? Math.sin(x * Math.PI / 2) : 1 - Math.cos(x * Math.PI / 2);
      pts.push([start + dur * x, from + (to - from) * k]);
    }
    return pts;
  }

  /* ============================================================ context */
  function ensureCtx() {
    if (ctx) return ctx;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; return null; }
    try {
      master = ctx.createGain();
      master.connect(ctx.destination);
      musicLevel = ctx.createGain();       // fixed: MUSIC_LUFS vs the file's loudness
      musicFade = ctx.createGain();        // fades: unlock, mute, unmute
      duckGain = ctx.createGain();         // ducking under voices
      musicLevel.connect(musicFade);
      musicFade.connect(duckGain);
      duckGain.connect(master);
      voiceBus = ctx.createGain();
      voiceBus.gain.value = VOICE_GAIN;
      voiceBus.connect(master);
      musicLevel.gain.value = musicGain();
      fadeEnv = new Env(musicFade.gain, 0);
      duckEnv = new Env(duckGain.gain, 1);
      pageEnv = new Env(master.gain, 1);   // short fades around hide/show, so suspending never clicks
      ctx.onstatechange = function () { log('state', ctx.state); };
    } catch (e) { /* a very old browser: stay silent */ }
    log('context', ctx.state);
    return ctx;
  }
  function musicGain() {
    const M = window.VP_MUSIC;
    const lufs = M && typeof M.lufs === 'number' && isFinite(M.lufs) ? M.lufs : MUSIC_FILE_LUFS;
    return Math.pow(10, (MUSIC_LUFS - lufs) / 20);
  }
  function resume() {
    if (!ctx || ctx.state === 'running' || ctx.state === 'closed') return;
    try {
      const p = ctx.resume();
      if (p && p.catch) p.catch(noop);
      log('resume');
    } catch (e) { /* ignore */ }
  }
  function suspend(reason) {
    if (!ctx || ctx.state !== 'running') return;
    try {
      const p = ctx.suspend();
      if (p && p.catch) p.catch(noop);
      log('suspend', reason);
    } catch (e) { /* ignore */ }
  }
  /** One silent sample, played inside the gesture: the classic iOS Safari unlock. Harmless elsewhere. */
  function kick() {
    try {
      const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
    } catch (e) { /* ignore */ }
  }

  /* ============================================================ music */
  function startMusic() {
    if (!ctx || muted || musicSrc) return;
    if (musicBuf) { playMusic(); return; }
    const M = window.VP_MUSIC;
    if (!M || !M.data || musicState === 'loading' || musicState === 'failed') return;
    musicState = 'loading';
    log('music-load');
    const ab = musicBytes || bytesOf(M.data);   // usually converted already, in idle time after load
    musicBytes = null;                          // decodeAudioData takes ownership of the buffer
    decode(ab).then(function (buf) {
      musicBuf = buf;
      musicState = 'ready';
      log('music-ready');
      if (!muted) playMusic();
    }, function () {
      musicState = 'failed';
      log('music-error');
    });
  }
  function playMusic() {
    if (musicSrc || !musicBuf || !ctx) return;
    try {
      const M = window.VP_MUSIC || {};
      const src = ctx.createBufferSource();
      src.buffer = musicBuf;
      src.loop = true;
      let ls = +M.loopStart || 0;
      const le = +M.loopEnd || 0;
      if (le > ls && le <= musicBuf.duration + 0.01) { src.loopStart = ls; src.loopEnd = le; } else ls = 0;
      src.connect(musicLevel);
      const t = ctx.currentTime + 0.03;
      fadeEnv.go(fadePts(fadeEnv, t, FADE_IN, 1));
      src.start(t, ls);
      musicSrc = src;
      musicState = 'playing';
      log('music-start');
    } catch (e) {
      musicState = 'failed';
      log('music-error');
    }
  }

  /* ============================================================ voices */
  function clipsObj() {
    const v = window.VP_VOICES;
    return v && v.clips && typeof v.clips === 'object' ? v.clips : null;
  }
  function norm(s) {
    return String(s).replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
      .replace(/[\u2018\u2019\u2032]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, '-')
      .replace(/\u2026/g, '...').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  /** The clips key for speaker|text: exact match first, then one that only differs in quotes/dashes/spacing/case/markup. */
  function clipKey(key) {
    const c = clipsObj();
    if (!c) return null;
    if (own.call(c, key) && typeof c[key] === 'string' && c[key]) return key;
    const n = Object.keys(c).length;
    if (normFor !== c || normCount !== n) {   // (re)build when the clips object is new or has grown
      normFor = c;
      normCount = n;
      normIndex = new Map();
      for (const k in c) if (own.call(c, k)) normIndex.set(norm(k), k);
    }
    const k = normIndex.get(norm(key));
    return k && typeof c[k] === 'string' && c[k] ? k : null;
  }
  function loadClip(key) {
    let p = cache.get(key);
    if (p) return p;
    const c = clipsObj();
    p = decode(bytesOf(c && c[key])).then(function (buf) { return buf; }, function () { log('voice-error', key); return null; });
    cache.set(key, p);
    if (cache.size > MAX_CACHED) {
      for (const k of cache.keys()) {
        if (cache.size <= MAX_CACHED) break;
        if (!voice || voice.key !== k) cache.delete(k);
      }
    }
    return p;
  }
  function releaseDuck(at) {
    if (!duckEnv) return;
    duckEnv.go([[at + DUCK_HOLD, duckEnv.at(at)], [at + DUCK_HOLD + DUCK_RELEASE, 1]]);
  }
  function endVoice(v, ok) {
    if (!v || v.done) return;
    v.done = true;
    if (voice === v) voice = null;
    if (v.src && !ok) {
      v.stopped = true;
      try { v.src.onended = null; v.src.stop(0); } catch (e) { /* already stopped */ }
      try { v.src.disconnect(); } catch (e) { /* ignore */ }
    }
    if (!ok && v.src && ctx) releaseDuck(ctx.currentTime);   // a natural end has its release scheduled already
    log(ok ? 'say-end' : 'say-stop', v.key);
    try { v.resolve(!!ok); } catch (e) { /* ignore */ }
  }
  function playClip(v, buf) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(voiceBus);
    const now = ctx.currentTime, t = now + 0.02;
    const end = t + buf.duration;
    duckEnv.go([[now + DUCK_ATTACK, DUCK], [end + DUCK_HOLD, DUCK], [end + DUCK_HOLD + DUCK_RELEASE, 1]]);
    src.onended = function () { if (!v.stopped) endVoice(v, true); };
    v.src = src;
    src.start(t);
    log('say-start', v.key);
  }
  function say(speaker, text) {
    return new Promise(function (resolve) {
      try {
        const want = String(speaker) + '|' + String(text);
        const key = clipKey(want);
        if (!unlocked || !ctx || muted || !key) {
          log('say-skip', want);
          resolve(false);
          return;
        }
        if (voice) endVoice(voice, false);    // latest call wins
        const v = { key: key, resolve: resolve, src: null, done: false, stopped: false };
        voice = v;
        log('say', key);
        if (ctx.state !== 'running' && !hidden()) resume();
        loadClip(key).then(function (buf) {
          if (v.done) return;                   // replaced or stopped while decoding
          if (!buf || muted || !ctx) { endVoice(v, false); return; }
          try { playClip(v, buf); } catch (e) { endVoice(v, false); }
        });
      } catch (e) { resolve(false); }
    });
  }
  function stopVoice() {
    try { if (voice) endVoice(voice, false); } catch (e) { /* ignore */ }
  }
  function hasVoices() {
    try {
      const c = clipsObj();
      if (!c) return false;
      for (const k in c) if (own.call(c, k)) return true;
      return false;
    } catch (e) { return false; }
  }
  function prepare(list) {
    try {
      if (!list || !list.length) return;
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        const key = clipKey(Array.isArray(it) ? it[0] + '|' + it[1] : String(it));
        if (key && prepQueue.indexOf(key) < 0) prepQueue.push(key);
      }
      runPrep();
    } catch (e) { /* ignore */ }
  }
  function runPrep() {
    if (prepBusy || !ctx || !unlocked || !prepQueue.length) return;
    prepBusy = true;
    const step = function () {
      const key = prepQueue.shift();
      if (!key || !ctx) { prepBusy = false; return; }
      loadClip(key).then(function () {
        if (prepQueue.length) idle(step); else prepBusy = false;
      });
    };
    idle(step);
  }

  /* ============================================================ switch */
  function setMuted(v) {
    try {
      v = !!v;
      if (v === muted) return muted;
      muted = v;
      writeMuted(v);
      log(v ? 'mute' : 'unmute');
      applyMute();
      emit();
    } catch (e) { /* ignore */ }
    return muted;
  }
  function applyMute() {
    clearTimeout(suspendTimer);
    if (!ctx || !fadeEnv) return;
    if (muted) {
      stopVoice();
      fadeEnv.go(fadePts(fadeEnv, ctx.currentTime, MUTE_FADE, 0));
      // Once silent, stop the audio thread altogether - unless a QA recording is tapping the output,
      // which needs the clock to keep running to stay in sync with the video.
      if (!tapNode) suspendTimer = setTimeout(function () { if (muted) suspend('muted'); }, (MUTE_FADE + 0.1) * 1000);
    } else if (unlocked) {
      if (!hidden()) resume();
      if (musicSrc) fadeEnv.go(fadePts(fadeEnv, ctx.currentTime, UNMUTE_FADE, 1));
      else startMusic();
    }
  }

  /* ============================================================ unlock */
  function unlock() {
    try {
      if (!AC) return false;
      let created = false;
      if (!ctx) {
        // Not after a click or key press yet (e.g. a #screen= debug jump on load): creating the context now would
        // only make Chrome print an autoplay warning. The next real gesture will do it.
        const ua = navigator.userActivation;
        if (ua && !ua.hasBeenActive && !qa.force) return false;
        if (!ensureCtx()) return false;
        created = true;
        kick();
      }
      if (!unlocked) {
        unlocked = true;
        log('unlock');
        runPrep();
      }
      if (muted) {
        // Muted before the first unlock: nothing is playing, park the context. (A mute that happens later
        // fades the music out first and then suspends - see applyMute - so don't cut that fade short here.)
        if (created && !tapNode) suspend('muted');
      } else {
        if (!hidden()) resume();
        startMusic();
      }
      return true;
    } catch (e) { return false; }
  }

  /* ============================================================ QA */
  function tap() {
    try {
      if (!ensureCtx() || !ctx.createMediaStreamDestination) return null;
      if (!tapNode) {
        tapNode = ctx.createMediaStreamDestination();
        master.connect(tapNode);
        log('tap');
      }
      return tapNode.stream;
    } catch (e) { return null; }
  }
  /** Read-only snapshot for tests. */
  function qaState() {
    const t = ctx ? ctx.currentTime : 0;
    return {
      context: ctx ? ctx.state : 'none', sampleRate: ctx ? ctx.sampleRate : 0, time: t,
      music: musicState, fade: fadeEnv ? fadeEnv.at(t) : 0, duck: duckEnv ? duckEnv.at(t) : 1, page: pageEnv ? pageEnv.at(t) : 1,
      musicGain: musicLevel ? musicLevel.gain.value : 0, voice: voice ? voice.key : null, cached: cache.size,
      loop: musicSrc ? [musicSrc.loopStart, musicSrc.loopEnd, musicSrc.buffer.duration] : null,
      queued: prepQueue.length, unlocked: unlocked, muted: muted,
    };
  }

  /* ============================================================ page life */
  // Turn the music's base64 into bytes while the page is idle after loading (no AudioContext needed), so the
  // first click only has to create the context and hand the bytes to the decoder.
  idle(function () {
    const M = window.VP_MUSIC;
    if (!musicBytes && !musicBuf && musicState === 'idle' && M && M.data) musicBytes = bytesOf(M.data);
  });
  document.addEventListener('visibilitychange', function () {
    if (!ctx || !pageEnv) return;
    clearTimeout(hideTimer);
    if (hidden()) {
      pageEnv.go([[ctx.currentTime + 0.08, 0]]);          // quick fade, then stop the audio thread
      hideTimer = setTimeout(function () { if (hidden()) suspend('hidden'); }, 150);
    } else {
      pageEnv.go([[ctx.currentTime + 0.35, 1]]);
      if (unlocked && !muted) resume();
    }
  });
  // Safari can leave the context suspended (other tab, device change, interruption): any later click or key
  // brings it back. This only resumes an already unlocked context - it never starts sound on its own.
  const onGesture = function () {
    if (ctx && unlocked && !muted && !hidden() && ctx.state !== 'running') resume();
  };
  ['pointerdown', 'keydown', 'touchend'].forEach(function (type) { window.addEventListener(type, onGesture, true); });
  // Another tab of the game flipped the switch.
  window.addEventListener('storage', function (e) {
    if (e && e.key === STORE_KEY && (e.newValue === '1') !== muted) {
      muted = e.newValue === '1';
      log(muted ? 'mute' : 'unmute', 'other-tab');
      applyMute();
      emit();
    }
  });

  /* ============================================================ API */
  VP.Audio = {
    unlock: unlock,
    say: say,
    stopVoice: stopVoice,
    hasVoices: hasVoices,
    prepare: prepare,
    isMuted: function () { return muted; },
    setMuted: setMuted,
    toggleMuted: function () { return setMuted(!muted); },
    onChange: function (fn) {
      if (typeof fn !== 'function') return noop;
      listeners.push(fn);
      return function () { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    },
    isUnlocked: function () { return unlocked; },
    musicInfo: function () {
      const M = window.VP_MUSIC;
      if (!M) return null;
      return { title: M.title || '', author: M.author || '', url: M.url || '', license: M.license || '', licenseUrl: M.licenseUrl || '', credit: M.credit || '' };
    },
    credits: function () {
      const out = [], M = window.VP_MUSIC, V = window.VP_VOICES;
      if (M && M.credit) out.push(String(M.credit));
      if (V && V.credit) out.push(String(V.credit));
      return out;
    },
    _qa: qa,
  };
  // game.js may read VP.Audio.musicCredit as a fallback for the credits line
  try { Object.defineProperty(VP.Audio, 'musicCredit', { enumerable: true, get: function () { const M = window.VP_MUSIC; return (M && M.credit) || ''; } }); } catch (e) { /* ignore */ }
})();
