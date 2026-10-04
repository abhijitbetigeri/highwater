/**
 * The recommendation — a PURE FUNCTION of the resolved state.
 *
 * Deliberately: no model call anywhere on this path, so nobody can claim the
 * improvement came from sampling. Same 20 facts, same instant, nothing deleted
 * and nothing edited. The only thing that changed between the two runs is which
 * facts survived ranking.
 */

import { halfLifeLabel, pastHalfLife } from '../memory/decay.ts'
import { frontier, rank } from './rank.ts'
import type { Corpus, Recommendation, Resolved } from '../schema/events.ts'

export function draft(corpus: Corpus, resolved: Resolved): Recommendation {
  const ranked = rank(corpus, resolved)
  const { keep, dominated } = frontier(ranked.candidates)

  const pick = keep[0] ?? null
  const alternatives = keep.slice(1)

  // The broker is allowed to say less than it knows. A fact that has decayed
  // past its own half-life is not used silently — it becomes a question.
  const asks: string[] = []
  for (const s of resolved.kept) {
    if (!pastHalfLife(s)) continue
    asks.push(
      `I can't stand behind the ${s.fact.kind} for ` +
        `${s.fact.provider ?? 'this account'} — ${s.ageDays.toFixed(0)}d old, ` +
        `past its ${halfLifeLabel(s.fact.kind)} half-life ` +
        `(trust ${s.recency.toFixed(2)}). Tell me once and I'll pin it.`,
    )
  }

  return {
    pick,
    alternatives,
    dominated,
    excluded: ranked.excluded,
    withheld: [...resolved.withheld, ...ranked.withheld],
    asks,
  }
}
