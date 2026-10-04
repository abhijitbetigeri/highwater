# Highwater — build plan

**A compute broker that decides where to run your job, on facts that are still true as of now.**

---

## The claim

Every external observation is a **dated fact with a half-life**, not prompt context.

Today's placement tools scrape pricing tables into a prompt and ask a model to reason over them. That means they cannot distinguish a price from twenty minutes ago from one from last quarter — same string, and the timestamp is gone by the time the model sees it. `asof` reads **decayed state** instead: for each kind of fact that matters to this decision, what is the current value, and how much do we still trust it?

Three mechanisms, each handling a failure the others cannot:

1. **Per-kind half-lives** — `price` at 6h, `capacity` at 12h, `interruption_rate` at 14d, `vram_ceiling` at 90d, `quota` pinned forever. One global window cannot hold both ends of that range.
2. **Pinned classes** — `quota`, `credential`, `policy`. Being wrong here is a hard failure, not a bad suggestion.
3. **Cross-kind overrides** — a live `outage` voids a provider's prices however fresh; a pinned `quota` suppresses a `capacity` reading that exceeds it. The dangerous failures cross kinds, and no per-kind half-life catches them because neither fact is stale.

Plus one honest limit, stated rather than papered over: **`step_time` and `vram_ceiling` are commit-scoped, not time-scoped.** A step time from the previous commit isn't stale, it's about a different program. Event invalidation sits outside the decay model; the half-life is only a backstop for driver and hardware drift.

---

## Why this isn't a price scraper

The scraping is commodity. Three things are not:

- **The probe.** A 60-second run on Fly that measures real VRAM high-water mark and seconds-per-step. The broker knows what the job *needs* before it places it, so it can say "this OOMs on a 24GB card at your current batch size" rather than ranking by price and hoping.
- **The decayed read.** Which is the part that makes the recommendation trustworthy rather than merely fast.
- **The failure corpus.** Every completed run writes back actual cost and duration against the estimate. That dataset — what things really cost versus what the pricing page claimed — is the only durable moat here. Nobody can scrape their way to it.

**No intake problem.** Unlike a memory agent that waits to be told things, every fact `asof` holds is machine-generated: source code, probe output, scraped pages, run history. Nobody has to write a diary.

---

## Phases

Ordered so that each phase ends at something demonstrable. Phase 0 and 1 together are the project; everything after is upside.

### Phase 0 — the offline demo (do this first, always)

**Goal:** `npm run demo` proves the thesis with no network, no key, no database, no model call.

- [ ] `fixtures/corpus.json` — ~20 facts about 3 providers and 2 workloads, 5 of them superseded, 1 live outage, 1 binding quota.
- [ ] `src/memory/decay.ts` — `recency × fit`, the override pass, the withheld record.
- [ ] `src/memory/retrieve.ts` — **state read, not search.** For each kind that matters to this decision, what is the current value? Decay decides within a kind.
- [ ] `src/placement/rank.ts` — cost/time frontier over surviving facts.
- [ ] `src/placement/draft.ts` — deterministic recommendation. A **pure function** of resolved state, so nobody can claim the improvement came from model sampling.
- [ ] `src/schema/events.ts` — frozen UI contract. The renderer cannot tell a live run from `fixtures/run.json`.
- [ ] `src/cli/demo.ts` — side-by-side: FLAT (one global window) vs ASOF (per-kind + pinned + overrides).

**The payoff to engineer for:** the flat run recommends a cheap box on a provider that is down, using a quota the account doesn't have. The asof run doesn't, and says what it withheld and why.

> This phase is why `still-here` demoed safely. Do not skip it and do not let the live paths land before it works.

### Phase 1 — the state read, for real

- [ ] Neon: apply `db/schema.sql`, seed `kind` from `halflife.ts`.
- [ ] `db/retrieve.sql` — the same three mechanisms in SQL, decay applied at query time, pgvector supplying the fit term over workload similarity.
- [ ] Prove parity: the SQL path and the TS path produce the same ranking on the same corpus. **This is the test that matters.**

### Phase 2 — the probe (the thing that makes it a broker)

- [ ] `src/cli/probe.ts` — ship the training script to a Fly machine, run N steps, capture peak VRAM and seconds-per-step, tear down.
- [ ] Write results as `vram_ceiling` / `step_time` / `checkpoint_size` facts, stamped with the code fingerprint.
- [ ] Extrapolate: wall-clock estimate, and an explicit "will not fit" verdict per SKU.

### Phase 3 — the market sensor

- [ ] Exa: crawl pricing and availability for 3 providers. Start with 3, not 12.
- [ ] **Every result becomes a dated fact in Neon**, kind `price` / `capacity`, never raw prompt context. This is the architectural point — don't shortcut it.
- [ ] Kernel: the pages with no API at all — quota, billing, capacity dashboards behind login. *Cut this first under pressure.*

