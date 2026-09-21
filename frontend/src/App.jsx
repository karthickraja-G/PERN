import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Zap,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Send,
  Ban,
  RotateCcw,
  ShieldAlert,
  Radio,
  Terminal,
  Link2,
  Hash,
  Timer,
  ListTree,
  Braces,
  CircleDot,
  Loader2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Constants & mock data generation
// ---------------------------------------------------------------------------

const STATUSES = ["PENDING", "PROCESSING", "RETRIYING", "SUCCESS", "FAILED"];

const SAMPLE_HOSTS = [
  "api.northwind-logistics.io/hooks/inbound",
  "billing.orbitpay.com/v2/webhooks",
  "hooks.slack.com/services/T0X/B0X/internal",
  "crm.helixsales.net/events/receive",
  "notify.ledgerstream.dev/webhook",
  "app.pixelforge.studio/api/callbacks",
  "inventory.cargobridge.co/sync",
  "auth.vaultkey.systems/events",
  "svc.meridian-shipping.com/hooks",
  "api.brightfeather.app/webhooks/in",
  "events.quarrycloud.net/ingest",
  "gateway.tidepool-fin.com/hooks",
];

const SAMPLE_PAYLOADS = [
  { event: "order.created", order_id: 88231, total_cents: 452000, currency: "USD" },
  { event: "invoice.paid", invoice_id: "inv_3F921", amount: 129.0, method: "card" },
  { event: "user.updated", user_id: "usr_7781", fields: ["email", "plan"] },
  { event: "shipment.dispatched", tracking_no: "1Z999AA10123456784", carrier: "UPS" },
  { event: "subscription.cancelled", sub_id: "sub_20981", reason: "non_payment" },
  { event: "inventory.low_stock", sku: "SKU-2291-BLK", remaining: 4 },
  { event: "auth.mfa_enrolled", account_id: "acc_5521", method: "totp" },
  { event: "payout.completed", payout_id: "po_9820", amount_cents: 88100 },
];

function pad(n) {
  return String(n).padStart(2, "0");
}

function isoMinutesAgo(mins) {
  return new Date(Date.now() - mins * 60000).toISOString();
}

function isoMinutesFromNow(mins) {
  return new Date(Date.now() + mins * 60000).toISOString();
}

function backoffSeconds(retryCount) {
  return Math.pow(2, retryCount);
}

let __idCounter = 1000;
function nextId() {
  __idCounter += 1;
  return __idCounter;
}

function makeWebhook(overrides = {}) {
  const status = overrides.status || "PENDING";
  const retry_count = overrides.retry_count ?? 0;
  const max_retries = overrides.max_retries ?? 5;
  const created = overrides.created_at || isoMinutesAgo(Math.floor(Math.random() * 600) + 5);
  const base = {
    id: nextId(),
    url: "https://" + SAMPLE_HOSTS[Math.floor(Math.random() * SAMPLE_HOSTS.length)],
    payload: SAMPLE_PAYLOADS[Math.floor(Math.random() * SAMPLE_PAYLOADS.length)],
    status,
    retry_count,
    max_retries,
    retry_at:
      status === "RETRIYING" || status === "PENDING"
        ? isoMinutesFromNow(backoffSeconds(retry_count) / 60 + 0.2)
        : null,
    created_at: created,
    updated_at: overrides.updated_at || created,
    attempts_log: overrides.attempts_log || [],
  };
  return { ...base, ...overrides, id: base.id };
}

