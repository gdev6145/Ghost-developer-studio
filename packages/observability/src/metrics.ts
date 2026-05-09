/**
 * @ghost/observability — in-process metrics registry.
 *
 * A lightweight metrics implementation that requires zero external dependencies.
 * Tracks counters, gauges, and histograms. Exposes Prometheus-compatible text format.
 */

export type MetricType = 'counter' | 'gauge' | 'histogram'

export interface MetricDescriptor {
  name: string
  help: string
  type: MetricType
  labels?: string[]
}

interface Sample {
  value: number
  labels: Record<string, string>
  timestamp: number
}

// ─── Counter ───────────────────────────────────────────────────────────────

export class Counter {
  private samples = new Map<string, Sample>()

  constructor(private readonly descriptor: MetricDescriptor) {}

  inc(labels: Record<string, string> = {}, value = 1): void {
    const key = labelKey(labels)
    const existing = this.samples.get(key)
    if (existing) {
      existing.value += value
      existing.timestamp = Date.now()
    } else {
      this.samples.set(key, { value, labels, timestamp: Date.now() })
    }
  }

  collect(): Array<{ labels: Record<string, string>; value: number }> {
    return Array.from(this.samples.values()).map(s => ({ labels: s.labels, value: s.value }))
  }

  get name(): string { return this.descriptor.name }
  get help(): string { return this.descriptor.help }
  get type(): MetricType { return this.descriptor.type }
}

// ─── Gauge ────────────────────────────────────────────────────────────────

export class Gauge {
  private samples = new Map<string, Sample>()

  constructor(private readonly descriptor: MetricDescriptor) {}

  set(value: number, labels: Record<string, string> = {}): void {
    this.samples.set(labelKey(labels), { value, labels, timestamp: Date.now() })
  }

  inc(labels: Record<string, string> = {}, value = 1): void {
    const key = labelKey(labels)
    const existing = this.samples.get(key)
    if (existing) {
      existing.value += value
    } else {
      this.samples.set(key, { value, labels, timestamp: Date.now() })
    }
  }

  dec(labels: Record<string, string> = {}, value = 1): void {
    this.inc(labels, -value)
  }

  collect(): Array<{ labels: Record<string, string>; value: number }> {
    return Array.from(this.samples.values()).map(s => ({ labels: s.labels, value: s.value }))
  }

  get name(): string { return this.descriptor.name }
  get help(): string { return this.descriptor.help }
  get type(): MetricType { return this.descriptor.type }
}

// ─── Histogram ────────────────────────────────────────────────────────────

const DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]

export class Histogram {
  private buckets: number[]
  private counts = new Map<string, { buckets: number[]; sum: number; count: number; labels: Record<string, string> }>()

  constructor(
    private readonly descriptor: MetricDescriptor,
    buckets: number[] = DEFAULT_BUCKETS
  ) {
    this.buckets = [...buckets].sort((a, b) => a - b)
  }

  observe(value: number, labels: Record<string, string> = {}): void {
    const key = labelKey(labels)
    let entry = this.counts.get(key)
    if (!entry) {
      entry = { buckets: new Array<number>(this.buckets.length + 1).fill(0), sum: 0, count: 0, labels }
      this.counts.set(key, entry)
    }
    entry.sum += value
    entry.count++
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]!) {
        entry.buckets[i]!++
      }
    }
    // +Inf bucket
    entry.buckets[this.buckets.length]!++
  }

  collect(): Array<{ labels: Record<string, string>; buckets: number[]; sum: number; count: number }> {
    return Array.from(this.counts.values()).map(e => ({
      labels: e.labels,
      buckets: e.buckets,
      sum: e.sum,
      count: e.count,
    }))
  }

  get bucketBounds(): number[] { return this.buckets }
  get name(): string { return this.descriptor.name }
  get help(): string { return this.descriptor.help }
  get type(): MetricType { return this.descriptor.type }
}

// ─── Registry ────────────────────────────────────────────────────────────

export class MetricsRegistry {
  private readonly counters = new Map<string, Counter>()
  private readonly gauges = new Map<string, Gauge>()
  private readonly histograms = new Map<string, Histogram>()

  counter(descriptor: MetricDescriptor): Counter {
    if (!this.counters.has(descriptor.name)) {
      this.counters.set(descriptor.name, new Counter(descriptor))
    }
    return this.counters.get(descriptor.name)!
  }

  gauge(descriptor: MetricDescriptor): Gauge {
    if (!this.gauges.has(descriptor.name)) {
      this.gauges.set(descriptor.name, new Gauge(descriptor))
    }
    return this.gauges.get(descriptor.name)!
  }

