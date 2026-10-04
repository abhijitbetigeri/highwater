#!/usr/bin/env bash
# asof — generate the narration track with macOS `say`.
#
# Writes voice/beat-N.m4a for per-beat editing, plus voice/narration.m4a as one
# continuous track. Prints the real duration of each beat so the timings in
# src/cli/present.ts can be trued up against the actual read.
#
# This is the fallback. A human read is better; see NARRATION.md.

set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p voice

VOICE="${ASOF_VOICE:-Samantha}"
RATE="${ASOF_RATE:-160}"

beat() {
  local n="$1" text="$2"
  say -v "$VOICE" -r "$RATE" -o "voice/beat-$n.aiff" "$text"
  afconvert -f m4af -d aac "voice/beat-$n.aiff" "voice/beat-$n.m4a"
  local secs
  secs=$(afinfo "voice/beat-$n.m4a" | awk '/estimated duration/ {print $3}')
  printf '  beat %s  %6.1fs\n' "$n" "${secs:-0}"
  rm -f "voice/beat-$n.aiff"
}

echo "generating narration — voice: $VOICE, rate: $RATE wpm"

beat 1 "I train reinforcement learning policies across four compute providers, \
because no single one of them can give me all the capacity I need. So every job \
starts with the same question. Where do I run this, and what will it cost me? \
And every tool that answers it answers the cheap version of the question."

beat 2 "Here is a broker with one decay window for everything it knows. Thirty \
days, applied to every fact equally. It picks an A10 at twenty-eight cents an \
hour. Three dollars and nine cents. The cheapest option on the board. It is \
wrong twice. That provider is degraded right now — jobs are failing at container \
start. And the memory ceiling it used was measured on a different commit. The \
job needs thirty-eight gigabytes. That card has twenty-four. It dies at step \
two hundred."

beat 3 "The inputs don't age at the same rate. That's the whole problem. A spot \
price is meaningless six hours from now. Capacity, twelve. My account quota \
never expires at all. So the half-life is a property of the kind of fact, not a \
setting on the store. Second: some facts are pinned. Quota, credentials, \
standing policy. Being wrong about those isn't a bad suggestion, it's a hard \
failure. Third, and this is the one that matters: the dangerous failures cross \
kinds. A live outage and a fresh price never compete for the same slot, so no \
half-life catches that pair. Neither fact is stale. The broker needs to know \
that one voids the other."

beat 4 "Same twenty-one facts. Same instant. Nothing deleted, nothing edited. \
Now it picks an L40S — six dollars and forty-two cents, five point eight hours \
— and offers an H100 as the faster option at eight seventy-three in two point \
two. It dropped the A100 as dominated: slower and dearer than something else on \
the board. And the thirty-eight gigabyte ceiling is the one it used, because \
that's the only reading taken on the commit I'm actually running. The twenty-two \
gigabyte number isn't stale. It's void. It's about a different program."

beat 5 "This is the part I care about. It tells me what it withheld, and which \
mechanism withheld it. The superseded price. Both prices on the degraded \
provider. The capacity reading my quota caps. The spot instance my own policy \
forbids on a run this long. And one thing it refuses to answer at all: my spot \
interruption data is forty-one days old, past its fourteen-day half-life. So it \
asks, instead of guessing."

beat 6 "One last thing. A relevance search over the same facts returns six \
prices and no memory ceiling — because the fact that decides the whole question \
shares no vocabulary with the question. Decay can only re-rank what retrieval \
surfaced. So this doesn't search. It reads state. Same facts, same instant. The \
only thing that changed is which ones survived ranking."

# One continuous track. afconvert has no concat, so go via a CAF chain.
cat voice/beat-*.m4a > /dev/null 2>&1 || true
if command -v ffmpeg >/dev/null 2>&1; then
  : > voice/list.txt
  for n in 1 2 3 4 5 6; do echo "file 'beat-$n.m4a'" >> voice/list.txt; done
  ffmpeg -y -loglevel error -f concat -safe 0 -i voice/list.txt \
    -c copy voice/narration.m4a
  rm -f voice/list.txt
  echo
  echo "wrote voice/narration.m4a"
  echo
  echo "to lay it over a screen recording:"
  echo "  ffmpeg -i screen.mov -i voice/narration.m4a -c:v copy -c:a aac -shortest asof-demo.mp4"
else
  echo
  echo "wrote voice/beat-1..6.m4a"
  echo
  echo "no ffmpeg on this machine, so the per-beat files are not joined."
  echo "either:  brew install ffmpeg  && npm run voice     (writes narration.m4a)"
  echo "or:      drag voice/beat-*.m4a into iMovie alongside the screen recording"
fi
