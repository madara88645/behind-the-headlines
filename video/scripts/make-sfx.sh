#!/bin/bash
# make-sfx.sh - generates the video's small sound-effect kit from maths (ffmpeg lavfi).
# No samples, no music, nothing downloaded: every sound is synthesised here, so there is no licence to worry about.
# Run from video/:  bash scripts/make-sfx.sh   (needs ffmpeg)
set -eu
cd "$(dirname "$0")/.."
OUT=public/sfx
mkdir -p "$OUT"
FF="ffmpeg -v error -y"

# Stamp / ≠ slam: a short sine whose pitch drops from ~95 Hz to 50 Hz, plus a tiny paper click.
$FF -f lavfi -i "aevalsrc='0.95*sin(2*PI*(50*t+(45/16)*(1-exp(-16*t))))*exp(-6.5*t)':s=48000:d=0.55" \
    -f lavfi -i "anoisesrc=d=0.04:c=white:a=0.5:r=48000" \
    -filter_complex "[1]highpass=f=1500,afade=t=out:st=0:d=0.04[c];[0][c]amix=inputs=2:normalize=0,alimiter=limit=0.95" \
    -ac 2 "$OUT/thump.wav"

# Bubble gulp: a rising "bloop".
$FF -f lavfi -i "aevalsrc='0.55*sin(2*PI*(280*t+620*(t-(1-exp(-22*t))/22)))*exp(-13*t)':s=48000:d=0.32" \
    -af "afade=t=in:d=0.005" -ac 2 "$OUT/pop.wav"

# UI tick: very short high click.
$FF -f lavfi -i "aevalsrc='0.35*sin(2*PI*2400*t)*exp(-110*t)':s=48000:d=0.06" -ac 2 "$OUT/tick.wav"

# Whoosh: band-limited pink noise with a soft swell.
$FF -f lavfi -i "anoisesrc=d=0.9:c=pink:a=0.5:r=48000" \
    -af "bandpass=f=900:width_type=o:w=2.2,volume=1.6,afade=t=in:d=0.38:curve=qsin,afade=t=out:st=0.42:d=0.48:curve=qsin" \
    -ac 2 "$OUT/whoosh.wav"

# Paper flick (Rigged sheet flip): short high noise burst.
$FF -f lavfi -i "anoisesrc=d=0.28:c=white:a=0.45:r=48000" \
    -af "highpass=f=2500,lowpass=f=9000,afade=t=in:d=0.05,afade=t=out:st=0.08:d=0.2" -ac 2 "$OUT/flick.wav"

# Wheel ratchet: a train of clicks that slows down (for the rigged wheel spin, ~2.3 s).
#   click rate r(t) = 2 + 22 e^(-1.1 t) per second; phase = integral of r (monotonic), one click per phase wrap.
$FF -f lavfi -i "aevalsrc='0.3*sin(2*PI*1800*t)*exp(-450*mod(2*t+20*(1-exp(-1.1*t)),1)/(2+22*exp(-1.1*t)))':s=48000:d=2.3" \
    -af "afade=t=out:st=1.9:d=0.4" -ac 2 "$OUT/ratchet.wav"

ls -la "$OUT"