  histogram(descriptor: MetricDescriptor, buckets?: number[]): Histogram {
    if (!this.histograms.has(descriptor.name)) {
      this.histograms.set(descriptor.name, new Histogram(descriptor, buckets))
    }
    return this.histograms.get(descriptor.name)!
  }

  /**
   * Serializes all metrics into Prometheus exposition format (text/plain).
   */
  prometheusFormat(): string {
    const lines: string[] = []

    for (const c of this.counters.values()) {
      lines.push(`# HELP ${c.name} ${c.help}`)
      lines.push(`# TYPE ${c.name} counter`)
      for (const s of c.collect()) {
        lines.push(`${c.name}${formatLabels(s.labels)} ${s.value}`)
      }
    }

    for (const g of this.gauges.values()) {
      lines.push(`# HELP ${g.name} ${g.help}`)
      lines.push(`# TYPE ${g.name} gauge`)
      for (const s of g.collect()) {
        lines.push(`${g.name}${formatLabels(s.labels)} ${s.value}`)
      }
    }

    for (const h of this.histograms.values()) {
      lines.push(`# HELP ${h.name} ${h.help}`)
      lines.push(`# TYPE ${h.name} histogram`)
      for (const s of h.collect()) {
        for (let i = 0; i < h.bucketBounds.length; i++) {
          lines.push(`${h.name}_bucket${formatLabels({ ...s.labels, le: String(h.bucketBounds[i]) })} ${s.buckets[i]}`)
        }
        lines.push(`${h.name}_bucket${formatLabels({ ...s.labels, le: '+Inf' })} ${s.buckets[h.bucketBounds.length]}`)
        lines.push(`${h.name}_sum${formatLabels(s.labels)} ${s.sum}`)
        lines.push(`${h.name}_count${formatLabels(s.labels)} ${s.count}`)
      }
    }

    return lines.join('\n') + '\n'
  }

  /**
   * JSON snapshot of all metrics for the /health endpoint.
   */
  snapshot(): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const c of this.counters.values()) {
      result[c.name] = c.collect()
    }
    for (const g of this.gauges.values()) {
      result[g.name] = g.collect()
    }
    for (const h of this.histograms.values()) {
      result[h.name] = h.collect().map(s => ({
        labels: s.labels,
        count: s.count,
        sum: s.sum,
        p99: estimatePercentile(s.buckets, h.bucketBounds, s.count, 0.99),
      }))
    }
    return result
  }
}

// ─── Shared default registry ─────────────────────────────────────────────

export const registry = new MetricsRegistry()

// ─── Well-known server metrics ────────────────────────────────────────────

export const httpRequestsTotal = registry.counter({
  name: 'ghost_http_requests_total',
  help: 'Total number of HTTP requests',
  type: 'counter',
  labels: ['method', 'route', 'status_code'],
})

export const httpRequestDuration = registry.histogram({
  name: 'ghost_http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  type: 'histogram',
  labels: ['method', 'route'],
})

export const wsConnectionsActive = registry.gauge({
  name: 'ghost_ws_connections_active',
  help: 'Number of active WebSocket connections',
  type: 'gauge',
})

export const wsMessagesTotal = registry.counter({
  name: 'ghost_ws_messages_total',
  help: 'Total WebSocket messages handled',
  type: 'counter',
  labels: ['type'],
})

export const aiRequestsTotal = registry.counter({
  name: 'ghost_ai_requests_total',
  help: 'Total AI assistance requests',
  type: 'counter',
  labels: ['mode', 'status'],
})

export const dbQueryDuration = registry.histogram({
  name: 'ghost_db_query_duration_ms',
  help: 'Database query duration in milliseconds',
  type: 'histogram',
  labels: ['operation'],
})

export const errorTotal = registry.counter({
  name: 'ghost_errors_total',
  help: 'Total unhandled errors',
  type: 'counter',
  labels: ['type'],
})

// ─── Helpers ─────────────────────────────────────────────────────────────

function labelKey(labels: Record<string, string>): string {
  return Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join(',')
}

function formatLabels(labels: Record<string, string>): string {
  const pairs = Object.entries(labels)
  if (pairs.length === 0) return ''
  return '{' + pairs.map(([k, v]) => `${k}="${v}"`).join(',') + '}'
}

function estimatePercentile(bucketCounts: number[], bounds: number[], total: number, p: number): number {
  if (total === 0) return 0
  const target = Math.ceil(total * p)
  let cumulative = 0
  for (let i = 0; i < bounds.length; i++) {
    cumulative += bucketCounts[i]!
    if (cumulative >= target) return bounds[i]!
  }
  return bounds[bounds.length - 1] ?? 0
}
