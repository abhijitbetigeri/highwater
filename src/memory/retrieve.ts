/**
 * The state read.
 *
 * Not a search. Asking for "the six most relevant facts to where should I run
 * this" lets the fact that decides the whole question — the VRAM ceiling — fall
 * out of the candidate set, because it shares no vocabulary with the question.
 * Decay can only re-rank what relevance surfaced, so a retrieval miss upstream
 * silently defeats the mechanism.
 *
 * So: for each kind that matters, what is the current value? Decay decides
 * within each kind. No dependence on the relevance term at all.
 *
 * `searchPath` below exists only to demonstrate that failure, side by side.
 */

import { OVERRIDES, type FactKind } from './halflife.ts'
import {
  ageDays,
  halfLifeLabel,
  inScope,
  scoreAsof,
  scoreFlat,
} from './decay.ts'
import { buildIdf, relevance } from './relevance.ts'
import type { Corpus, Fact, Resolved, Scored, Withheld } from '../schema/events.ts'

/** The slot a fact competes in. Facts in different slots never supersede. */
const slotOf = (f: Fact): string =>
  [f.provider ?? 'global', f.sku ?? 'any'].join(':')

/** A suppressor is live while it has not decayed past half its trust. */
const isLive = (s: Scored): boolean => s.pinned || s.recency >= 0.5

interface Mode {
  score: (f: Fact, now: string) => Scored
  scoped: boolean
  overrides: boolean
}

function resolve(corpus: Corpus, mode: Mode): Resolved {
  const { now, job } = corpus
  const withheld: Withheld[] = []

  // 1 · commit scope, before decay is applied at all.
  let pool = corpus.facts
  if (mode.scoped) {
    pool = corpus.facts.filter((f) => {
      if (inScope(f, job.code_fingerprint)) return true
      withheld.push({
        kind: f.kind,
        factId: f.id,
        reason:
          `measured on commit ${f.code_fingerprint}, current is ` +
          `${job.code_fingerprint} — void, not stale`,
        wouldHaveSaid: f.text,
      })
      return false
    })
  }

  // 2 · one winner per (kind, slot). Losers are recorded, never deleted.
  const best = new Map<string, Scored>()
  for (const f of pool) {
    const key = `${f.kind}|${slotOf(f)}`
    const s = mode.score(f, now)
    const held = best.get(key)
    if (!held || s.score > held.score) {
      if (held) {
        withheld.push({
          kind: held.fact.kind,
          factId: held.fact.id,
          reason:
            `superseded by a fresher ${held.fact.kind} ` +
            `(${halfLifeLabel(held.fact.kind)} half-life, this one is ` +
            `${held.ageDays.toFixed(1)}d old)`,
          wouldHaveSaid: held.fact.text,
        })
      }
      best.set(key, s)
    } else {
      withheld.push({
        kind: f.kind,
        factId: f.id,
        reason:
          `superseded by a fresher ${f.kind} ` +
          `(${halfLifeLabel(f.kind)} half-life, this one is ` +
          `${s.ageDays.toFixed(1)}d old)`,
        wouldHaveSaid: f.text,
      })
    }
  }

  let kept = [...best.values()]

  // 3 · cross-kind overrides. The dangerous failures cross kinds: neither fact
  //     is stale and they never compete for the same slot, so no per-kind
  //     half-life catches them.
  if (mode.overrides) {
    const suppressed = new Set<Scored>()
    for (const ov of OVERRIDES) {
      const live = kept.filter((s) => s.fact.kind === ov.when && isLive(s))
      for (const sup of live) {
        for (const target of kept) {
          if (suppressed.has(target)) continue
          if (!ov.suppresses.includes(target.fact.kind)) continue
          if (
            ov.scopeBy === 'provider' &&
            target.fact.provider !== sup.fact.provider
          ) {
            continue
          }
          // `policy` suppression depends on computed wall-clock, so it is
          // applied in placement/rank.ts where the hours are known.
          if (ov.when === 'policy') continue
          suppressed.add(target)
          withheld.push({
            kind: target.fact.kind,
            factId: target.fact.id,
            reason:
              `overridden by a live ${sup.fact.kind} ` +
              `(${sup.ageDays.toFixed(1)}d ago, trust ${sup.recency.toFixed(2)})` +
              `${sup.fact.provider ? ` on ${sup.fact.provider}` : ''}`,
            wouldHaveSaid: target.fact.text,
          })
        }
      }
    }
    kept = kept.filter((s) => !suppressed.has(s))
  }

  // 4 · the two derived numbers the placement needs.
  const ceiling = kept.find((s) => s.fact.kind === 'vram_ceiling')
  const stepTime = kept.find((s) => s.fact.kind === 'step_time')
  const baseHours = stepTime
    ? ((stepTime.fact.value.seconds as number) * job.total_steps) / 3600
    : null

  return {
    kept: kept.sort((a, b) => b.score - a.score),
    withheld,
    vramCeilingGb: ceiling ? (ceiling.fact.value.gb as number) : null,
    baseHours,
    fingerprint: job.code_fingerprint,
  }
}

/** One global window. No pinning, no overrides, no commit scoping. */
export const resolveFlat = (corpus: Corpus): Resolved =>
  resolve(corpus, {
    score: (f, now) => scoreFlat(f, now, 1),
    scoped: false,
    overrides: false,
  })

/** Per-kind half-lives, pinned classes, cross-kind overrides, commit scoping. */
export const resolveAsof = (corpus: Corpus): Resolved =>
  resolve(corpus, {
    score: (f, now) => scoreAsof(f, now, 1),
    scoped: true,
    overrides: true,
  })

/**
 * What a relevance-then-decay search would have surfaced. Here to show that the
 * state read was necessary: the VRAM ceiling never enters the candidate set.
 */
export function searchPath(corpus: Corpus, topN = 6): Scored[] {
  const idf = buildIdf(corpus.facts)
  return corpus.facts
    .map((f) => scoreAsof(f, corpus.now, relevance(corpus.job.query, f, idf)))
    // A real retriever returns matches, not the whole corpus sorted. Facts with
    // no overlap never enter the candidate set at all — which is the point.
    .filter((s) => s.fit > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
}

export { ageDays }
export type { FactKind }