function seedWebhooks() {
  const seed = [
    makeWebhook({ status: "SUCCESS", retry_count: 0, created_at: isoMinutesAgo(340), updated_at: isoMinutesAgo(338) }),
    makeWebhook({ status: "SUCCESS", retry_count: 1, created_at: isoMinutesAgo(290), updated_at: isoMinutesAgo(288) }),
    makeWebhook({ status: "PROCESSING", retry_count: 0, created_at: isoMinutesAgo(2), updated_at: isoMinutesAgo(0.1) }),
    makeWebhook({ status: "PROCESSING", retry_count: 2, created_at: isoMinutesAgo(46), updated_at: isoMinutesAgo(0.05) }),
    makeWebhook({ status: "RETRIYING", retry_count: 1, max_retries: 4, created_at: isoMinutesAgo(18), updated_at: isoMinutesAgo(3) }),
    makeWebhook({ status: "RETRIYING", retry_count: 3, max_retries: 6, created_at: isoMinutesAgo(52), updated_at: isoMinutesAgo(1) }),
    makeWebhook({ status: "PENDING", retry_count: 0, created_at: isoMinutesAgo(1) }),
    makeWebhook({ status: "PENDING", retry_count: 0, created_at: isoMinutesAgo(0.4) }),
    makeWebhook({ status: "FAILED", retry_count: 5, max_retries: 5, created_at: isoMinutesAgo(120), updated_at: isoMinutesAgo(19) }),
    makeWebhook({ status: "FAILED", retry_count: 3, max_retries: 3, created_at: isoMinutesAgo(200), updated_at: isoMinutesAgo(140) }),
    makeWebhook({ status: "SUCCESS", retry_count: 0, created_at: isoMinutesAgo(400), updated_at: isoMinutesAgo(399) }),
    makeWebhook({ status: "PROCESSING", retry_count: 0, created_at: isoMinutesAgo(90), updated_at: isoMinutesAgo(41) }),
    makeWebhook({ status: "SUCCESS", retry_count: 2, created_at: isoMinutesAgo(510), updated_at: isoMinutesAgo(505) }),
    makeWebhook({ status: "RETRIYING", retry_count: 0, max_retries: 5, created_at: isoMinutesAgo(6), updated_at: isoMinutesAgo(0.5) }),
  ];
  return seed.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

const STATUS_META = {
  PENDING: {
    label: "Pending",
    icon: CircleDot,
    badge: "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-300",
    dot: "bg-slate-400",
    glow: "",
  },
  PROCESSING: {
    label: "Processing",
    icon: Loader2,
    badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-300",
    dot: "bg-amber-400",
    glow: "shadow-[0_0_10px_rgba(251,191,36,0.55)]",
    spin: true,
  },
  RETRIYING: {
    label: "Retrying",
    icon: RotateCcw,
    badge: "bg-sky-50 text-sky-700 ring-1 ring-sky-300",
    dot: "bg-sky-400",
    glow: "shadow-[0_0_10px_rgba(56,189,248,0.5)]",
  },
  SUCCESS: {
    label: "Success",
    icon: CheckCircle2,
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300",
    dot: "bg-emerald-400",
    glow: "",
  },
  FAILED: {
    label: "Failed",
    icon: XCircle,
    badge: "bg-rose-50 text-rose-700 ring-1 ring-rose-300",
    dot: "bg-rose-400",
    glow: "",
  },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tracking-wide ${meta.badge} ${meta.glow}`}
    >
      <Icon size={12} className={meta.spin ? "animate-spin" : ""} />
      {meta.label}
      {status === "PROCESSING" && (
        <span className="relative flex h-1.5 w-1.5 ml-0.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
        </span>
      )}
    </span>
  );
}

function timeAgo(iso) {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function timeUntil(iso) {
  if (!iso) return null;
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return "due now";
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `in ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `in ${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `in ${h}h ${m % 60}m`;
}

function formatClock(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

function shortenUrl(url) {
  return url.replace(/^https?:\/\//, "");
}

function MetricCard({ label, value, icon: Icon, accent, sub }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 backdrop-blur-sm">
      <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl opacity-20 ${accent.bg}`} />
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{label}</span>
        <Icon size={16} className={accent.text} />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-zinc-900 tabular-nums">{value}</span>
        {sub && <span className="text-xs text-zinc-500">{sub}</span>}
      </div>
    </div>
  );
}

