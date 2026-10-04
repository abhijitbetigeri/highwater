/**
 * asof — the offline demo.
 *
 * No network, no key, no database, no model call. Same 20 facts, same instant,
 * run twice: once with one global decay window, once with per-kind half-lives,
 * pinned classes, cross-kind overrides and commit scoping.
 */

import { writeFileSync } from 'node:fs'
import { FLAT_HALF_LIFE_DAYS, halfLifeLabel } from '../memory/decay.ts'
import { resolveAsof, resolveFlat, searchPath } from '../memory/retrieve.ts'
import { draft } from '../placement/draft.ts'
import corpusJson from '../../fixtures/corpus.json' with { type: 'json' }
import type { Corpus, Recommendation, Resolved } from '../schema/events.ts'

const corpus = corpusJson as unknown as Corpus

const D = '\x1b[2m'
const B = '\x1b[1m'
const R = '\x1b[31m'
const G = '\x1b[32m'
const Y = '\x1b[33m'
const X = '\x1b[0m'

const rule = (): void => console.log(D + '─'.repeat(98) + X)
const money = (n: number): string => `$${n.toFixed(2)}`

function head(title: string, sub: string): void {
  console.log(`\n${B}${title}${X}${D}  — ${sub}${X}`)
}

function showState(resolved: Resolved): void {
  for (const s of resolved.kept) {
    if (s.fact.kind === 'code_fingerprint') continue
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

function showRecommendation(rec: Recommendation, ok: boolean): void {
  const c = ok ? G : R
  if (!rec.pick) {
    console.log(`\n  ${R}no placement — nothing survived${X}`)
    return
  }
  const p = rec.pick
  console.log(
    `\n  ${c}${B}→ ${p.provider} / ${p.label}${X}${c}  ` +
      `${money(p.costUsd)}  ${p.hours.toFixed(1)}h  ` +
      `@ ${money(p.usdPerHour)}/hr ${p.market}${X}`,
  )
  for (const a of rec.alternatives) {
    console.log(
      `  ${D}  alt  ${a.provider} / ${a.label}  ${money(a.costUsd)}  ` +
        `${a.hours.toFixed(1)}h${X}`,
    )
  }
  for (const d of rec.dominated) {
    console.log(
      `  ${D}  dominated  ${d.provider} / ${d.label}  ${money(d.costUsd)}  ` +
        `${d.hours.toFixed(1)}h — slower and dearer than an option above${X}`,
    )
  }
}

// ── the two runs ─────────────────────────────────────────────────────────────

console.log(`\n${B}asof${X} ${D}— ${corpus.job.workload} @ ${corpus.job.code_fingerprint}`)
console.log(
  `  ${corpus.job.total_steps.toLocaleString()} steps · as of ${corpus.now}` +
    `\n  ${corpus.facts.length} facts about 3 providers, nothing deleted${X}`,
)

rule()
head('FLAT', `one global ${FLAT_HALF_LIFE_DAYS}d window for every kind of fact`)
const flat = resolveFlat(corpus)
const flatRec = draft(corpus, flat)
showState(flat)
console.log(
  `\n  ${R}ceiling in use: ${flat.vramCeilingGb}GB${X}` +
    `${D}  (highest-scoring vram_ceiling — age is the only tiebreak)${X}`,
)
showRecommendation(flatRec, false)
console.log(
  `\n  ${R}Both failures are live: runpod is degraded, and the 22GB ceiling was` +
    ` measured${X}\n  ${R}on commit 7b2e044 — a different program. The job needs` +
    ` 38GB.${X}`,
)

rule()
head('ASOF', 'half-life by kind, safety pinned, overrides live, commit-scoped')
const asof = resolveAsof(corpus)
const asofRec = draft(corpus, asof)
showState(asof)
console.log(
  `\n  ${G}ceiling in use: ${asof.vramCeilingGb}GB${X}` +
    `${D}  (only in-scope reading for ${asof.fingerprint})${X}`,
)
showRecommendation(asofRec, true)

console.log(`\n  ${Y}Not saying, because I can't stand behind it:${X}`)
for (const w of asofRec.withheld) {
  console.log(`  ${Y}  · ${w.kind}: ${w.wouldHaveSaid}${X}`)
  console.log(`  ${D}      ${w.reason}${X}`)
}
for (const e of asofRec.excluded) {
  console.log(`  ${Y}  · excluded ${e.provider}/${e.sku} — ${e.why}${X}`)
}
for (const a of asofRec.asks) {
  console.log(`\n  ${Y}  ? ${a}${X}`)
}

// ── why a state read, and not a search ───────────────────────────────────────

rule()
head('A SEARCH WOULD NOT HAVE FOUND IT', `"${corpus.job.query}"`)
const search = searchPath(corpus)
for (const s of search) {
  console.log(
    `  ${s.fact.kind.padEnd(18)} rel ${s.fit.toFixed(2)}  ` +
      `trust ${s.recency.toFixed(3)}  ${D}${s.fact.text.slice(0, 58)}${X}`,
  )
}
const foundCeiling = search.some((s) => s.fact.kind === 'vram_ceiling')
console.log(
  `\n  ${foundCeiling ? G : R}vram_ceiling in the candidate set: ` +
    `${foundCeiling ? 'yes' : 'no'}${X}`,
)
console.log(
  `  ${D}The fact that decides the question shares no vocabulary with it.` +
    ` Decay can\n  only re-rank what relevance surfaced — so the state read` +
    ` does not use relevance.${X}`,
)

rule()
console.log(`\n${B}the claim${X}`)
console.log(
  `  Same ${corpus.facts.length} facts. Same instant. Nothing deleted,` +
    ` nothing edited.\n  The only thing that changed is which of them survived` +
    ` ranking — and that is\n  the difference between ${money(flatRec.pick?.costUsd ?? 0)}` +
    ` that dies at step 200 and ${money(asofRec.pick?.costUsd ?? 0)} that finishes.\n`,
)

if (process.argv.includes('--record')) {
  const runs = [
    { mode: 'flat', resolved: flat, recommendation: flatRec },
    { mode: 'asof', resolved: asof, recommendation: asofRec },
  ]
  writeFileSync('fixtures/run.json', JSON.stringify(runs, null, 2))
  console.log(`${D}  wrote fixtures/run.json${X}\n`)
}
