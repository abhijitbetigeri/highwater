/**
 * The frozen contract.
 *
 * Everything the renderer shows arrives as one of these. The renderer cannot
 * tell a live run from fixtures/run.json, which is what lets the live paths
 * land later without any risk to the demo.
 */

import type { FactKind } from '../memory/halflife.ts'

export type Market = 'on-demand' | 'spot'

export interface Fact {
  id: string
  kind: FactKind
  provider?: string
  sku?: string
  workload?: string
  code_fingerprint?: string
  value: Record<string, unknown>
  observed_at: string
  source: 'exa' | 'kernel' | 'probe' | 'owner' | 'run'
  text: string
}

export interface Sku {
  vram_gb: number
  rel_perf: number
  label: string
}

export interface Job {
  workload: string
  code_fingerprint: string
  total_steps: number
  query: string
}

export interface Corpus {
  now: string
  job: Job
  skus: Record<string, Sku>
  facts: Fact[]
}

/** A fact with its decay applied. */
export interface Scored {
  fact: Fact
  ageDays: number
  recency: number
  fit: number
  score: number
  pinned: boolean
}

/** A fact that was deliberately not used, and why. Never deleted. */
export interface Withheld {
  kind: FactKind
  factId: string
  reason: string
  wouldHaveSaid: string
}

export interface Candidate {
  provider: string
  sku: string
  label: string
  usdPerHour: number
  market: Market
  hours: number
  costUsd: number
  standsOn: string[]
}

export interface Resolved {
  kept: Scored[]
  withheld: Withheld[]
  /** null when no in-scope ceiling survived — the broker then cannot filter on fit. */
  vramCeilingGb: number | null
  /** wall-clock hours on the reference SKU the step time was measured on. */
  baseHours: number | null
  fingerprint: string
}

export interface Recommendation {
  pick: Candidate | null
  alternatives: Candidate[]
  dominated: Candidate[]
  excluded: { provider: string; sku: string; why: string }[]
  withheld: Withheld[]
  /** Things the broker will not assert, and wants a human answer on. */
  asks: string[]
}

export interface Run {
  mode: 'flat' | 'asof'
  resolved: Resolved
  recommendation: Recommendation
}
