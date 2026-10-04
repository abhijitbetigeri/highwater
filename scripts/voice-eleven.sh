#!/usr/bin/env bash
# asof — narration via the ElevenLabs TTS API. The primary voice path.
#
#   npm run voice                      default voice, George
#   ASOF_VOICE_ID=<id> npm run voice   any voice from the library
#
# Key resolution, first hit wins:
#   1. ELEVENLABS_API_KEY already in the environment
#   2. ./.env                      (this project)
#   3. ~/projects/mise/.env        (the CrossHaul key — scoped, TTS only)
#
# Writes voice/beat-N.mp3 and, when ffmpeg is present, voice/narration.mp3.
# Prints each beat's real duration so the pauses in src/cli/present.ts can be
# trued up against the actual read.

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/narration.sh
. scripts/narration.sh

if [ -z "${ELEVENLABS_API_KEY:-}" ] && [ -f .env ]; then
  set -a; . ./.env; set +a
fi
if [ -z "${ELEVENLABS_API_KEY:-}" ] && [ -f "$HOME/projects/mise/.env" ]; then
  set -a; . "$HOME/projects/mise/.env"; set +a
  echo "note: using the ElevenLabs key from ~/projects/mise/.env"
fi
: "${ELEVENLABS_API_KEY:?no ELEVENLABS_API_KEY — add it to .env}"

# "George" — calm, low-affect, reads as infrastructure rather than performance.
VOICE_ID="${ASOF_VOICE_ID:-JBFqnCBsd6RMkjVDRZzb}"
MODEL="${ASOF_TTS_MODEL:-eleven_multilingual_v2}"

mkdir -p voice
total=0

for i in 1 2 3 4 5 6; do
  text="${BEATS[$((i - 1))]}"
  out="voice/beat-$i.mp3"

  body=$(python3 - "$text" "$MODEL" <<'PY'
import json, sys
print(json.dumps({
    "text": sys.argv[1],
    "model_id": sys.argv[2],
    # High stability, zero style: this should sound like a system reporting,
    # not a voice actor selling.
    "voice_settings": {"stability": 0.65, "similarity_boost": 0.75, "style": 0.0},
}))
PY
  )

  code=$(curl -sS -X POST "https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}" \
    -H "xi-api-key: ${ELEVENLABS_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$body" \
    -w '%{http_code}' --output "$out")

  # curl writes the error JSON into the output file on failure.
  if [ "$code" != "200" ] || ! file "$out" | grep -qiE 'audio|mpeg'; then
    echo "FAILED on beat $i (HTTP $code) — the API returned:" >&2
    cat "$out" >&2
    rm -f "$out"
    exit 1
  fi

  secs=$(afinfo "$out" | awk '/estimated duration/ {print $3}')
  total=$(python3 -c "print($total + ${secs:-0})")
  printf '  beat %s  %6.1fs  %s\n' "$i" "${secs:-0}" "$out"
done

printf '\n  total   %6.1fs  (%s)\n\n' "$total" \
  "$(python3 -c "t=$total; print(f'{int(t//60)}:{t%60:04.1f}')")"

if command -v ffmpeg >/dev/null 2>&1; then
  : > voice/list.txt
  for i in 1 2 3 4 5 6; do echo "file 'beat-$i.mp3'" >> voice/list.txt; done
  ffmpeg -y -loglevel error -f concat -safe 0 -i voice/list.txt \
    -c copy voice/narration.mp3
  rm -f voice/list.txt
  echo "wrote voice/narration.mp3"
  echo
  echo "lay it over a screen recording with:"
  echo "  ffmpeg -i screen.mov -i voice/narration.mp3 \\"
  echo "    -c:v copy -c:a aac -shortest asof-demo.mp4"
else
  echo "no ffmpeg yet — per-beat files only. Install it and re-run to join them."
fi
