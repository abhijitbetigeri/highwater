/**
 * The recency term.
 *
 * Two modes, and the difference between them is the entire project:
 *
 *   flat  — one global half-life for every kind of fact. The thing any
 *           reasonable engineer builds first, and it cannot hold both an
 *           account quota and a spot price.
 *   asof  — the half-life is a property of the kind, safety-critical kinds are
 *           pinned, and commit-scoped facts are void outside their commit
 *           rather than merely old.
 */

import { KINDS, isPinned, recency, type FactKind } from './halflife.ts'
import type { Fact, Scored } from '../schema/events.ts'

/** The single window the flat baseline uses for everything. */
export const FLAT_HALF_LIFE_DAYS = 30

export const ageDays = (observedAt: string, now: string): number =>
  (new Date(now).getTime() - new Date(observedAt).getTime()) / 86_400_000

export const flatRecency = (age: number): number =>
  Math.pow(2, -age / FLAT_HALF_LIFE_DAYS)

export function scoreFlat(fact: Fact, now: string, fit: number): Scored {
  const age = ageDays(fact.observed_at, now)
  const rec = flatRecency(age)
  return { fact, ageDays: age, recency: rec, fit, score: fit * rec, pinned: false }
}

export function scoreAsof(fact: Fact, now: string, fit: number): Scored {
  const age = ageDays(fact.observed_at, now)
  const rec = recency(fact.kind, age)
  return {
    fact,
    ageDays: age,
    recency: rec,
    fit,
    score: fit * rec,
    pinned: isPinned(fact.kind),
  }
}

/**
 * A commit-scoped fact measured against a different commit is not stale — it is
 * about a different program. Age cannot express that, so it is filtered before
 * decay is ever applied.
 */
export function inScope(fact: Fact, fingerprint: string): boolean {
  if (KINDS[fact.kind].scope !== 'commit') return true
  if (!fact.code_fingerprint) return true
  return fact.code_fingerprint === fingerprint
}

/** True when the fact has decayed past its own half-life — below 50% trust. */
export const pastHalfLife = (s: Scored): boolean =>
  !s.pinned && s.recency < 0.5

export const halfLifeLabel = (kind: FactKind): string => {
  const hl = KINDS[kind].halfLifeDays
  if (hl === null) return 'pinned'
  if (hl < 1) return `${Math.round(hl * 24)}h`
  return `${hl}d`
}
