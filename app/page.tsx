'use client';

import { useEffect, useState, useCallback, useMemo, Component, type ReactNode } from 'react';

// ── Error boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) return (
      <div className="error-box" style={{ margin: '40px auto', maxWidth: 600 }}>
        <h3>Dashboard render error</h3>
        <pre>{this.state.error}</pre>
        <p style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>Please hard-refresh (Cmd+Shift+R) to reload.</p>
      </div>
    );
    return this.props.children;
  }
}
import type { DashboardData } from '@/lib/types';
import {
  TrendChart, MarginChart, StackedBarChart,
  DonutChart, HorizontalBarChart, LabeledLineChart,
  BLUE, GREEN, RED, AMBER, PURPLE, YELLOW,
  fmt, fmtFull,
} from '@/components/Charts';

// ── Helpers ────────────────────────────────────────────────────────────────────
const pct   = (v: number) => (isFinite(v) ? v.toFixed(1) : '0.0') + '%';
const fmtK  = (v: number) => '$' + (Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'K' : v.toFixed(0));
const pp    = (a: number, b: number) => { const d = a - b; return { d, cls: d >= 0 ? 'up' : 'down', str: (d >= 0 ? '+' : '') + d.toFixed(1) + 'pp' }; };
const mom   = (a: number, b: number) => { if (!b) return { d: 0, cls: 'flat', str: '—' }; const d = ((a - b) / Math.abs(b)) * 100; return { d, cls: d >= 0 ? 'up' : 'down', str: (d >= 0 ? '+' : '') + d.toFixed(1) + '%' }; };

// ── Insight generation ────────────────────────────────────────────────────────
type Insight = { type: 'good' | 'warn' | 'info'; text: string };
function buildInsights(pl: DashboardData['pl'], clients: DashboardData['clients']): Insight[] {
  const out: Insight[] = [];
  const N = pl.months.length; if (N < 2) return out;
  const last = N - 1, prev = N - 2;

  const revChg = mom(pl.revenue[last], pl.revenue[prev]);
  if (revChg.d < -5)
    out.push({ type: 'warn', text: `Revenue dropped ${Math.abs(revChg.d).toFixed(1)}% vs prior month (${pl.months[last].label}). Investigate what changed.` });
  else if (revChg.d > 5)
    out.push({ type: 'good', text: `Revenue grew +${revChg.d.toFixed(1)}% vs prior month. Document what drove this and repeat it.` });

  const mgChg = pp(pl.netMargin[last], pl.netMargin[prev]);
  if (mgChg.d > 2)
    out.push({ type: 'good', text: `Margin expanded ${mgChg.str} vs prior period (${pl.netMargin[prev].toFixed(1)}% → ${pl.netMargin[last].toFixed(1)}%). Document what changed.` });
  else if (mgChg.d < -2)
    out.push({ type: 'warn', text: `Margin compressed ${mgChg.str} to ${pl.netMargin[last].toFixed(1)}%. Look at where COGS or OpEx is creeping.` });

  const netProfit = pl.netIncome[last];
  if (netProfit > 0 && pl.netMargin[last] < 20)
    out.push({ type: 'info', text: `Net profit positive at ${fmtK(netProfit)} but margin is only ${pl.netMargin[last].toFixed(1)}%. There's room to optimise — look at where COGS or OpEx is creeping.` });

  // Concentration risk
  const uniqueClients = [...new Set(clients.map(c => c.client).filter(Boolean))];
  if (uniqueClients.length > 0) {
    const topClient = clients.reduce<Record<string, number>>((acc, c) => {
      acc[c.client] = (acc[c.client] ?? 0) + (c.monthlyRevenue[last] ?? 0);
      return acc;
    }, {});
    const totalRev = Object.values(topClient).reduce((a, b) => a + b, 0);
    const sorted = Object.entries(topClient).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && totalRev > 0) {
      const share = (sorted[0][1] / totalRev) * 100;
      if (share > 60)
        out.push({ type: 'info', text: `${sorted[0][0]} books ${share.toFixed(0)}% of revenue. Single-client concentration — diversifying is a strategic moat.` });
    }
  }

  // COGS creep
  const cogsShare = pl.cogs[last] / pl.revenue[last] * 100;
  const cogsSharePrev = pl.cogs[prev] / pl.revenue[prev] * 100;
  if (cogsShare - cogsSharePrev > 3)
    out.push({ type: 'warn', text: `COGS as % of revenue rose ${(cogsShare - cogsSharePrev).toFixed(1)}pp to ${cogsShare.toFixed(1)}%. Influencer contract costs are expanding faster than revenue.` });

  return out.slice(0, 4);
}

