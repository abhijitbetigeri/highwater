# Highwater

**A compute broker that decides where to run your job — on facts that are still true as of now.**

**[▶ Watch the 3-minute demo](https://github.com/abhijitbetigeri/highwater/releases/tag/v0.1)**
 · **[Landing page](https://abhijitbetigeri.github.io/highwater/)**

```bash
npm install && npm run demo      # no API key, no database, no model call, no network
```

---

## The problem

You have four providers, none of which can give you all the capacity you need, and the decision of where to run the next job is made from four browser tabs and a vague memory of what spot cost last month.

Placement tools answer the cheap version of this question — *what is the lowest advertised price?* — and get it wrong three ways:

- **They don't know what the job needs.** Ranking by price is useless if the winner OOMs at step 200.
- **They can't tell a fresh fact from a stale one.** A price scraped twenty minutes ago and one from last quarter are the same string by the time a model reads them.
- **They have no memory of you.** Your account quota, your spot-interruption history, your standing rule about overnight runs — none of it enters the decision.

## Why it's hard

A broker that spends your money unsupervised must only act on facts that are still true. **A recommendation built on an expired fact is worse than no recommendation**, because you'll follow it.

And the inputs don't age at the same rate. Spot capacity is meaningless by tomorrow. An account quota never expires. A measured VRAM ceiling holds until the batch size changes — then it doesn't become stale, it becomes *void*. One decay window cannot hold that range, which is why the window is a property of the **kind**.

See [`src/memory/halflife.ts`](src/memory/halflife.ts) for the table, and [`PLAN.md`](PLAN.md) for the build.

## The shape of it

```
code + probe run  ──►  what this job NEEDS      (vram_ceiling, step_time)
Exa + Kernel      ──►  what the market OFFERS   (price, capacity, outage)
run history       ──►  what actually HAPPENED   (interruption_rate, actual cost)
owner             ──►  what always HOLDS        (quota, policy — pinned)
                            │
                            ▼
              decayed state read, as of now
                            │
                            ▼
        a placement, with what it stood on
        and what it withheld, and why
```

Nothing is deleted. Supersession is resolved at read time, in SQL — so a superseded price stays retrievable, it just loses.

## Stack

| | |
|---|---|
| **Neon** | Postgres facts store, pgvector, decay applied in SQL at query time; branches as the what-if engine; AI Gateway for models |
| **Fly.io** | the probe sandbox — a 60-second run that measures real VRAM high-water; Sprites as the per-job agent body |
| **Exa** | market sensor; every result lands as a dated fact, never raw prompt context |
| **Mastra** | agent runtime; observability as the proof surface — the trace *is* the evidence |
| **Executor** | tool gateway where policy derives from protocol: reads autonomous, writes gated. Credentials never enter model context |
| **AgentMail** | the broker's own inbox. Notifications out, `migrate` back in |
| **assistant-ui** | chat surface and the half-life controls |
| **Kernel** | the consoles with no API: quota, billing, capacity dashboards |

## The demo video

```bash
npm run present      # paced reveal, six beats, 2:54
npm run video        # rebuilds highwater-demo.mp4 from scratch
```

The video is generated from the program's own output rather than screen-captured:
`present --frames` dumps the real terminal state at each beat,
[`scripts/render_frames.py`](scripts/render_frames.py) rasterises it with the actual
ANSI colours, and each frame is held for exactly the length of its narration beat.
No recording permission, and identical every run.

Narration text lives once in [`scripts/narration.sh`](scripts/narration.sh), shared by
the ElevenLabs path (`npm run voice`) and the offline `say` fallback
(`npm run voice:say`), so the track and the script cannot drift apart. Prose copy of
record is [NARRATION.md](NARRATION.md).

`npm run video` needs a venv with Pillow and imageio-ffmpeg:

```bash
python3 -m venv ~/.hwvenv && ~/.hwvenv/bin/pip install Pillow imageio-ffmpeg
export HIGHWATER_VENV=~/.hwvenv
```

## What this is not

Not a scheduler — it decides placement and hands off. Not a cost dashboard; the output is a decision, not a chart. Not a multi-cloud abstraction — it doesn't make providers look alike, it exploits the fact that they don't. And nothing to offer anyone on committed capacity: if you've pre-paid, there's no spread to find.
