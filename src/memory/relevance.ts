/**
 * Offline lexical proxy for the relevance term.
 *
 * Stated plainly as a proxy rather than dressed up as semantic search: the claim
 * this project makes is about the RECENCY term, and the demo must be runnable
 * with no network and no model call. In production this is a real cosine
 * distance from pgvector (see db/retrieve.sql).
 *
 * IDF-weighted overlap, so that "hourly" and "rate" — which appear in most
 * price facts — count for less than "spot" or "VRAM".
 */

import type { Fact } from '../schema/events.ts'

const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'is',
  'it', 'i', 'my', 'me', 'should', 'where', 'run', 'now', 'over', 'with',
])

const tokenize = (s: string): string[] =>
  s
    .toLowerCase()
    .split(/[^a-z0-9.]+/)
    .filter((t) => t.length > 1 && !STOP.has(t))

/** Inverse document frequency across the corpus. */
export function buildIdf(facts: Fact[]): Map<string, number> {
  const df = new Map<string, number>()
  for (const f of facts) {
    for (const t of new Set(tokenize(f.text))) {
      df.set(t, (df.get(t) ?? 0) + 1)
    }
  }
  const n = facts.length
  const idf = new Map<string, number>()
  for (const [t, d] of df) idf.set(t, Math.log(1 + n / d))
  return idf
}

/** Unnormalised IDF-weighted overlap between a query and a fact's text. */
export function relevance(
  query: string,
  fact: Fact,
  idf: Map<string, number>,
): number {
  const q = new Set(tokenize(query))
  let sum = 0
  for (const t of new Set(tokenize(fact.text))) {
    if (q.has(t)) sum += idf.get(t) ?? 0
  }
  return sum
}
