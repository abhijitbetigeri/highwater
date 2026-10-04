#!/usr/bin/env bash
# The narration text, in one place, sourced by both voice backends so the
# ElevenLabs track and the `say` fallback can never drift apart.
#
# Prose copy of record: NARRATION.md. Keep them in step.
#
# Em-dashes are written as commas here on purpose: TTS reads a comma as a beat
# and an em-dash as nothing.

BEAT_1="I train reinforcement learning policies across four compute providers, because no single one of them can give me all the capacity I need. So every job starts with the same question. Where do I run this, and what will it cost me? And every tool that answers it answers the cheap version of the question."

BEAT_2="Here is a broker with one decay window for everything it knows. Thirty days, applied to every fact equally. It picks an A10 at twenty-eight cents an hour. Three dollars and nine cents. The cheapest option on the board. It is wrong twice. That provider is degraded right now, jobs are failing at container start. And the memory ceiling it used was measured on a different commit. The job needs thirty-eight gigabytes. That card has twenty-four. It dies at step two hundred."

BEAT_3="The inputs don't age at the same rate. That's the whole problem. A spot price is meaningless six hours from now. Capacity, twelve. My account quota never expires at all. So the half-life is a property of the kind of fact, not a setting on the store. Second: some facts are pinned. Quota, credentials, standing policy. Being wrong about those isn't a bad suggestion, it's a hard failure. Third, and this is the one that matters: the dangerous failures cross kinds. A live outage and a fresh price never compete for the same slot, so no half-life catches that pair. Neither fact is stale. The broker needs to know that one voids the other."

BEAT_4="Same twenty-one facts. Same instant. Nothing deleted, nothing edited. Now it picks an L40S, six dollars and forty-two cents, five point eight hours, and offers an H100 as the faster option at eight seventy-three in two point two. It dropped the A100 as dominated: slower and dearer than something else on the board. And the thirty-eight gigabyte ceiling is the one it used, because that's the only reading taken on the commit I'm actually running. The twenty-two gigabyte number isn't stale. It's void. It's about a different program."

BEAT_5="This is the part I care about. It tells me what it withheld, and which mechanism withheld it. The superseded price. Both prices on the degraded provider. The capacity reading my quota caps. The spot instance my own policy forbids on a run this long. And one thing it refuses to answer at all: my spot interruption data is forty-one days old, past its fourteen-day half-life. So it asks, instead of guessing."

BEAT_6="One last thing. A relevance search over the same facts returns six prices and no memory ceiling, because the fact that decides the whole question shares no vocabulary with the question. Decay can only re-rank what retrieval surfaced. So this doesn't search. It reads state. Same facts, same instant. The only thing that changed is which ones survived ranking."

BEATS=("$BEAT_1" "$BEAT_2" "$BEAT_3" "$BEAT_4" "$BEAT_5" "$BEAT_6")
