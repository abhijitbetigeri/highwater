/**
 * The fact-kind table.
 *
 * A broker's inputs do not age at the same rate. A price scraped twenty minutes
 * ago and one scraped last quarter are the same string; only the timestamp tells
 * them apart, and a single global decay window cannot hold both an account quota
 * (never expires) and spot capacity (meaningless by tomorrow).
 *
 * So the window is a property of the KIND.
 */

export type FactKind =
  // ── pinned: being wrong is a hard failure, not a bad suggestion ──────────
  | 'quota'             // "this account can allocate 2 A100s, not 8"
  | 'credential'        // which providers you can actually reach
  | 'policy'            // "never spot for anything that runs overnight"
  // ── volatile market signal ───────────────────────────────────────────────
  | 'price'
  | 'capacity'
  | 'outage'
  // ── learned provider behaviour ───────────────────────────────────────────
  | 'interruption_rate'
  | 'provision_latency' // how long this provider actually takes to hand you a box
  // ── measured workload shape ──────────────────────────────────────────────
  | 'vram_ceiling'
  | 'checkpoint_size'
  | 'step_time'
  | 'throughput'
  // ── identity of the thing being placed ───────────────────────────────────
  | 'code_fingerprint'

/** Facts whose scope is a commit, not a clock. See `scope` below. */
export type Scope = 'time' | 'commit'

export interface KindSpec {
  /** Half-life in days. `null` means pinned — never decays. */
  halfLifeDays: number | null
  /**
   * `'time'`  — decays on the clock.
   * `'commit'`— invalidated when the code fingerprint changes. The half-life is
   *             only a backstop for hardware and driver drift underneath it.
   *
   * This is the honest limit of a decay model: a step time measured on the
   * previous commit is not *stale*, it is about a different program. Pretending
   * a half-life covers that would be dressing up the gap.
   */
  scope: Scope
  why: string
}

export const KINDS: Record<FactKind, KindSpec> = {
  quota: {
    halfLifeDays: null,
    scope: 'time',
    why: 'the cheapest capacity you cannot allocate is not an option',
  },
  credential: {
    halfLifeDays: null,
    scope: 'time',
    why: 'a provider you cannot authenticate against is not a candidate',
  },
  policy: {
    halfLifeDays: null,
    scope: 'time',
    why: 'a standing instruction from the owner outranks any measurement',
  },

  price: {
    halfLifeDays: 0.25, // 6h
    scope: 'time',
    why: 'a day-old price is a guess presented as a number',
  },
  capacity: {
    halfLifeDays: 0.5, // 12h
    scope: 'time',
    why: 'availability is the most volatile signal in the market',
  },
  outage: {
    halfLifeDays: 3,
    scope: 'time',
    why: 'degradation outlives the status page that reported it',
  },

  interruption_rate: {
    halfLifeDays: 14,
    scope: 'time',
    why: 'spot behaviour shifts week to week with demand',
  },
  provision_latency: {
    halfLifeDays: 30,
    scope: 'time',
    why: 'queue depth is a property of the provider this month',
  },

  vram_ceiling: {
    halfLifeDays: 90,
    scope: 'commit',
    why: 'stable until the model or batch size changes — then void, not stale',
  },
  checkpoint_size: {
    halfLifeDays: 90,
    scope: 'commit',
    why: 'sets the cost of migrating a running job',
  },
  step_time: {
    halfLifeDays: 30,
    scope: 'commit',
    why: 'measured against one commit on one accelerator',
  },
  throughput: {
    halfLifeDays: 30,
    scope: 'commit',
    why: 'same: a property of the code that produced it',
  },

  code_fingerprint: {
    halfLifeDays: null,
    scope: 'commit',
    why: 'the key other commit-scoped facts hang from',
  },
}

export const isPinned = (kind: FactKind): boolean =>
  KINDS[kind].halfLifeDays === null

/**
 * Cross-kind overrides.
 *
 * The dangerous failures cross kinds. Two facts that never compete for the same
 * slot are both reported, and the broker then recommends the cheapest box on a
 * provider that is down — or one your account cannot allocate. No per-kind
 * half-life prevents this, because neither fact is stale.
 *
 * While a suppressing fact is live, the kinds it governs are WITHHELD and
 * recorded as withheld. Never deleted.
 */
export interface Override {
  /** Kind that does the suppressing. */
  when: FactKind
  /** Kinds suppressed while it holds, for the same provider. */
  suppresses: FactKind[]
  /** Scoped to the same provider, or global. */
  scopeBy: 'provider' | 'global'
  because: string
}

export const OVERRIDES: Override[] = [
  {
    when: 'outage',
    suppresses: ['price', 'capacity'],
    scopeBy: 'provider',
    because:
      'cheapest-and-unreachable is the worst answer the broker can give. ' +
      'A live outage voids this provider’s prices however fresh they are.',
  },
  {
    when: 'quota',
    suppresses: ['capacity'],
    scopeBy: 'provider',
    because:
      'eight H100s visible at a good price is not an offer if the account ' +
      'can allocate two. The quota is pinned; the capacity reading loses to it.',
  },
  {
    when: 'policy',
    suppresses: ['price'],
    scopeBy: 'global',
    because:
      'a standing "no spot for overnight runs" suppresses the spot price that ' +
      'would otherwise win on cost alone.',
  },
]

/** recency ∈ (0,1]; 1 for pinned facts. */
export function recency(kind: FactKind, ageDays: number): number {
  const hl = KINDS[kind].halfLifeDays
  if (hl === null) return 1
  return Math.pow(2, -ageDays / hl)
}
