# asof — 3 minute narration

~435 words at ~145 wpm. Six beats, timed to `npm run present`, which pauses for
exactly these durations so the terminal reveals in sync with the read.

Record with **⌘⇧5 → Record Selected Portion**, microphone on, and read this.
Your own voice beats any synthesiser. If you'd rather not, `npm run voice`
generates the track with `say` — see the bottom of this file.

---

## Beat 1 · the problem · 0:00 – 0:22 · 55 words

> I train reinforcement learning policies across four compute providers, because
> no single one of them can give me all the capacity I need.
>
> So every job starts with the same question. Where do I run this, and what will
> it cost me?
>
> And every tool that answers it answers the cheap version of the question.

## Beat 2 · the flat run · 0:22 – 0:50 · 68 words

> Here is a broker with one decay window for everything it knows. Thirty days,
> applied to every fact equally.
>
> It picks an A10 at twenty-eight cents an hour. Three dollars and nine cents.
> The cheapest option on the board.
>
> It is wrong twice. That provider is degraded right now — jobs are failing at
> container start. And the memory ceiling it used was measured on a different
> commit. The job needs thirty-eight gigabytes. That card has twenty-four.
>
> It dies at step two hundred.

## Beat 3 · the three mechanisms · 0:50 – 1:30 · 95 words

> The inputs don't age at the same rate. That's the whole problem.
>
> A spot price is meaningless six hours from now. Capacity, twelve. My account
> quota never expires at all. So the half-life is a property of the *kind* of
> fact, not a setting on the store.
>
> Second: some facts are pinned. Quota, credentials, standing policy. Being
> wrong about those isn't a bad suggestion, it's a hard failure.
>
> Third, and this is the one that matters: the dangerous failures cross kinds. A
> live outage and a fresh price never compete for the same slot, so no half-life
> catches that pair. Neither fact is stale. The broker needs to know that one
> voids the other.

## Beat 4 · the asof run · 1:30 – 2:05 · 85 words

> Same twenty-one facts. Same instant. Nothing deleted, nothing edited.
>
> Now it picks an L40S — six dollars and forty-two cents, five point eight hours
> — and offers an H100 as the faster option at eight seventy-three in two point
> two.
>
> It dropped the A100 as dominated: slower *and* dearer than something else on
> the board.
>
> And the thirty-eight gigabyte ceiling is the one it used, because that's the
> only reading taken on the commit I'm actually running. The twenty-two gigabyte
> number isn't stale. It's void. It's about a different program.

## Beat 5 · what it won't say · 2:05 – 2:35 · 72 words

> This is the part I care about.
>
> It tells me what it withheld, and which mechanism withheld it. The superseded
> price. Both prices on the degraded provider. The capacity reading my quota
> caps. The spot instance my own policy forbids on a run this long.
>
> And one thing it refuses to answer at all: my spot interruption data is
> forty-one days old, past its fourteen-day half-life. So it asks, instead of
> guessing.

## Beat 6 · the claim · 2:35 – 3:00 · 60 words

> One last thing. A relevance search over the same facts returns six prices and
> no memory ceiling — because the fact that decides the whole question shares no
> vocabulary with the question. Decay can only re-rank what retrieval surfaced.
> So this doesn't search. It reads state.
>
> Same facts, same instant. The only thing that changed is which ones survived
> ranking.

---

## Recording

```bash
npm run present          # paced reveal, auto-advances on the timings above
npm run present -- --manual   # advance on Enter instead, for a safer take
```

Then **⌘⇧5**, Record Selected Portion over the terminal, microphone on.

Terminal set-up that reads well on video: 110×45 or wider, 15–16pt font, and
run `clear` first.

## Synthesised voice

```bash
npm run voice        # ElevenLabs — voice/beat-N.mp3 + voice/narration.mp3
npm run voice:say    # macOS `say` fallback, no network
```

`npm run voice` uses ElevenLabs with **George** (`JBFqnCBsd6RMkjVDRZzb`) — calm
and low-affect, so it reads as a system reporting rather than a voice actor
selling. Override with `ASOF_VOICE_ID=<id>`.

Measured durations, which is what `src/cli/present.ts` is timed against:

| beat | 1 | 2 | 3 | 4 | 5 | 6 | total |
|---|---|---|---|---|---|---|---|
| ElevenLabs | 17.7 | 30.3 | 42.8 | 34.2 | 27.3 | 21.9 | **2:54** |
| `say` | 18.6 | 29.4 | 42.5 | 35.1 | 27.7 | 23.6 | 2:57 |

Key resolution, first hit wins: `ELEVENLABS_API_KEY` in the environment, then
`./.env`, then `~/projects/mise/.env`. A TTS-scoped key is enough — the script
never calls `/user`.

## Laying the voice over the recording

```bash
ffmpeg -i screen.mov -i voice/narration.mp3 \
  -c:v copy -c:a aac -shortest asof-demo.mp4
```

Record silently (no microphone), then mux. That way a fluffed line costs one
`ffmpeg` re-run instead of a whole take.

Shared narration text for both backends lives in `scripts/narration.sh`. Edit
the prose here and there together, or the track and the script drift.
