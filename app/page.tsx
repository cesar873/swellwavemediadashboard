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
  TrendChart, DualMarginChart, StackedBarChart,
  DonutChart, HorizontalBarChart,
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
function InsightsPanel({ insights, period, pillLabel = 'CFO Insights' }: { insights: Insight[]; period: string; pillLabel?: string }) {
  if (!insights.length) return null;
  const icon = { good: '▲', warn: '⚠', info: '●' };
  const cls  = { good: 'good', warn: 'warn', info: 'neu' };
  return (
    <div className="insights-box">
      <span className="insights-pill">{pillLabel}</span>
      <span className="insights-title">{period} · Key Signals</span>
      <div className="insights-list">
        {insights.map((ins, i) => (
          <div key={i} className="insights-row">
            <span className={`ii ${cls[ins.type]}`}>{icon[ins.type]}</span>
            <span dangerouslySetInnerHTML={{ __html: ins.text.replace(/([+-]?\$?[\d,]+\.?\d*[Kk%×]?)/g, '<b>$1</b>') }} />
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
  const [tab, setTab]         = useState('financials');
  const [plOpen, setPlOpen]   = useState<Record<string,boolean>>({});
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

  // ── useMemo MUST be before any early returns (Rules of Hooks) ──────────────
  const insights = useMemo(
    () => data ? buildInsights(data.pl, data.clients) : [],
    [data]
  );

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
  const togglePL = (key: string) => setPlOpen(p => ({ ...p, [key]: !p[key] }));

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

  const revMom = prev >= 0 ? mom(pl.revenue[pidx], pl.revenue[prev]) : { cls: 'flat', str: '—' };
  const netMom = prev >= 0 ? mom(pl.netIncome[pidx], pl.netIncome[prev]) : { cls: 'flat', str: '—' };
  const mgPP   = prev >= 0 ? pp(pl.netMargin[pidx], pl.netMargin[prev]) : { cls: 'flat', str: '—' };

  return (
    <ErrorBoundary>
    <>
      {/* ── HEADER ───────────────────────────────────────────────────── */}
      <div className="header">
        <div className="logo"><span>AGEN</span><span className="b">CFO</span><span className="x">×</span>SWELLWAVE MEDIA</div>
        <div className="header-right">
          <div className="last-updated">Data last updated: {lastRefresh.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
            <select value={pidx} onChange={e => setPeriod(Number(e.target.value))} style={{ background: 'var(--blue-soft)', color: 'var(--blue)', border: '1px solid rgba(19,144,235,0.35)', borderRadius: 100, fontFamily: 'inherit', fontSize: 10, fontWeight: 500, letterSpacing: '0.5px', padding: '2px 8px', cursor: 'pointer', textTransform: 'uppercase' }}>
              {labels.map((l, i) => <option key={l} value={i}>{l}</option>)}
            </select>
            <span className="period-badge">{pl.months[pidx]?.status ?? 'Actuals'}</span>
            <button onClick={load} title="Refresh" style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1 }}>↻</button>
          </div>
        </div>
      </div>

      {/* ── NAV ──────────────────────────────────────────────────────── */}
      <nav>
        {(['financials', 'revenue', 'expenses', 'clients', 'people'] as const).map(t => (
          <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>

      {/* ══════════════════════════════════════════════════════════════
          FINANCIALS
      ══════════════════════════════════════════════════════════════ */}
      <div className={`page${tab === 'financials' ? ' active' : ''}`}>
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

        <div className="grid-2 gap">
          <div className="panel">
            <h2>Revenue vs Net Income</h2>
            <div className="sub">Bars = revenue · line = net income · {labels[0]} – {labels[pidx]}</div>
            <div className="chart-wrap tall">
              <TrendChart labels={labels} revenue={pl.revenue} cogs={pl.cogs} netIncome={pl.netIncome} />
            </div>
          </div>
          <div className="panel">
            <h2>Monthly Margins</h2>
            <div className="sub">Gross margin vs net margin trend</div>
            <div className="chart-wrap tall">
              <DualMarginChart labels={labels} gross={pl.grossMargin} net={pl.netMargin} />
            </div>
          </div>
        </div>

        <div className="panel gap">
          <h2>P&amp;L by Month</h2>
          <div className="sub">Revenue, COGS, gross profit, OpEx and net income · click ▶ to expand line items</div>
          <div className="tbl-scroll-y">
            <table>
              <thead>
                <tr>
                  <th style={{minWidth:200}}>Line Item</th>
                  {labels.map(l => <th key={l} className="num">{l}</th>)}
                  <th className="num" style={{color:'var(--blue)'}}>YTD</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><button className={`plbtn${plOpen.rev ? ' open' : ''}`} onClick={() => togglePL('rev')}>▶</button><strong>Revenue</strong></td>
                  {pl.revenue.map((v,i) => <td key={i} className="num"><strong>{fmtFull(v)}</strong></td>)}
                  <td className="num" style={{color:'var(--blue)'}}><strong>{fmtFull(ytdRev)}</strong></td>
                </tr>
                {Object.entries(clientMonthly).map(([lbl, vals]) => (
                  <tr key={lbl} style={{display: plOpen.rev ? '' : 'none'}}>
                    <td style={{paddingLeft:24, color:'var(--muted)', fontSize:12}}>↳ {lbl}</td>
                    {vals.slice(0,N).map((v,j) => <td key={j} className="num" style={{fontSize:12}}>{v > 0 ? fmtFull(v) : <span className="cell-zero">—</span>}</td>)}
                    <td className="num" style={{fontSize:12}}>{fmtFull(vals.slice(0,pidx+1).reduce((a,b)=>a+b,0))}</td>
                  </tr>
                ))}
                <tr>
                  <td><button className={`plbtn${plOpen.cogs ? ' open' : ''}`} onClick={() => togglePL('cogs')}>▶</button>Cost of Sales (COGS)</td>
                  {pl.cogs.map((v,i) => <td key={i} className="num" style={{color:'var(--red)'}}>-{fmtFull(v)}</td>)}
                  <td className="num" style={{color:'var(--red)'}}>-{fmtFull(ytdCogs)}</td>
                </tr>
                {cogsCategories.map(c => (
                  <tr key={c.name} style={{display: plOpen.cogs ? '' : 'none'}}>
                    <td style={{paddingLeft:24, color:'var(--muted)', fontSize:12}}>↳ {c.name.replace('- Service Delivery','').trim()}</td>
                    {c.values.slice(0,N).map((v,j) => <td key={j} className="num" style={{fontSize:12, color:'rgba(255,255,255,0.45)'}}>{v > 0 ? '-'+fmtFull(v) : <span className="cell-zero">—</span>}</td>)}
                    <td className="num" style={{fontSize:12, color:'rgba(255,255,255,0.45)'}}>-{fmtFull(c.values.slice(0,pidx+1).reduce((a,b)=>a+b,0))}</td>
                  </tr>
                ))}
                <tr style={{background:'rgba(34,197,94,0.04)'}}>
                  <td style={{paddingLeft:20}}><strong>Gross Profit</strong></td>
                  {pl.grossProfit.map((v,i) => <td key={i} className="num"><strong style={{color:'var(--green)'}}>{fmtFull(v)}</strong></td>)}
                  <td className="num"><strong style={{color:'var(--green)'}}>{fmtFull(ytdRev - ytdCogs)}</strong></td>
                </tr>
                <tr>
                  <td><button className={`plbtn${plOpen.opex ? ' open' : ''}`} onClick={() => togglePL('opex')}>▶</button>Operating Expenses</td>
                  {pl.opex.map((v,i) => <td key={i} className="num" style={{color:'var(--red)'}}>-{fmtFull(v)}</td>)}
                  <td className="num" style={{color:'var(--red)'}}>-{fmtFull(ytdOpex)}</td>
                </tr>
                {expenseCategories.filter(e => e.values.slice(0,N).some(v => v > 0)).map(e => (
                  <tr key={e.name} style={{display: plOpen.opex ? '' : 'none'}}>
                    <td style={{paddingLeft:24, color:'var(--muted)', fontSize:12}}>↳ {e.name.replace(' Expenses','').replace('and other ','')}</td>
                    {e.values.slice(0,N).map((v,j) => <td key={j} className="num" style={{fontSize:12, color:'rgba(255,255,255,0.45)'}}>{v > 0 ? '-'+fmtFull(v) : <span className="cell-zero">—</span>}</td>)}
                    <td className="num" style={{fontSize:12, color:'rgba(255,255,255,0.45)'}}>-{fmtFull(e.values.slice(0,pidx+1).reduce((a,b)=>a+b,0))}</td>
                  </tr>
                ))}
                <tr className="grand-total">
                  <td><strong>Net Income</strong></td>
                  {pl.netIncome.map((v,i) => <td key={i} className="num"><strong style={{color: v >= 0 ? 'var(--green)' : 'var(--red)'}}>{fmtFull(v)}</strong></td>)}
                  <td className="num"><strong style={{color: ytdNet >= 0 ? 'var(--green)' : 'var(--red)'}}>{fmtFull(ytdNet)}</strong></td>
                </tr>
                <tr>
                  <td style={{color:'var(--muted)', paddingLeft:20, fontSize:11}}>Gross Margin</td>
                  {pl.grossMargin.map((v,i) => <td key={i} className="num" style={{fontSize:11, color:'var(--muted)'}}>{pct(v)}</td>)}
                  <td className="num" style={{fontSize:11, color:'var(--muted)'}}>{pct((ytdRev - ytdCogs) / ytdRev * 100)} avg</td>
                </tr>
                <tr>
                  <td style={{color:'var(--muted)', paddingLeft:20, fontSize:11}}>Net Margin</td>
                  {pl.netMargin.map((v,i) => <td key={i} className="num" style={{fontSize:11, color:'var(--muted)'}}>{pct(v)}</td>)}
                  <td className="num" style={{fontSize:11, color:'var(--muted)'}}>{pct(ytdNet / ytdRev * 100)} avg</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ══════════════════════════════════════════════════════════════
          REVENUE
      ══════════════════════════════════════════════════════════════ */}
      <div className={`page${tab === 'revenue' ? ' active' : ''}`}>
        <InsightsPanel insights={insights.filter(i => i.type !== 'warn' || i.text.toLowerCase().includes('revenue'))} period={currentPeriod} pillLabel="Revenue Insights" />

        <div className="metrics-strip">
          <div className="metric-card"><div className="ml">YTD Revenue</div><div className="mv">{fmt(ytdRev)}</div><div className="ms">{labels[0]} – {labels[pidx]}</div></div>
          <div className="metric-card"><div className="ml">Avg Monthly</div><div className="mv">{fmt(ytdRev / (pidx + 1))}</div><div className="ms">Per month YTD</div></div>
          <div className="metric-card"><div className="ml">Best Month</div><div className="mv">{fmt(Math.max(...pl.revenue))}</div><div className="ms">{labels[pl.revenue.indexOf(Math.max(...pl.revenue))]}</div></div>
          <div className="metric-card"><div className="ml">MoM Growth</div><div className="mv" style={{color: revMom.cls === 'up' ? 'var(--green)' : 'var(--red)'}}>{revMom.str}</div><div className="ms">{labels[prev] ?? '—'} → {currentPeriod}</div></div>
        </div>

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
            <h2>Revenue by Service Line · MoM</h2>
            <div className="sub">Frozen first column · horizontally scrollable</div>
            <div className="mom-wrap">
              <table className="mom-tbl">
                <thead>
                  <tr>
                    <th className="col-frozen" style={{textAlign:'left', minWidth:220}}>Client · Service</th>
                    {labels.map(l => <th key={l} style={{minWidth:110}}>{l}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {clients.filter(c => c.client).map((c, i) => (
                    <tr key={i}>
                      <td className="col-frozen"><strong>{c.client}</strong>{c.service ? <span style={{color:'var(--muted)', fontWeight:400}}> · {c.service}</span> : null}</td>
                      {c.monthlyRevenue.slice(0, N).map((v, j) => (
                        <td key={j} className="num">{v === 0 ? <span className="cell-zero">—</span> : fmtFull(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="col-frozen"><strong>Total</strong></td>
                    {pl.revenue.map((v, i) => <td key={i} className="num"><strong>{fmtFull(v)}</strong></td>)}
                  </tr>
                </tfoot>
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
        <InsightsPanel insights={insights.filter(i => i.text.toLowerCase().includes('cogs') || i.text.toLowerCase().includes('opex') || i.text.toLowerCase().includes('margin') || i.text.toLowerCase().includes('cost'))} period={currentPeriod} pillLabel="Expense Insights" />

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

        <div className="grid-21 gap">
          <div className="panel">
            <h2>Total Spend by Month</h2>
            <div className="sub">COGS + OpEx stacked by category</div>
            <div className="chart-wrap tall">
              <StackedBarChart labels={labels} datasets={[...cogsChartData, ...opexChartData]} statuses={pl.months.map(m => m.status)} />
            </div>
            <div className="legend">{[...cogsChartData, ...opexChartData].map(d => <div key={d.label} className="legend-item"><div className="legend-dot" style={{ background: d.color }} />{d.label}</div>)}</div>
          </div>
          <div className="panel">
            <h2>Expense Mix · {currentPeriod}</h2>
            <div className="sub">COGS vs OpEx breakdown</div>
            {(() => {
              const cogsTotal = pl.cogs[pidx] ?? 0;
              const opexTotal = pl.opex[pidx] ?? 0;
              const grandTotal = cogsTotal + opexTotal;
              return (
                <>
                  <DonutChart
                    labels={['COGS', 'OpEx']}
                    values={[cogsTotal, opexTotal]}
                    centerLabel={fmt(grandTotal)}
                    centerSub="Total Spend"
                  />
                  <div className="legend" style={{ marginTop: 14, flexDirection: 'column', gap: 8 }}>
                    <div className="legend-item"><div className="legend-dot" style={{ background: RED }} />COGS — {fmtFull(cogsTotal)} ({grandTotal > 0 ? pct((cogsTotal / grandTotal) * 100) : '—'})</div>
                    <div className="legend-item"><div className="legend-dot" style={{ background: AMBER }} />OpEx — {fmtFull(opexTotal)} ({grandTotal > 0 ? pct((opexTotal / grandTotal) * 100) : '—'})</div>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8 }}>COGS Breakdown</div>
                    {cogsCategories.map(c => { const v = c.values[pidx] ?? 0; return v > 0 ? (
                      <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--card-border)' }}>
                        <span style={{ color: 'var(--muted)' }}>{c.name.replace('- Service Delivery','').trim()}</span>
                        <span>{fmtFull(v)}</span>
                      </div>
                    ) : null; })}
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8, marginTop: 12 }}>OpEx Breakdown</div>
                    {expenseCategories.filter(e => (e.values[pidx] ?? 0) > 0).map(e => (
                      <div key={e.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--card-border)' }}>
                        <span style={{ color: 'var(--muted)' }}>{e.name.replace(' Expenses','').replace('and other ','')}</span>
                        <span>{fmtFull(e.values[pidx] ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        <div className="panel gap">
          <h2>Expense Detail · MoM</h2>
          <div className="sub">COGS + OpEx line items · frozen first column</div>
          <div className="mom-wrap">
            <table className="mom-tbl">
              <thead>
                <tr>
                  <th className="col-frozen" style={{textAlign:'left', minWidth:220}}>Category</th>
                  {labels.map(l => <th key={l} style={{minWidth:110}}>{l}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr><td className="col-frozen" style={{color:'var(--muted)', fontSize:11, textTransform:'uppercase', letterSpacing:'0.7px', paddingTop:10}}>Cost of Goods Sold</td>{Array(N).fill(null).map((_,i) => <td key={i} />)}</tr>
                {cogsCategories.map(c => (
                  <tr key={c.name}>
                    <td className="col-frozen" style={{paddingLeft:12}}>{c.name.replace('- Service Delivery','').trim()}</td>
                    {c.values.slice(0,N).map((v,j) => <td key={j} className="num" style={{color: v > 0 ? 'var(--red)' : undefined}}>{v > 0 ? fmtFull(v) : <span className="cell-zero">—</span>}</td>)}
                  </tr>
                ))}
                <tr><td className="col-frozen" style={{color:'var(--muted)', fontSize:11, textTransform:'uppercase', letterSpacing:'0.7px', paddingTop:10}}>Operating Expenses</td>{Array(N).fill(null).map((_,i) => <td key={i} />)}</tr>
                {expenseCategories.filter(e => e.values.slice(0,N).some(v => v > 0)).map(e => (
                  <tr key={e.name}>
                    <td className="col-frozen" style={{paddingLeft:12}}>{e.name.replace(' Expenses','').replace('and other ','')}</td>
                    {e.values.slice(0,N).map((v,j) => <td key={j} className="num" style={{color: v > 0 ? 'var(--amber)' : undefined}}>{v > 0 ? fmtFull(v) : <span className="cell-zero">—</span>}</td>)}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="col-frozen"><strong>Total Spend</strong></td>
                  {pl.cogs.map((v,i) => <td key={i} className="num"><strong>{fmtFull(v + (pl.opex[i] ?? 0))}</strong></td>)}
                </tr>
              </tfoot>
            </table>
          </div>
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
