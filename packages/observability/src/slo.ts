/**
 * @ghost/observability — SLO (Service Level Objective) definitions.
 *
 * Defines measurable SLOs for Ghost Developer Studio's core services.
 * These are evaluated against the metrics registry and surfaced on /health.
 */

import { httpRequestDuration, wsMessagesTotal, errorTotal, registry } from './metrics'

export interface SloDefinition {
  name: string
  description: string
  /** Target success percentage (0–100) */
  target: number
  /** Evaluate current compliance. Returns 0–100. */
  evaluate(): number
}

// ─── SLO Definitions ─────────────────────────────────────────────────────

/**
 * API Availability SLO: 99.5% of HTTP requests should succeed (non-5xx).
 */
export const apiAvailabilitySlo: SloDefinition = {
  name: 'api_availability',
  description: 'Percentage of HTTP requests returning non-5xx responses',
  target: 99.5,
  evaluate(): number {
    const snap = registry.snapshot()
    const counter = snap['ghost_http_requests_total'] as Array<{ labels: Record<string, string>; value: number }> | undefined
    if (!counter || counter.length === 0) return 100
    const total = counter.reduce((acc, s) => acc + s.value, 0)
    const errors = counter
      .filter(s => s.labels['status_code']?.startsWith('5'))
      .reduce((acc, s) => acc + s.value, 0)
    if (total === 0) return 100
    return ((total - errors) / total) * 100
  },
}

/**
 * API Latency SLO: 95% of API requests should complete within 500ms.
 */
export const apiLatencySlo: SloDefinition = {
  name: 'api_latency_p95',
  description: 'P95 HTTP request latency should be below 500ms',
  target: 95,
  evaluate(): number {
    const snap = registry.snapshot()
    const hist = snap['ghost_http_request_duration_ms'] as Array<{ labels: Record<string, string>; count: number; p99: number }> | undefined
    if (!hist || hist.length === 0) return 100
    // Compliance = percentage of entries where p99 <= 500ms
    const total = hist.length
    const compliant = hist.filter(h => h.p99 <= 500).length
    return (compliant / total) * 100
  },
}

/**
 * Error Rate SLO: total unhandled error rate should stay below 0.1% of traffic.
 */
export const errorRateSlo: SloDefinition = {
  name: 'error_rate',
  description: 'Unhandled error rate below 0.5%',
  target: 99.5,
  evaluate(): number {
    const snap = registry.snapshot()
    const counter = snap['ghost_http_requests_total'] as Array<{ labels: Record<string, string>; value: number }> | undefined
    const errCounter = snap['ghost_errors_total'] as Array<{ labels: Record<string, string>; value: number }> | undefined

    const totalRequests = counter?.reduce((acc, s) => acc + s.value, 0) ?? 0
    const totalErrors = errCounter?.reduce((acc, s) => acc + s.value, 0) ?? 0

    if (totalRequests === 0) return 100
    return ((totalRequests - totalErrors) / totalRequests) * 100
  },
}

export const ALL_SLOS: SloDefinition[] = [apiAvailabilitySlo, apiLatencySlo, errorRateSlo]

/**
 * Evaluate all SLOs and return a status summary.
 */
export function evaluateSlos(): Array<{
  name: string
  description: string
  target: number
  current: number
  compliant: boolean
}> {
  return ALL_SLOS.map(slo => {
    const current = slo.evaluate()
    return {
      name: slo.name,
      description: slo.description,
      target: slo.target,
      current: Math.round(current * 100) / 100,
      compliant: current >= slo.target,
    }
  })
}
