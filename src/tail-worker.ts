/**
 * Cloudflare Tail Worker — log drain for parkkal-dental
 *
 * This worker receives Trace Events (invocation logs) from the main
 * parkkal-dental worker and forwards them to an external log service.
 *
 * Compatible with any HTTP-ingestion endpoint (Logtail/Betterstack,
 * Datadog, Grafana Loki, custom webhook). Set the destination via the
 * LOG_DRAIN_URL Cloudflare secret on this worker.
 *
 * ── Setup ─────────────────────────────────────────────────────────────────
 *   1. Deploy this worker:
 *        npx wrangler deploy --config wrangler-tail.toml
 *
 *   2. Set the target URL as a secret:
 *        npx wrangler secret put LOG_DRAIN_URL --config wrangler-tail.toml
 *        # Logtail: https://in.logtail.com (with Bearer token as Authorization header)
 *        # Betterstack: https://in.logs.betterstack.com
 *
 *   3. Enable tail_consumers in wrangler.toml (uncomment [[tail_consumers]])
 *        service = "parkkal-dental-tail"
 *
 * ── Payload format ────────────────────────────────────────────────────────
 * Each batch contains one or more TraceItem objects. We forward them as a
 * JSON array, letting the log service index them however it prefers.
 *
 * Worker Trace Events reference:
 * https://developers.cloudflare.com/workers/observability/tail-workers/
 */

interface TailEnv {
  LOG_DRAIN_URL?: string;
}

interface TraceLog {
  message: unknown[];
  level: string;
  timestamp: number;
}

interface TraceItem {
  scriptName: string | null;
  outcome: string;
  eventTimestamp: number;
  logs: TraceLog[];
  exceptions: Array<{ name: string; message: string; timestamp: number }>;
  event?: Record<string, unknown>;
}

const tailWorker = {
  async tail(events: TraceItem[], env: TailEnv): Promise<void> {
    const url = env.LOG_DRAIN_URL;
    if (!url) return; // Not configured — silently skip (no drain = no-op, not an error)

    // Filter out empty invocations (no logs, no exceptions, outcome = "ok")
    const relevant = events.filter(
      (e) => e.logs.length > 0 || e.exceptions.length > 0 || e.outcome !== "ok"
    );
    if (relevant.length === 0) return;

    const payload = relevant.map((e) => ({
      dt: new Date(e.eventTimestamp).toISOString(),
      worker: e.scriptName ?? "parkkal-dental",
      outcome: e.outcome,
      logs: e.logs.map((l) => ({
        level: l.level,
        ts: new Date(l.timestamp).toISOString(),
        message: l.message.map(String).join(" "),
      })),
      exceptions: e.exceptions.map((ex) => ({
        name: ex.name,
        message: ex.message,
        ts: new Date(ex.timestamp).toISOString(),
      })),
    }));

    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // Tail workers must not throw — a failed drain should never crash the main worker.
    }
  },
};

export default tailWorker;