// ── Insights Panel ────────────────────────────────────────────────────────────
function InsightsPanel({ insights, period }: { insights: Insight[]; period: string }) {
  if (!insights.length) return null;
  const icon = { good: '✓', warn: '⊙', info: 'i' };
  const color = { good: GREEN, warn: RED, info: BLUE };
  return (
    <div style={{ background: 'rgba(19,144,235,0.07)', border: '1px solid rgba(19,144,235,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ background: 'var(--blue-soft)', color: 'var(--blue)', fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: '2px 8px', borderRadius: 100, border: '1px solid rgba(19,144,235,0.3)' }}>INSIGHTS</span>
        <span style={{ fontFamily: 'var(--font-head)', fontSize: 16, letterSpacing: 1 }}>WHAT TO DO NEXT · {period.toUpperCase()}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {insights.map((ins, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13 }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', background: color[ins.type] + '22', border: `1px solid ${color[ins.type]}55`, color: color[ins.type], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{icon[ins.type]}</span>
            <span style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: ins.text.replace(/([+-]?\d+\.?\d*[Kk%×]?)/g, '<strong>$1</strong>') }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Heatmap table ─────────────────────────────────────────────────────────────
function HeatmapTable({ rows, labels }: { rows: { label: string; values: number[]; format: 'dollar' | 'pct' }[]; labels: string[] }) {
  return (
    <div className="tbl-scroll">
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th className="num">Avg</th>
            {labels.map(l => <th key={l} className="num">{l}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const vals = row.values;
            const min = Math.min(...vals), max = Math.max(...vals);
            const avg = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
            const fmt2 = (v: number) => row.format === 'pct' ? pct(v) : fmtFull(v);
            return (
              <tr key={row.label}>
                <td style={{ color: 'var(--muted)', fontSize: 12 }}>{row.label}</td>
                <td className="num" style={{ fontWeight: 700 }}>{fmt2(avg)}</td>
                {vals.map((v, i) => {
                  const range = max - min || 1;
                  const intensity = (v - min) / range;
                  const bg = v === max ? 'rgba(34,197,94,0.18)' : v === min ? 'rgba(239,68,68,0.12)' : `rgba(19,144,235,${(intensity * 0.15).toFixed(2)})`;
                  return (
                    <td key={i} className="num" style={{ background: bg, fontSize: 12, padding: '6px 8px 6px 0' }}>{fmt2(v)}</td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData]       = useState<DashboardData | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [tab, setTab]         = useState('executive');
  const [lastRefresh, setLR]  = useState(new Date());
  const [periodIdx, setPeriod] = useState<number>(-1); // -1 = latest

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `HTTP ${res.status}`); }
      const d = await res.json();
      setData(d);
      setLR(new Date());
      setPeriod(d.pl.months.length - 1);
      setError(null);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 5 * 60 * 1000); return () => clearInterval(t); }, [load]);

  if (!data && !error) return (
    <>
      <header className="header">
        <div className="logo"><span>AGEN</span><span className="b">CFO</span><span className="x">×</span>SWELLWAVE MEDIA</div>
      </header>
      <div className="loading-screen"><div className="spinner" /><div style={{ color: 'var(--muted)', fontSize: 13 }}>Fetching live data from Google Sheets…</div></div>
    </>
  );

  if (error) return (
    <>
      <header className="header"><div className="logo"><span>AGEN</span><span className="b">CFO</span><span className="x">×</span>SWELLWAVE MEDIA</div></header>
      <div className="error-box"><h3>Could not load dashboard data</h3><pre>{error}</pre></div>
    </>
  );

  const { pl, expenseCategories, cogsCategories, clients, clientProfits, teamMembers, serviceCapacity } = data!;
  const N = pl.months.length;
  const pidx = periodIdx >= 0 && periodIdx < N ? periodIdx : N - 1;
  const prev = pidx - 1;
  const labels = pl.months.map(m => m.label);
  const currentPeriod = labels[pidx] ?? 'Latest';

  // YTD
  const ytdRev  = pl.revenue.slice(0, pidx + 1).reduce((a, b) => a + b, 0);
  const ytdNet  = pl.netIncome.slice(0, pidx + 1).reduce((a, b) => a + b, 0);
  const ytdCogs = pl.cogs.slice(0, pidx + 1).reduce((a, b) => a + b, 0);
  const ytdOpex = pl.opex.slice(0, pidx + 1).reduce((a, b) => a + b, 0);
  const avgNet  = pl.netMargin.slice(0, pidx + 1).reduce((a, b) => a + b, 0) / (pidx + 1);

  // Insights
  const insights = useMemo(() => buildInsights(pl, clients), [pl, clients]);

  // Client aggregations
  const clientMonthly = clients.reduce<Record<string, number[]>>((acc, c) => {
    const key = c.client + (c.service ? ` · ${c.service}` : '');
    if (!acc[key]) acc[key] = Array(c.monthlyRevenue.length).fill(0);
    c.monthlyRevenue.forEach((v, i) => { if (i < acc[key].length) acc[key][i] += v; });
    return acc;
  }, {});
  const uniqueClients = [...new Map(clients.map(c => [c.client, c])).values()];

  // Chart datasets
  const opexChartData = expenseCategories.filter(e => e.values.slice(0, N).some(v => v > 0)).slice(0, 6)
    .map((e, i) => ({ label: e.name.replace('and other ', '').replace(' Expenses', ''), data: e.values.slice(0, N), color: [BLUE, GREEN, AMBER, PURPLE, YELLOW, 'rgba(255,255,255,0.25)'][i] }));
  const cogsChartData = cogsCategories.map((c, i) => ({
    label: c.name.replace('- Service Delivery', '').trim(),
    data: c.values.slice(0, N),
    color: [RED, AMBER, PURPLE][i] ?? PURPLE,
  }));

  const maxProfit = Math.max(...clientProfits.map(c => Math.abs(c.profit)), 1);

  // Heatmap rows
  const heatmapRows = [
    { label: 'Revenue', values: pl.revenue, format: 'dollar' as const },
    { label: 'Gross Profit', values: pl.grossProfit, format: 'dollar' as const },
    { label: 'Gross Margin', values: pl.grossMargin, format: 'pct' as const },
    { label: 'Net Income', values: pl.netIncome, format: 'dollar' as const },
    { label: 'Net Margin', values: pl.netMargin, format: 'pct' as const },
    { label: 'COGS', values: pl.cogs, format: 'dollar' as const },
    { label: 'OpEx', values: pl.opex, format: 'dollar' as const },
  ];

  const revMom = prev >= 0 ? mom(pl.revenue[pidx], pl.revenue[prev]) : { cls: 'flat', str: '—' };
  const netMom = prev >= 0 ? mom(pl.netIncome[pidx], pl.netIncome[prev]) : { cls: 'flat', str: '—' };
  const mgPP   = prev >= 0 ? pp(pl.netMargin[pidx], pl.netMargin[prev]) : { cls: 'flat', str: '—' };

  return (
    <ErrorBoundary>
    <>
      {/* ── TOP BAR ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 36px', borderBottom: '1px solid var(--card-border)', gap: 16, flexWrap: 'wrap' }}>
        <div className="logo"><span>AGEN</span><span className="b">CFO</span><span className="x">×</span>SWELLWAVE MEDIA</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Period</span>
            <select value={pidx} onChange={e => setPeriod(Number(e.target.value))} style={{ fontFamily: 'var(--font-head)', fontSize: 14, letterSpacing: '0.5px' }}>
              {labels.map((l, i) => <option key={l} value={i}>{l}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
            {pl.months[pidx]?.status ?? 'Actuals'} · Live
          </div>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--card-strong)', border: '1px solid var(--card-border)', borderRadius: 8, color: 'var(--text)', cursor: 'pointer', fontSize: 12, padding: '6px 14px', fontFamily: 'var(--font-body)' }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ── NAV ──────────────────────────────────────────────────────── */}
      <nav>
        {(['executive', 'revenue', 'expenses', 'clients', 'people'] as const).map(t => (
          <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>

      {/* ══════════════════════════════════════════════════════════════
          EXECUTIVE
      ══════════════════════════════════════════════════════════════ */}
      <div className={`page${tab === 'executive' ? ' active' : ''}`}>
        <InsightsPanel insights={insights} period={currentPeriod} />

        <div className="kpi-grid">
          <div className="kpi">
            <div className="label">Revenue · {currentPeriod}</div>
            <div className="value">{fmt(pl.revenue[pidx])}</div>
            <div className={`delta ${revMom.cls}`}>{revMom.cls === 'up' ? '▲' : revMom.cls === 'down' ? '▼' : '—'} {revMom.str} vs {labels[prev] ?? '—'}</div>
          </div>
          <div className="kpi green">
            <div className="label">Net Income · {currentPeriod}</div>
            <div className="value">{fmt(pl.netIncome[pidx])}</div>
            <div className={`delta ${netMom.cls}`}>{netMom.cls === 'up' ? '▲' : netMom.cls === 'down' ? '▼' : '—'} {netMom.str} vs {labels[prev] ?? '—'}</div>
          </div>
          <div className="kpi">
            <div className="label">Net Margin · {currentPeriod}</div>
            <div className="value">{pct(pl.netMargin[pidx])}</div>
            <div className={`delta ${mgPP.cls}`}>{mgPP.cls === 'up' ? '▲' : mgPP.cls === 'down' ? '▼' : '—'} {mgPP.str} vs {labels[prev] ?? '—'}</div>
          </div>
          <div className="kpi amber">
            <div className="label">Gross Margin · {currentPeriod}</div>
            <div className="value">{pct(pl.grossMargin[pidx])}</div>
            <div className={`delta ${pp(pl.grossMargin[pidx], pl.grossMargin[prev] ?? 0).cls}`}>
              {pp(pl.grossMargin[pidx], pl.grossMargin[prev] ?? 0).str} vs {labels[prev] ?? '—'}
            </div>
          </div>
        </div>

        <div className="gap">
          <div className="panel">
            <h2>Revenue & Operating Profit by Month</h2>
            <div className="sub">Same axis — visual gap shows how much profit lags revenue</div>
            <div className="chart-wrap tall">
              <LabeledLineChart
                labels={labels}
                datasets={[
                  { label: 'Revenue', data: pl.revenue, color: BLUE, fill: false },
                  { label: 'Net Income', data: pl.netIncome, color: GREEN, fill: true },
                ]}
                statuses={pl.months.map(m => m.status)}
              />
            </div>
          </div>
        </div>

        <div className="grid-3 gap">
          <div className="panel">
            <h2>Gross Margin</h2>
            <div className="sub">Monthly trend</div>
            <div className="chart-wrap short">
              <MarginChart labels={labels} values={pl.grossMargin} color={BLUE} min={30} max={70} />
            </div>
          </div>
          <div className="panel">
            <h2>Net Margin</h2>
            <div className="sub">Monthly trend</div>
            <div className="chart-wrap short">
              <MarginChart labels={labels} values={pl.netMargin} color={GREEN} min={0} max={50} />
            </div>
          </div>
          <div className="panel">
            <h2>YTD Totals</h2>
            <div className="sub">{labels[0]} – {labels[pidx]} cumulative</div>
            <div className="stat-row" style={{ flexDirection: 'column', gap: 12, marginTop: 6 }}>
              <div className="stat-item"><div className="sl">YTD Revenue</div><div className="sv">{fmt(ytdRev)}</div></div>
              <div className="stat-item"><div className="sl">YTD Net Income</div><div className="sv" style={{ color: 'var(--green)' }}>{fmt(ytdNet)}</div></div>
              <div className="stat-item"><div className="sl">Avg Net Margin</div><div className="sv">{pct(avgNet)}</div></div>
              <div className="stat-item"><div className="sl">YTD COGS</div><div className="sv" style={{ color: 'var(--red)' }}>{fmt(ytdCogs)}</div></div>
            </div>
          </div>
        </div>

        <div className="panel gap">
          <h2>All Metrics by Month</h2>
          <div className="sub">Each cell coloured relative to its own min/max range — green = best, red = worst</div>
          <HeatmapTable rows={heatmapRows} labels={labels} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          REVENUE
      ══════════════════════════════════════════════════════════════ */}
      <div className={`page${tab === 'revenue' ? ' active' : ''}`}>
        <InsightsPanel insights={insights.filter(i => i.type !== 'warn' || i.text.toLowerCase().includes('revenue'))} period={currentPeriod} />

        <div className="kpi-grid">
          <div className="kpi">
            <div className="label">Total Revenue · {currentPeriod}</div>
            <div className="value">{fmt(pl.revenue[pidx])}</div>
            <div className={`delta ${revMom.cls}`}>{revMom.cls === 'up' ? '▲' : '▼'} {revMom.str} vs {labels[prev] ?? '—'}</div>
          </div>
          <div className="kpi amber">
            <div className="label">Active Clients</div>
            <div className="value">{uniqueClients.filter(c => c.status?.toLowerCase().includes('active')).length}</div>
            <div className="delta">Generating revenue</div>
          </div>
          <div className="kpi">
            <div className="label">Active Revenue Lines</div>
            <div className="value">{Object.keys(clientMonthly).filter(k => (clientMonthly[k][pidx] ?? 0) > 0).length}</div>
            <div className="delta">Service lines billed this period</div>
          </div>
          <div className="kpi">
            <div className="label">Top Client Concentration</div>
            <div className="value" style={{ color: 'var(--amber)' }}>
              {(() => {
                const byClient = clients.reduce<Record<string, number>>((acc, c) => { acc[c.client] = (acc[c.client] ?? 0) + (c.monthlyRevenue[pidx] ?? 0); return acc; }, {});
                const total = Object.values(byClient).reduce((a, b) => a + b, 0);
                const top = Math.max(...Object.values(byClient));
                return total > 0 ? pct((top / total) * 100) : '—';
              })()}
            </div>
            <div className="delta" style={{ color: 'var(--amber)' }}>Single-client risk</div>
          </div>
        </div>

        <div className="gap">
          <div className="panel">
            <h2>Total Revenue by Month</h2>
            <div className="sub">Stacked by service line · biggest at bottom</div>
            <div className="chart-wrap tall">
              <StackedBarChart
                labels={labels}
                datasets={Object.entries(clientMonthly).map(([label, data], i) => ({
                  label, data: data.slice(0, N),
                  color: [BLUE, 'rgba(19,144,235,0.5)', GREEN, PURPLE, YELLOW, AMBER][i % 6],
                }))}
                statuses={pl.months.map(m => m.status)}
              />
            </div>
          </div>
        </div>

        <div className="grid-21">
          <div className="panel gap">
            <h2>Client Revenue by Month</h2>
            <div className="sub">All service lines</div>
            <div className="tbl-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Client</th><th>Service</th><th>Pod</th>
                    {labels.map(l => <th key={l} className="num">{l}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {clients.filter(c => c.client).map((c, i) => (
                    <tr key={i}>
                      <td><strong>{c.client}</strong></td>
                      <td>{c.service || '—'}</td>
                      <td>{c.pod || '—'}</td>
                      {c.monthlyRevenue.slice(0, N).map((v, j) => (
                        <td key={j} className="num" style={{ color: v === 0 ? 'var(--muted)' : undefined }}>{v === 0 ? '—' : fmtFull(v)}</td>
                      ))}
                    </tr>
                  ))}
                  <tr className="tr-grand">
                    <td colSpan={3}><strong>Total</strong></td>
                    {pl.revenue.map((v, i) => <td key={i} className="num"><strong>{fmtFull(v)}</strong></td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="panel">
            <h2>Revenue Mix · {currentPeriod}</h2>
            <div className="sub">By service line</div>
            {(() => {
              const lines = Object.entries(clientMonthly).map(([label, vals]) => ({ label, v: vals[pidx] ?? 0 })).filter(x => x.v > 0);
              const total = lines.reduce((a, x) => a + x.v, 0);
              return (
                <>
                  <DonutChart labels={lines.map(x => x.label)} values={lines.map(x => x.v)} centerLabel={fmt(total)} centerSub="Total" />
                  <div className="legend" style={{ marginTop: 14, justifyContent: 'center' }}>
                    {lines.map((x, i) => (
                      <div key={x.label} className="legend-item">
                        <div className="legend-dot" style={{ background: [BLUE, 'rgba(19,144,235,0.6)', GREEN, PURPLE, YELLOW, AMBER][i % 6] }} />
                        {x.label.split(' · ')[0]} ({pct((x.v / total) * 100)})
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          EXPENSES
      ══════════════════════════════════════════════════════════════ */}
      <div className={`page${tab === 'expenses' ? ' active' : ''}`}>

        <div className="kpi-grid">
          <div className="kpi">
            <div className="label">Total COGS · {currentPeriod}</div>
            <div className="value">{fmt(pl.cogs[pidx])}</div>
            <div className={`delta ${mom(pl.cogs[pidx], pl.cogs[prev] ?? 0).cls}`}>{mom(pl.cogs[pidx], pl.cogs[prev] ?? 0).str} vs prior</div>
          </div>
          <div className="kpi amber">
            <div className="label">Total OpEx · {currentPeriod}</div>
            <div className="value">{fmt(pl.opex[pidx])}</div>
            <div className={`delta ${mom(pl.opex[pidx], pl.opex[prev] ?? 0).cls}`}>{mom(pl.opex[pidx], pl.opex[prev] ?? 0).str} vs prior</div>
          </div>
          <div className="kpi">
            <div className="label">COGS % of Revenue</div>
            <div className="value">{pct(pl.cogs[pidx] / pl.revenue[pidx] * 100)}</div>
            <div className="delta">Influencer-heavy</div>
          </div>
          <div className="kpi">
            <div className="label">YTD Total Spend</div>
            <div className="value">{fmt(ytdCogs + ytdOpex)}</div>
            <div className="delta">COGS + OpEx</div>
          </div>
        </div>

        <div className="grid-2 gap">
          <div className="panel">
            <h2>Cost of Sales</h2>
            <div className="sub">Influencer contracts dominant</div>
            <div className="chart-wrap tall">
              <StackedBarChart labels={labels} datasets={cogsChartData} statuses={pl.months.map(m => m.status)} />
            </div>
            <div className="legend">{cogsChartData.map(d => <div key={d.label} className="legend-item"><div className="legend-dot" style={{ background: d.color }} />{d.label}</div>)}</div>
          </div>
          <div className="panel">
            <h2>Operating Expenses</h2>
            <div className="sub">Stacked by category</div>
            <div className="chart-wrap tall">
              <StackedBarChart labels={labels} datasets={opexChartData} statuses={pl.months.map(m => m.status)} />
            </div>
            <div className="legend">{opexChartData.map(d => <div key={d.label} className="legend-item"><div className="legend-dot" style={{ background: d.color }} />{d.label}</div>)}</div>
          </div>
        </div>

        <div className="panel gap">
          <h2>Operating Expense Detail</h2>
          <div className="sub">Line-by-line · each row coloured relative to its own range</div>
          <HeatmapTable
            rows={expenseCategories.filter(e => e.values.slice(0, N).some(v => v > 0)).map(e => ({ label: e.name, values: e.values.slice(0, N), format: 'dollar' as const }))}
            labels={labels}
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          CLIENTS
      ══════════════════════════════════════════════════════════════ */}
      <div className={`page${tab === 'clients' ? ' active' : ''}`}>
        <InsightsPanel insights={insights.filter(i => i.text.toLowerCase().includes('client') || i.text.toLowerCase().includes('revenue') || i.text.toLowerCase().includes('concentration'))} period={currentPeriod} />

        <div className="kpi-grid">
          <div className="kpi green">
            <div className="label">Active Clients</div>
            <div className="value">{uniqueClients.filter(c => c.status?.toLowerCase().includes('active')).length}</div>
            <div className="delta up">Generating revenue</div>
          </div>
          <div className="kpi">
            <div className="label">Completed / Churned</div>
            <div className="value">{uniqueClients.filter(c => !c.status?.toLowerCase().includes('active')).length}</div>
            <div className="delta" style={{ color: 'var(--amber)' }}>Budget constraint</div>
          </div>
          <div className="kpi green">
            <div className="label">Best Client Margin</div>
            <div className="value">{pct(Math.max(...clientProfits.filter(c => c.margin > 0 && c.margin < 200).map(c => c.margin), 0))}</div>
            <div className="delta up">Top service line</div>
          </div>
          <div className="kpi amber">
            <div className="label">Concentration Risk</div>
            <div className="value">HIGH</div>
            <div className="delta" style={{ color: 'var(--amber)' }}>1 client dominant</div>
          </div>
        </div>

        <div className="panel gap">
          <h2>Client Roster</h2>
          <div className="sub">Active and completed engagements</div>
          <div className="tbl-scroll">
            <table>
              <thead><tr><th>Client</th><th>Status</th><th>Start Date</th><th>Source</th><th>Team</th><th>End Reason</th></tr></thead>
              <tbody>
                {uniqueClients.map(c => (
                  <tr key={c.client}>
                    <td><strong>{c.client}</strong></td>
                    <td><span className={`pill ${c.status?.toLowerCase().includes('active') ? 'active' : 'lost'}`}>{c.status}</span></td>
                    <td>{c.startDate || '—'}</td>
                    <td>{c.source || '—'}</td>
                    <td>{c.teamMember || '—'}</td>
                    <td style={{ color: c.endReason ? 'var(--amber)' : undefined }}>{c.endReason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid-21">
          <div className="panel gap">
            <h2>Client Profitability</h2>
            <div className="sub">Revenue, cost & margin by service line</div>
            <div className="tbl-scroll">
              <table>
                <thead><tr><th>Client</th><th>Service</th><th>Pod</th><th className="num">Revenue</th><th className="num">People Cost</th><th className="num">Profit</th><th className="num">Margin</th><th>Visual</th></tr></thead>
                <tbody>
                  {clientProfits.map((c, i) => {
                    const barW = Math.round(Math.abs(c.profit) / maxProfit * 80);
                    return (
                      <tr key={i}>
                        <td><strong>{c.client}</strong></td>
                        <td>{c.service || '—'}</td>
                        <td>{c.pod || '—'}</td>
                        <td className="num">{c.revenue > 0 ? fmtFull(c.revenue) : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                        <td className="num" style={{ color: c.peopleCost > 0 ? 'var(--red)' : undefined }}>{c.peopleCost > 0 ? fmtFull(c.peopleCost) : '—'}</td>
                        <td className="num" style={{ color: c.profit > 0 ? 'var(--green)' : c.profit < 0 ? 'var(--red)' : undefined }}>{c.profit !== 0 ? (c.profit < 0 ? '-' : '') + fmtFull(Math.abs(c.profit)) : '—'}</td>
                        <td className="num" style={{ color: c.margin > 0 ? 'var(--green)' : c.margin < 0 ? 'var(--red)' : undefined }}>{c.margin !== 0 && c.margin < 200 ? pct(c.margin) : 'N/A'}</td>
                        <td><div className="cell-bar"><span className={`bar ${c.profit >= 0 ? 'green' : 'red'}`} style={{ width: barW }} /></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="panel">
            <h2>Acquisition Source</h2>
            <div className="sub">Client mix by channel</div>
            {(() => {
              const sources = uniqueClients.reduce<Record<string, number>>((acc, c) => { const s = c.source || 'Unknown'; acc[s] = (acc[s] ?? 0) + 1; return acc; }, {});
              return (
                <>
                  <DonutChart labels={Object.keys(sources)} values={Object.values(sources)} centerLabel={String(uniqueClients.length)} centerSub="Clients" />
                  <div className="legend" style={{ marginTop: 14, flexDirection: 'column', gap: 8 }}>
                    {Object.entries(sources).map(([s, n], i) => (
                      <div key={s} className="legend-item">
                        <div className="legend-dot" style={{ background: [BLUE, GREEN, AMBER, PURPLE][i % 4] }} />
                        {s} — {n} client{n > 1 ? 's' : ''}
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          PEOPLE
      ══════════════════════════════════════════════════════════════ */}
      <div className={`page${tab === 'people' ? ' active' : ''}`}>
        <div className="kpi-grid">
          <div className="kpi"><div className="label">Team Members</div><div className="value">{teamMembers.length || 1}</div><div className="delta">Active delivery team</div></div>
          <div className="kpi green"><div className="label">Avg Cost / Hour</div><div className="value">${(teamMembers[0]?.costPerHour || 333).toFixed(0)}</div><div className="delta">{teamMembers[0]?.name || 'Zenen'}</div></div>
          <div className="kpi"><div className="label">Contracted Hrs / Mo</div><div className="value">{teamMembers[0]?.totalHours || 30} hrs</div><div className="delta">Per team member</div></div>
          <div className="kpi amber"><div className="label">Clients Served</div><div className="value">{uniqueClients.filter(c => c.status?.toLowerCase().includes('active')).length}</div><div className="delta">Active accounts</div></div>
        </div>

        <div className="panel gap">
          <h2>Delivery Team</h2>
          <div className="sub">Active service team members</div>
          {(teamMembers.length > 0 ? teamMembers : [{ name: 'Zenen Chamizo', status: 'Active', department: 'Service Team', category: 'Delivery Team', startDate: '10-Aug-23', totalHours: 30, contractedSalary: 10000, costPerHour: 333 }]).map(m => (
            <div key={m.name} className="person-card">
              <div className="person-avatar">{m.name[0]}</div>
              <div style={{ flex: 1 }}>
                <div className="person-name">{m.name}</div>
                <div className="person-role">{m.department} · {m.category} · Started {m.startDate}</div>
                <div className="person-stats">
                  <div className="ps-item"><div className="ps-l">Monthly Salary</div><div className="ps-v">{fmtFull(m.contractedSalary)}</div></div>
                  <div className="ps-item"><div className="ps-l">Cost / Hour</div><div className="ps-v">${m.costPerHour > 0 ? m.costPerHour.toFixed(0) : 333}</div></div>
                  <div className="ps-item"><div className="ps-l">Hours / Mo</div><div className="ps-v">{m.totalHours}</div></div>
                  <div className="ps-item"><div className="ps-l">Status</div><div className="ps-v"><span className="pill active">{m.status}</span></div></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid-2">
          <div className="panel gap">
            <h2>Service Capacity Matrix</h2>
            <div className="sub">Hours per service type and intensity level</div>
            <div className="tbl-scroll">
              <table>
                <thead><tr><th>Service</th><th>Intensity</th><th className="num">Media Buying</th><th className="num">Leadership</th><th className="num">Client Success</th><th className="num">Total</th></tr></thead>
                <tbody>
                  {(serviceCapacity.length > 0 ? serviceCapacity : [
                    { service: 'Google Ads', intensity: 'Low',  mediaBuying: 20, leadership: 0,  clientSuccess: 10, totalHours: 30 },
                    { service: 'Google Ads', intensity: 'Mid',  mediaBuying: 25, leadership: 4,  clientSuccess: 15, totalHours: 44 },
                    { service: 'Google Ads', intensity: 'High', mediaBuying: 30, leadership: 10, clientSuccess: 20, totalHours: 60 },
                    { service: 'Meta Ads',   intensity: 'Low',  mediaBuying: 8,  leadership: 0,  clientSuccess: 4,  totalHours: 12 },
                    { service: 'Meta Ads',   intensity: 'Mid',  mediaBuying: 10, leadership: 2,  clientSuccess: 6,  totalHours: 18 },
                    { service: 'Meta Ads',   intensity: 'High', mediaBuying: 30, leadership: 10, clientSuccess: 20, totalHours: 60 },
                    { service: 'Email Mktg', intensity: 'Low',  mediaBuying: 8,  leadership: 0,  clientSuccess: 4,  totalHours: 12 },
                    { service: 'Email Mktg', intensity: 'Mid',  mediaBuying: 10, leadership: 2,  clientSuccess: 6,  totalHours: 18 },
                    { service: 'Email Mktg', intensity: 'High', mediaBuying: 30, leadership: 10, clientSuccess: 20, totalHours: 60 },
                  ]).map((s, i) => (
                    <tr key={i}>
                      <td><strong>{s.service}</strong></td>
                      <td><span className={`pill ${s.intensity === 'High' ? 'active' : s.intensity === 'Mid' ? 'warn' : 'info'}`}>{s.intensity}</span></td>
                      <td className="num">{s.mediaBuying}</td><td className="num">{s.leadership}</td>
                      <td className="num">{s.clientSuccess}</td><td className="num"><strong>{s.totalHours}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="panel">
            <h2>Hours by Service & Intensity</h2>
            <div className="sub">Total capacity required</div>
            <div className="chart-wrap med">
              <HorizontalBarChart
                labels={(serviceCapacity.length > 0 ? serviceCapacity : [
                  { service: 'GA', intensity: 'Low' }, { service: 'GA', intensity: 'Mid' }, { service: 'GA', intensity: 'High' },
                  { service: 'Meta', intensity: 'Low' }, { service: 'Meta', intensity: 'Mid' }, { service: 'Meta', intensity: 'High' },
                  { service: 'Email', intensity: 'Low' }, { service: 'Email', intensity: 'Mid' }, { service: 'Email', intensity: 'High' },
                ]).map(s => `${s.service} ${s.intensity}`)}
                datasets={[
                  { label: 'Media Buying', data: (serviceCapacity.length > 0 ? serviceCapacity : [{ mediaBuying: 20 }, { mediaBuying: 25 }, { mediaBuying: 30 }, { mediaBuying: 8 }, { mediaBuying: 10 }, { mediaBuying: 30 }, { mediaBuying: 8 }, { mediaBuying: 10 }, { mediaBuying: 30 }]).map(s => s.mediaBuying), color: 'rgba(19,144,235,0.75)' },
                  { label: 'Leadership', data: (serviceCapacity.length > 0 ? serviceCapacity : [{ leadership: 0 }, { leadership: 4 }, { leadership: 10 }, { leadership: 0 }, { leadership: 2 }, { leadership: 10 }, { leadership: 0 }, { leadership: 2 }, { leadership: 10 }]).map(s => s.leadership), color: 'rgba(34,197,94,0.7)' },
                  { label: 'Client Success', data: (serviceCapacity.length > 0 ? serviceCapacity : [{ clientSuccess: 10 }, { clientSuccess: 15 }, { clientSuccess: 20 }, { clientSuccess: 4 }, { clientSuccess: 6 }, { clientSuccess: 20 }, { clientSuccess: 4 }, { clientSuccess: 6 }, { clientSuccess: 20 }]).map(s => s.clientSuccess), color: 'rgba(192,132,252,0.7)' },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </>
    </ErrorBoundary>
  );
}
