/**
 * The cost/time frontier over surviving facts.
 *
 * Two filters live here rather than in the state read, because both need a
 * computed wall-clock that the facts alone do not carry:
 *
 *   fit    — a SKU below the measured VRAM ceiling is not a cheap option, it is
 *            a job that dies at step 200.
 *   policy — "no spot over 4 hours" can only be evaluated once hours are known.
 */

import type {
  Candidate,
  Corpus,
  Market,
  Resolved,
  Withheld,
} from '../schema/events.ts'

export interface Ranked {
  candidates: Candidate[]
  excluded: { provider: string; sku: string; why: string }[]
  withheld: Withheld[]
}

export function rank(corpus: Corpus, resolved: Resolved): Ranked {
  const excluded: Ranked['excluded'] = []
  const withheld: Withheld[] = []
  const candidates: Candidate[] = []

  const policy = resolved.kept.find((s) => s.fact.kind === 'policy')
  const maxSpotHours =
    policy && policy.fact.value.rule === 'no_spot_over_hours'
      ? (policy.fact.value.hours as number)
      : null

  for (const s of resolved.kept) {
    if (s.fact.kind !== 'price') continue
    const { provider, sku } = s.fact
    if (!provider || !sku) continue

    const spec = corpus.skus[sku]
    if (!spec) continue

    const usdPerHour = s.fact.value.usd_per_hour as number
    const market = (s.fact.value.market as Market) ?? 'on-demand'

    // fit — the ceiling is measured on the current commit, or absent.
    if (resolved.vramCeilingGb !== null && spec.vram_gb < resolved.vramCeilingGb) {
      excluded.push({
        provider,
        sku,
        why:
          `${spec.label} has ${spec.vram_gb}GB, job needs ` +
          `${resolved.vramCeilingGb}GB — would die at step 200`,
      })
      continue
    }

    if (resolved.baseHours === null) {
      excluded.push({
        provider,
        sku,
        why: 'no step-time measurement in scope — cannot estimate wall-clock',
      })
      continue
    }

    const hours = resolved.baseHours / spec.rel_perf

    // policy — pinned, so it outranks any price.
    if (market === 'spot' && maxSpotHours !== null && hours > maxSpotHours) {
      withheld.push({
        kind: 'price',
        factId: s.fact.id,
        reason:
          `overridden by a pinned policy: no spot over ${maxSpotHours}h, ` +
          `this run is ${hours.toFixed(1)}h`,
        wouldHaveSaid: s.fact.text,
      })
      continue
    }

    candidates.push({
      provider,
      sku,
      label: spec.label,
      usdPerHour,
      market,
      hours,
      costUsd: usdPerHour * hours,
      standsOn: [s.fact.id],
    })
  }

  candidates.sort((a, b) => a.costUsd - b.costUsd)
  return { candidates, excluded, withheld }
}

/** Dominated = another candidate is at least as cheap AND at least as fast. */
export function frontier(candidates: Candidate[]): {
  keep: Candidate[]
  dominated: Candidate[]
} {
  const keep: Candidate[] = []
  const dominated: Candidate[] = []
  for (const c of candidates) {
    const beaten = candidates.some(
      (o) =>
        o !== c &&
        o.costUsd <= c.costUsd &&
        o.hours <= c.hours &&
        (o.costUsd < c.costUsd || o.hours < c.hours),
    )
    ;(beaten ? dominated : keep).push(c)
  }
  return { keep, dominated }
}
