#!/usr/bin/env bash
# Build the 3-minute demo video from the program's own output.
#
# No screen recording: `present --frames` dumps the real terminal state at each
# beat, render_frames.py rasterises it, and each frame is held for exactly as
# long as its narration beat. Deterministic, and needs no capture permission.
#
#   npm run video
#
# Requires: the venv at $VENV (Pillow + imageio-ffmpeg) and voice/beat-*.mp3.

set -euo pipefail
cd "$(dirname "$0")/.."

VENV="${HIGHWATER_VENV:-/tmp/hwvenv}"
PY="$VENV/bin/python"
OUT="${1:-highwater-demo.mp4}"

[ -x "$PY" ] || { echo "no venv at $VENV — see scripts/README"; exit 1; }
FFMPEG=$("$PY" -c "import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())")

echo "1/4  capturing frames from the real program"
npx tsx src/cli/present.ts --frames >/dev/null

echo "2/4  rasterising"
"$PY" scripts/render_frames.py

echo "3/4  joining narration"
: > /tmp/hw-audio.txt
for i in 1 2 3 4 5 6; do
  echo "file '$PWD/voice/beat-$i.mp3'" >> /tmp/hw-audio.txt
done
"$FFMPEG" -y -loglevel error -f concat -safe 0 -i /tmp/hw-audio.txt \
  -c copy voice/narration.mp3

echo "4/4  encoding"
# Each frame is held for exactly its beat's narration length.
: > /tmp/hw-video.txt
for i in 1 2 3 4 5 6; do
  secs=$(afinfo "voice/beat-$i.mp3" | awk '/estimated duration/ {print $3}')
  echo "file '$PWD/frames/beat-$i.png'" >> /tmp/hw-video.txt
  echo "duration $secs" >> /tmp/hw-video.txt
done
# The concat demuxer ignores the final entry's duration, so repeat the last.
echo "file '$PWD/frames/beat-6.png'" >> /tmp/hw-video.txt

# Cap the video at the narration length — the repeated frame would otherwise
# add its default duration and push the runtime past three minutes.
TOTAL=$(for i in 1 2 3 4 5 6; do
  afinfo "voice/beat-$i.mp3" | awk '/estimated duration/ {print $3}'
done | awk '{s+=$1} END {printf "%.2f", s}')

"$FFMPEG" -y -loglevel error \
  -f concat -safe 0 -i /tmp/hw-video.txt \
  -i voice/narration.mp3 \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 160k -shortest -t "$TOTAL" \
  "$OUT"

rm -f /tmp/hw-video.txt /tmp/hw-audio.txt
dur=$("$FFMPEG" -i "$OUT" 2>&1 | awk -F'[ ,]' '/Duration/ {print $4}')
printf '\nwrote %s  (%s)\n' "$OUT" "$dur"