### Phase 4 — act, and the inbox

- [ ] Executor: provider CLIs behind the gateway. **Reads autonomous, writes gated.** Provider keys never enter model context.
- [ ] Mastra: the workflow — `profile → observe → rank → recommend → launch → watch → escalate`. Use suspend/resume for the spend gate.
- [ ] AgentMail: outbound notification and reply-to-act.
  - *"Job 40% done, projected $23 against a $19 estimate. Cheaper H100 capacity just opened. Reply `migrate` and I'll checkpoint and move it."*
  - And the withheld case: *"I can't advise on spot — your interruption data is 40 days old, past its half-life. Tell me once and I'll pin it."*
- [ ] Run completion writes `actual_cost` / `actual_hours` back as facts. The loop closes here.

### Phase 5 — the demo surface

- [ ] assistant-ui chat surface.
- [ ] **The half-life slider.** Drag the window; watch the placement flip from spot-A100 to on-demand-H100, live, client-side. Handing someone the laptop to drag it themselves beats any narration.
- [ ] Neon branch replay: *"what would asof have decided last Tuesday?"* — a branch, not a time-travel query.

---

## Stack, and what each tool is actually for

| | role | cut? |
|---|---|---|
| **Neon** | the facts store; decay applied in SQL at query time; pgvector for the fit term; AI Gateway for models and embeddings; **branching as the what-if engine** | no — it's the spine |
| **Mastra** | agent runtime and workflow; observability is the proof surface — the trace shows which facts were trusted and which decayed out | no |
| **Fly.io** | the probe sandbox; Sprites as the per-job agent body, waking to re-check, idle between | no — the probe is the differentiator |
| **Exa** | market sensor: price and capacity pages → dated facts | no |
| **Executor** | tool gateway; reads autonomous, writes gated; credentials out of model context | keep the gate even if mocked |
| **AgentMail** | the broker's own inbox; notify out, commands back in | high value, low cost |
| **assistant-ui** | chat surface and the half-life controls | the slider is worth more than the chat |
| **Kernel** | the consoles with no API — quota, billing, capacity | **cut first** |

Cut order under time pressure: Kernel → migration execution (mock it, show the checkpoint-and-relaunch plan) → the fourth provider → the chat surface. **Never cut:** the probe, the decayed read, the slider. Those three are the project.

---

## Keys required

Full annotated list in [`.env.example`](.env.example). Summary:

**Needed for nothing** — `npm run demo` is offline by design. No key, no network, no database, no model call.

**Needed for the live paths:**

| phase | keys |
|---|---|
| 1 — state read | `DATABASE_URL`, `NEON_AI_GATEWAY_BASE_URL` + `NEON_AI_GATEWAY_API_KEY` |
| 2 — probe | `FLY_API_TOKEN`, `FLY_APP_NAME`, `FLY_ORG` |
| 3 — sensor | `EXA_API_KEY`, and `KERNEL_API_KEY` if you keep Kernel |
| 4 — act | `EXECUTOR_MCP_URL` + `EXECUTOR_API_KEY`, `AGENTMAIL_API_KEY` + `AGENTMAIL_INBOX_ID` + `OWNER_EMAIL` |
| 5 — replay | `DATABASE_URL_REPLAY` (a Neon branch) |
| provider placement | only the ones you actually place onto — `MODAL_TOKEN_ID`/`SECRET`, `LAMBDA_API_KEY`, `RUNPOD_API_KEY`, `HF_TOKEN`, `TOGETHER_API_KEY` |

Two gotchas carried over from previous builds:

- `NEON_AI_GATEWAY_BASE_URL` is a **bare host, no path** — append `/v1` yourself.
- Provider model ids through a gateway usually need the **provider prefix** (`anthropic/…`, `openai/…`). A bare model name 404s.

Mastra needs no key for local dev; `MASTRA_CLOUD_API_KEY` only for hosted traces.

---

## What this is not

Not a scheduler — it decides placement and hands off, it doesn't own the queue. Not a cost dashboard; the output is a decision, not a chart. Not a multi-cloud abstraction layer — it does not try to make providers look alike, it exploits the fact that they don't. And not useful to anyone on committed capacity: if you've pre-paid, there is no spread to find and `asof` has nothing to tell you.

---

## The honest risk

Arbitrage spreads narrow as markets mature, and customers churn precisely when they grow enough to sign reserved capacity — retention inversely coupled to customer success is a hard thing to own. SkyPilot is free and well-backed; Run:ai is inside NVIDIA.

So the defensible asset is **not** the savings. It's the decayed-fact layer and the accumulated record of what things actually cost versus what was advertised. Build toward that, and treat placement as the application that proves the layer is necessary.