function TriggerWebhookPanel({ open, onClose, onCreate }) {
  const [url, setUrl] = useState("https://");
  const [maxRetries, setMaxRetries] = useState(5);
  const [payloadText, setPayloadText] = useState(
    JSON.stringify({ event: "custom.event", data: { hello: "world" } }, null, 2)
  );
  const [jsonError, setJsonError] = useState(null);
  const [urlError, setUrlError] = useState(null);

  useEffect(() => {
    if (open) {
      setUrl("https://");
      setMaxRetries(5);
      setPayloadText(JSON.stringify({ event: "custom.event", data: { hello: "world" } }, null, 2));
      setJsonError(null);
      setUrlError(null);
    }
  }, [open]);

  function validatePayload(text) {
    try {
      JSON.parse(text);
      setJsonError(null);
      return true;
    } catch (e) {
      setJsonError(e.message);
      return false;
    }
  }

  function handleSubmit() {
    let ok = true;
    if (!/^https?:\/\/.+\..+/.test(url.trim())) {
      setUrlError("Enter a valid URL, e.g. https://example.com/hook");
      ok = false;
    } else {
      setUrlError(null);
    }
    if (!validatePayload(payloadText)) ok = false;
    if (!ok) return;

    const parsedPayload = JSON.parse(payloadText);
    onCreate({
      url: url.trim(),
      max_retries: Number(maxRetries) || 5,
      payload: parsedPayload,
    });
    onClose();
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md transform border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <Send size={16} className="text-cyan-600" />
              <h2 className="text-sm font-semibold text-zinc-900">Trigger new webhook</h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Target URL</label>
              <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 focus-within:border-cyan-500/60 focus-within:ring-1 focus-within:ring-cyan-500/40">
                <Link2 size={14} className="text-zinc-400 shrink-0" />
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://api.example.com/webhooks/inbound"
                  className="w-full bg-transparent text-sm text-zinc-900 placeholder-zinc-400 outline-none font-mono"
                />
              </div>
              {urlError && <p className="mt-1 text-xs text-rose-600">{urlError}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Max retries</label>
              <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 focus-within:border-cyan-500/60 focus-within:ring-1 focus-within:ring-cyan-500/40 w-28">
                <RotateCcw size={14} className="text-zinc-400 shrink-0" />
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={maxRetries}
                  onChange={(e) => setMaxRetries(e.target.value)}
                  className="w-full bg-transparent text-sm text-zinc-900 outline-none tabular-nums"
                />
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">Backoff follows 2^n seconds between attempts.</p>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-medium text-zinc-500">JSON payload</label>
                {jsonError ? (
                  <span className="text-[11px] text-rose-600">Invalid JSON</span>
                ) : (
                  <span className="text-[11px] text-emerald-600">Valid JSON</span>
                )}
              </div>
              <textarea
                value={payloadText}
                onChange={(e) => {
                  setPayloadText(e.target.value);
                  validatePayload(e.target.value);
                }}
                rows={10}
                spellCheck={false}
                className={`w-full resize-none rounded-lg border bg-white px-3 py-2 text-xs font-mono text-zinc-900 outline-none placeholder-zinc-400 ${
                  jsonError
                    ? "border-rose-500/50 focus:ring-1 focus:ring-rose-500/40"
                    : "border-zinc-200 focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40"
                }`}
              />
              {jsonError && <p className="mt-1 text-xs text-rose-600 font-mono">{jsonError}</p>}
            </div>
          </div>

          <div className="border-t border-zinc-200 px-5 py-4">
            <button
              onClick={handleSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-cyan-400 active:bg-cyan-600"
            >
              <Zap size={15} />
              Queue webhook
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function TimelineEntry({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${tone}`}>
        <Icon size={12} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="text-sm text-zinc-900 font-mono break-all">{value}</p>
      </div>
    </div>
  );
}

function WebhookRow({ webhook, isOpen, onToggle, onRetry, onCancel }) {
  const meta = STATUS_META[webhook.status];
  const nextAttempt =
    webhook.status === "RETRIYING" || webhook.status === "PENDING" ? timeUntil(webhook.retry_at) : null;

  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer border-b border-zinc-200 transition-colors hover:bg-zinc-50 ${
          isOpen ? "bg-zinc-50/50" : ""
        }`}
      >
        <td className="px-4 py-3 text-zinc-400">
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
        <td className="px-2 py-3 font-mono text-xs text-zinc-500">#{webhook.id}</td>
        <td className="px-4 py-3">
          <span className="font-mono text-xs text-zinc-900">{shortenUrl(webhook.url)}</span>
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={webhook.status} />
        </td>
        <td className="px-4 py-3 text-xs text-zinc-500 tabular-nums">
          {webhook.retry_count}/{webhook.max_retries}
        </td>
        <td className="px-4 py-3 text-xs text-zinc-500">
          {nextAttempt ? (
            <span className="text-sky-700">{nextAttempt}</span>
          ) : (
            <span className="text-zinc-400">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-zinc-500">{timeAgo(webhook.created_at)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            {webhook.status === "FAILED" && (
              <button
                onClick={() => onRetry(webhook.id)}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 hover:border-cyan-500/60 hover:text-cyan-700 transition-colors"
              >
                <RefreshCw size={11} />
                Retry now
              </button>
            )}
            {webhook.status === "PENDING" && (
              <button
                onClick={() => onCancel(webhook.id)}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 hover:border-rose-500/60 hover:text-rose-700 transition-colors"
              >
                <Ban size={11} />
                Cancel
              </button>
            )}
          </div>
        </td>
      </tr>
      {isOpen && (
        <tr className="border-b border-zinc-200 bg-zinc-50">
          <td colSpan={8} className="px-4 py-5">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <Braces size={12} />
                  Payload
                </div>
                <pre className="max-h-64 overflow-auto rounded-lg border border-zinc-200 bg-zinc-900 p-3 text-[11px] leading-relaxed text-emerald-300 font-mono">
                  {JSON.stringify(webhook.payload, null, 2)}
                </pre>
              </div>
              <div className="lg:col-span-2">
                <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <ListTree size={12} />
                  Delivery timeline
                </div>
                <div className="space-y-4">
                  <TimelineEntry
                    icon={Hash}
                    label="Enqueued"
                    value={formatClock(webhook.created_at)}
                    tone="bg-zinc-100 text-zinc-500"
                  />
                  <TimelineEntry
                    icon={meta.icon}
                    label={`Current status — ${meta.label}`}
                    value={formatClock(webhook.updated_at)}
                    tone={`${meta.badge}`}
                  />
                  {webhook.retry_count > 0 && (
                    <TimelineEntry
                      icon={RotateCcw}
                      label={`Attempts so far (backoff ${backoffSeconds(webhook.retry_count)}s)`}
                      value={`${webhook.retry_count} of ${webhook.max_retries} retries used`}
                      tone="bg-sky-50 text-sky-700"
                    />
                  )}
                  {nextAttempt && (
                    <TimelineEntry
                      icon={Timer}
                      label="Next attempt"
                      value={`${formatClock(webhook.retry_at)} (${nextAttempt})`}
                      tone="bg-amber-50 text-amber-700"
                    />
                  )}
                  {webhook.status === "FAILED" && (
                    <TimelineEntry
                      icon={AlertTriangle}
                      label="Outcome"
                      value="Retry budget exhausted — manual intervention required"
                      tone="bg-rose-50 text-rose-700"
                    />
                  )}
                  {webhook.status === "SUCCESS" && (
                    <TimelineEntry
                      icon={CheckCircle2}
                      label="Outcome"
                      value="Delivered and acknowledged (2xx response)"
                      tone="bg-emerald-50 text-emerald-700"
                    />
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function App() {
  const [webhooks, setWebhooks] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sweeping, setSweeping] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setWebhooks((prev) => {
        const next = [...prev];
        const idx = next.findIndex((w) => w.status === "PENDING" || w.status === "RETRIYING");
        if (idx !== -1 && Math.random() < 0.6) {
          next[idx] = { ...next[idx], status: "PROCESSING", updated_at: new Date().toISOString() };
        }
        const pIdx = next.findIndex((w) => w.status === "PROCESSING");
        if (pIdx !== -1 && Math.random() < 0.5) {
          const w = next[pIdx];
          const succeeds = Math.random() < 0.72;
          if (succeeds) {
            next[pIdx] = { ...w, status: "SUCCESS", updated_at: new Date().toISOString() };
          } else if (w.retry_count + 1 >= w.max_retries) {
            next[pIdx] = { ...w, status: "FAILED", retry_count: w.retry_count + 1, updated_at: new Date().toISOString() };
          } else {
            const rc = w.retry_count + 1;
            next[pIdx] = {
              ...w,
              status: "RETRIYING",
              retry_count: rc,
              retry_at: isoMinutesFromNow(backoffSeconds(rc) / 60),
              updated_at: new Date().toISOString(),
            };
          }
        }
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  function showToast(message, tone = "cyan") {
    setToast({ message, tone });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }

  const metrics = useMemo(() => {
    const total = webhooks.length;
    const active = webhooks.filter((w) => w.status === "PROCESSING").length;
    const success = webhooks.filter((w) => w.status === "SUCCESS").length;
    const failed = webhooks.filter((w) => w.status === "FAILED").length;
    const queued = webhooks.filter((w) => w.status === "PENDING" || w.status === "RETRIYING").length;
    return { total, active, success, failed, queued };
  }, [webhooks]);

  const engineActive = metrics.active > 0 || metrics.queued > 0;

  const filtered = useMemo(() => {
    if (statusFilter === "ALL") return webhooks;
    return webhooks.filter((w) => w.status === statusFilter);
  }, [webhooks, statusFilter]);

  const handleToggle = useCallback((id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleRetry = useCallback((id) => {
    setWebhooks((prev) =>
      prev.map((w) =>
        w.id === id
          ? { ...w, status: "PROCESSING", updated_at: new Date().toISOString(), retry_at: null }
          : w
      )
    );
    showToast(`Webhook #${id} re-queued for immediate delivery`, "cyan");
  }, []);

  const handleCancel = useCallback((id) => {
    setWebhooks((prev) =>
      prev.map((w) =>
        w.id === id
          ? { ...w, status: "FAILED", updated_at: new Date().toISOString(), retry_at: null }
          : w
      )
    );
    showToast(`Webhook #${id} cancelled`, "rose");
  }, []);

  function handleForceSweep() {
    setSweeping(true);
    showToast("Recovery sweep started — scanning for orphaned PROCESSING jobs…", "amber");
    setTimeout(() => {
      setWebhooks((prev) => {
        let recovered = 0;
        const next = prev.map((w) => {
          const staleMs = Date.now() - new Date(w.updated_at).getTime();
          if (w.status === "PROCESSING" && staleMs > 30 * 60 * 1000) {
            recovered += 1;
            return {
              ...w,
              status: "PENDING",
              updated_at: new Date().toISOString(),
              retry_at: isoMinutesFromNow(0.2),
            };
          }
          return w;
        });
        setTimeout(() => {
          showToast(
            recovered > 0
              ? `Recovery sweep complete — ${recovered} orphaned job${recovered > 1 ? "s" : ""} requeued`
              : "Recovery sweep complete — no orphaned jobs found",
            recovered > 0 ? "emerald" : "cyan"
          );
        }, 0);
        return next;
      });
      setSweeping(false);
    }, 1400);
  }

  function handleCreate({ url, max_retries, payload }) {
    const created = new Date().toISOString();
    const webhook = {
      id: nextId(),
      url,
      payload,
      status: "PENDING",
      retry_count: 0,
      max_retries,
      retry_at: isoMinutesFromNow(0.15),
      created_at: created,
      updated_at: created,
    };
    setWebhooks((prev) => [webhook, ...prev]);
    showToast(`Webhook #${webhook.id} queued for delivery`, "emerald");
  }

  const filterTabs = [
    { key: "ALL", label: "All" },
    { key: "PENDING", label: "Pending" },
    { key: "PROCESSING", label: "Processing" },
    { key: "RETRIYING", label: "Retrying" },
    { key: "SUCCESS", label: "Success" },
    { key: "FAILED", label: "Failed" },
  ];

  return (
    <div className="min-h-screen w-full bg-zinc-50 text-zinc-900 font-sans">
      <div className="relative mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white ring-1 ring-zinc-200 shadow-sm">
              <Terminal size={18} className="text-cyan-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-zinc-900 tracking-tight">Webhook Delivery Engine</h1>
              <p className="text-xs text-zinc-500 font-mono">webhook_queue · postgres · exponential backoff</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 shadow-sm">
              <span className="relative flex h-2 w-2">
                {engineActive && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    engineActive ? "bg-emerald-400" : "bg-zinc-400"
                  }`}
                />
              </span>
              <span className="text-xs font-medium text-zinc-700">
                Engine {engineActive ? "Active" : "Idle"}
              </span>
            </div>

            <button
              onClick={handleForceSweep}
              disabled={sweeping}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:border-zinc-400 transition-colors disabled:opacity-60"
            >
              <ShieldAlert size={14} className={sweeping ? "animate-pulse" : ""} />
              {sweeping ? "Sweeping…" : "Force Recovery Sweep"}
            </button>

            <button
              onClick={() => setPanelOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-cyan-400 transition-colors shadow-sm"
            >
              <Plus size={14} />
              Trigger New Webhook
            </button>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard
            label="Total Webhooks"
            value={metrics.total}
            icon={Radio}
            accent={{ text: "text-zinc-500", bg: "bg-zinc-500" }}
          />
          <MetricCard
            label="Active / Processing"
            value={metrics.active}
            icon={Activity}
            accent={{ text: "text-amber-600", bg: "bg-amber-400" }}
            sub="in flight"
          />
          <MetricCard
            label="Succeeded"
            value={metrics.success}
            icon={CheckCircle2}
            accent={{ text: "text-emerald-600", bg: "bg-emerald-400" }}
          />
          <MetricCard
            label="Failed"
            value={metrics.failed}
            icon={XCircle}
            accent={{ text: "text-rose-600", bg: "bg-rose-400" }}
          />
          <MetricCard
            label="Queued / Retrying"
            value={metrics.queued}
            icon={Clock}
            accent={{ text: "text-sky-600", bg: "bg-sky-400" }}
          />
        </div>

        {/* Filters */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === tab.key
                  ? "bg-zinc-200 text-zinc-900"
                  : "bg-white text-zinc-500 border border-zinc-200 hover:text-zinc-900 shadow-sm"
              }`}
            >
              {tab.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-zinc-500 font-mono">{filtered.length} records</span>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3 font-medium w-8"></th>
                  <th className="px-2 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Target URL</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Retries</th>
                  <th className="px-4 py-3 font-medium">Next Attempt</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => (
                  <WebhookRow
                    key={w.id}
                    webhook={w}
                    isOpen={expandedId === w.id}
                    onToggle={() => handleToggle(w.id)}
                    onRetry={handleRetry}
                    onCancel={handleCancel}
                  />
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-zinc-500">
                      No webhooks match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-4 text-[11px] text-zinc-400 font-mono">
          tick:{tick} · showing mock data — connect to your REST API to replace client-side simulation
        </p>
      </div>

      <TriggerWebhookPanel open={panelOpen} onClose={() => setPanelOpen(false)} onCreate={handleCreate} />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-medium shadow-2xl backdrop-blur-sm ${
              toast.tone === "rose"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : toast.tone === "emerald"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : toast.tone === "amber"
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-cyan-200 bg-cyan-50 text-cyan-700"
            }`}
          >
            <Zap size={13} />
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}