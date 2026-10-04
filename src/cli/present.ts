/**
 * asof — paced presentation mode.
 *
 * Same computation as `npm run demo`, revealed in six beats whose durations
 * match NARRATION.md, so the terminal cannot drift out of sync with the read.
 *
 *   npm run present              auto-advance on the narration timings
 *   npm run present -- --manual  advance on Enter (safer for a live take)
 */

import { createInterface } from 'node:readline/promises'
import { FLAT_HALF_LIFE_DAYS, halfLifeLabel } from '../memory/decay.ts'
import { resolveAsof, resolveFlat, searchPath } from '../memory/retrieve.ts'
import { draft } from '../placement/draft.ts'
import corpusJson from '../../fixtures/corpus.json' with { type: 'json' }
import type { Corpus, Recommendation, Resolved } from '../schema/events.ts'

const corpus = corpusJson as unknown as Corpus
const MANUAL = process.argv.includes('--manual')

const D = '\x1b[2m'
const B = '\x1b[1m'
const R = '\x1b[31m'
const G = '\x1b[32m'
const Y = '\x1b[33m'
const X = '\x1b[0m'

const money = (n: number): string => `$${n.toFixed(2)}`
const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms))

/** ASOF_SPEED=10 runs the whole thing 10× faster, for checking the layout. */
const SPEED = Number(process.env.ASOF_SPEED ?? 1) || 1

const rl = MANUAL
  ? createInterface({ input: process.stdin, output: process.stdout })
  : null

async function beat(seconds: number): Promise<void> {
  if (rl) {
    await rl.question(`${D}    ⏎${X}`)
    return
  }
  await sleep((seconds * 1000) / SPEED)
}

function state(resolved: Resolved, only?: string[]): void {
  for (const s of resolved.kept) {
    if (s.fact.kind === 'code_fingerprint') continue
    if (only && !only.includes(s.fact.kind)) continue
    const tag = s.pinned ? `${G} PIN ${X}` : '      '
    const hl = s.pinned ? 'pinned' : halfLifeLabel(s.fact.kind)
    const slot = [s.fact.provider, s.fact.sku].filter(Boolean).join('/') || '—'
    console.log(
      `${tag} ${s.fact.kind.padEnd(18)} ${slot.padEnd(22)}` +
        `${s.ageDays.toFixed(1).padStart(6)}d  hl ${hl.padStart(6)}  ` +
        `trust ${s.recency.toFixed(3)}`,
    )
  }
}

function pick(rec: Recommendation, ok: boolean): void {
  const c = ok ? G : R
  if (!rec.pick) return
  const p = rec.pick
  console.log(
    `\n  ${c}${B}→ ${p.provider} / ${p.label}${X}${c}  ${money(p.costUsd)}  ` +
      `${p.hours.toFixed(1)}h  @ ${money(p.usdPerHour)}/hr ${p.market}${X}`,
  )
  for (const a of rec.alternatives) {
    console.log(
      `  ${D}  alt        ${a.provider} / ${a.label}  ${money(a.costUsd)}  ` +
        `${a.hours.toFixed(1)}h${X}`,
    )
  }
  for (const d of rec.dominated) {
    console.log(
      `  ${D}  dominated  ${d.provider} / ${d.label}  ${money(d.costUsd)}  ` +
        `${d.hours.toFixed(1)}h — slower and dearer${X}`,
    )
  }
}

const flat = resolveFlat(corpus)
const flatRec = draft(corpus, flat)
const asof = resolveAsof(corpus)
const asofRec = draft(corpus, asof)

console.clear()

// ── beat 1 · the problem · 22s ───────────────────────────────────────────────
console.log(`\n${B}asof${X}${D} — where should this job run?${X}\n`)
console.log(`  ${corpus.job.workload} @ ${corpus.job.code_fingerprint}`)
console.log(`  ${corpus.job.total_steps.toLocaleString()} steps`)
console.log(`  ${D}3 providers · ${corpus.facts.length} facts · as of ${corpus.now}${X}`)
await beat(18)  // voice: 17.7s

// ── beat 2 · the flat run · 28s ──────────────────────────────────────────────
console.log(`\n${B}ONE WINDOW FOR EVERYTHING${X}${D}  — ${FLAT_HALF_LIFE_DAYS}d, every kind of fact${X}`)
console.log(`  ${R}ceiling in use: ${flat.vramCeilingGb}GB${X}`)
pick(flatRec, false)
console.log(`\n  ${R}runpod is degraded right now — jobs failing at container start${X}`)
console.log(`  ${R}22GB was measured on commit 7b2e044. This job needs 38GB.${X}`)
console.log(`  ${R}${B}It dies at step 200.${X}`)
await beat(31)  // voice: 30.3s

// ── beat 3 · the mechanisms · 40s ────────────────────────────────────────────
console.log(`\n${B}THE INPUTS DON'T AGE AT THE SAME RATE${X}`)
console.log(`  ${D}price 6h · capacity 12h · interruption 14d · vram 90d · quota pinned${X}\n`)
console.log(`  1 ${D}half-life is a property of the KIND${X}`)
console.log(`  2 ${D}quota, credentials, policy are PINNED — wrong there is a hard failure${X}`)
console.log(`  3 ${D}the dangerous failures CROSS KINDS — neither fact is stale${X}`)
await beat(43)  // voice: 42.8s

// ── beat 4 · the asof run · 35s ──────────────────────────────────────────────
console.log(`\n${B}ASOF${X}${D}  — per-kind, pinned, overrides live, commit-scoped${X}`)
state(asof, ['quota', 'policy', 'outage', 'vram_ceiling', 'price'])
console.log(`\n  ${G}ceiling in use: ${asof.vramCeilingGb}GB${X}${D}  (only reading on ${asof.fingerprint})${X}`)
pick(asofRec, true)
await beat(35)  // voice: 34.2s

// ── beat 5 · what it won't say · 30s ─────────────────────────────────────────
console.log(`\n  ${Y}${B}Not saying, because I can't stand behind it:${X}`)
for (const w of asofRec.withheld) {
  console.log(`  ${Y}  · ${w.kind}: ${w.wouldHaveSaid}${X}`)
  console.log(`  ${D}      ${w.reason}${X}`)
}
for (const e of asofRec.excluded) {
  console.log(`  ${Y}  · excluded ${e.provider}/${e.sku} — ${e.why}${X}`)
}
for (const a of asofRec.asks) console.log(`\n  ${Y}  ? ${a}${X}`)
await beat(28)  // voice: 27.3s

// ── beat 6 · the claim · 25s ─────────────────────────────────────────────────
console.log(`\n${B}A SEARCH WOULD NOT HAVE FOUND IT${X}${D}  — "${corpus.job.query}"${X}`)
const search = searchPath(corpus)
for (const s of search) {
  console.log(
    `  ${s.fact.kind.padEnd(16)} rel ${s.fit.toFixed(2)}  ` +
      `${D}${s.fact.text.slice(0, 54)}${X}`,
  )
}
console.log(`\n  ${R}vram_ceiling in the candidate set: no${X}`)
console.log(`  ${D}Decay can only re-rank what retrieval surfaced. So this reads state.${X}`)
console.log(`\n${B}  Same ${corpus.facts.length} facts. Same instant. Nothing deleted.${X}`)
console.log(
  `${B}  ${money(flatRec.pick?.costUsd ?? 0)} that dies at step 200` +
    `  ·  ${money(asofRec.pick?.costUsd ?? 0)} that finishes.${X}\n`,
)
await beat(22)  // voice: 21.9s

rl?.close()
