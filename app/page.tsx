'use client';

import React, { useEffect, useState, useCallback, useMemo, Component, type ReactNode } from 'react';

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
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1JkaZ1qfrWqEwmSmG-sjdgQ0a3ZaQHtD5zl_RgehqdeY';

const pct   = (v: number) => (isFinite(v) ? v.toFixed(1) : '0.0') + '%';
const fmtK  = (v: number) => '$' + (Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'K' : v.toFixed(0));
const fmtDate = (s: string) => {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(+d)) return s;
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};
const MONTH_ABBR = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
function dateToMonthIdx(dateStr: string, labels: string[]): number {
  if (!dateStr) return -1;
  const d = new Date(dateStr);
  if (isNaN(+d)) return -1;
  const target = `${MONTH_ABBR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return labels.findIndex(l => l.toLowerCase().startsWith(target));
}
const pp  = (a: number, b: number) => { const d = a - b; return { d, cls: d >= 0 ? 'up' : 'down', str: (d >= 0 ? '+' : '') + d.toFixed(1) + 'pp' }; };
const mom = (a: number, b: number) => { if (!b) return { d: 0, cls: 'flat', str: '—' }; const d = ((a - b) / Math.abs(b)) * 100; return { d, cls: d >= 0 ? 'up' : 'down', str: (d >= 0 ? '+' : '') + d.toFixed(1) + '%' }; };

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

  const uniqueClients = [...new Set(clients.map(c => c.client).filter(Boolean))];
  if (uniqueClients.length > 0) {
    const topClient = clients.reduce<Record<string, number>>((acc, c) => {
      acc[c.client] = (acc[c.client] ?? 0) + (c.monthlyRevenue[last] ?? 0);
      return acc;
    }, {});
    const totalRev = Object.values(topClient).reduce((a, b) => a + b, 0);
    const sorted   = Object.entries(topClient).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && totalRev > 0) {
      const share = (sorted[0][1] / totalRev) * 100;
      if (share > 60)
        out.push({ type: 'info', text: `${sorted[0][0]} books ${share.toFixed(0)}% of revenue. Single-client concentration — diversifying is a strategic moat.` });
    }
  }

  const cogsShare     = pl.cogs[last] / pl.revenue[last] * 100;
  const cogsSharePrev = pl.cogs[prev] / pl.revenue[prev] * 100;
  if (cogsShare - cogsSharePrev > 3)
    out.push({ type: 'warn', text: `COGS as % of revenue rose ${(cogsShare - cogsSharePrev).toFixed(1)}pp to ${cogsShare.toFixed(1)}%. Influencer contract costs are expanding faster than revenue.` });

  return out.slice(0, 4);
}

// ── Insights panel — formatting.md §1.3, §3.3 ────────────────────────────────
function InsightsPanel({ insights, period, pillLabel = 'CFO Insights' }: { insights: Insight[]; period: string; pillLabel?: string }) {
  if (!insights.length) return null;
  const icon = { good: '▲', warn: '⚠', info: '●' };
  const cls  = { good: 'good', warn: 'warn', info: 'neu' };
  return (
    <div className="insights-box">
      <div className="insights-header">
        <span className="insights-chip">{pillLabel}</span>
        <span className="insights-title">{period} · Key Signals</span>
      </div>
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

// ── Page hero — formatting.md §1.4 ───────────────────────────────────────────
function PageHero({ eyebrow, title, subline }: { eyebrow: string; title: string; subline: string }) {
  return (
    <div className="page-hero">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <div className="subline">{subline}</div>
    </div>
  );
}

// ── Live footer — formatting.md §1.7 ─────────────────────────────────────────
function LiveFooter({ sources }: { sources: string }) {
  return (
    <p className="live-footer">
      Live from{' '}
      <a href={SHEET_URL} target="_blank" rel="noreferrer">
        SwellWave Media Finance
      </a>
      {' — '}{sources} · cached 5 minutes
    </p>
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
                  return <td key={i} className="num" style={{ background: bg, fontSize: 12, padding: '6px 8px 6px 0' }}>{fmt2(v)}</td>;
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
  const [periodIdx, setPeriod] = useState<number>(-1);
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd,   setRangeEnd]   = useState(-1);
  const [momRevSearch, setMomRevSearch] = useState('');
  const [momRevType,   setMomRevType]   = useState('');
  const [momExpSearch, setMomExpSearch] = useState('');
  const [momExpCat,    setMomExpCat]    = useState('');
  const [revTxnSearch, setRevTxnSearch] = useState('');
  const [revTxnCat,    setRevTxnCat]    = useState('');
  const [expTxnSearch, setExpTxnSearch] = useState('');
  const [expTxnCat,    setExpTxnCat]    = useState('');

  const load = useCallback(async (opts?: { bustCache?: boolean }) => {
    try {
      if (opts?.bustCache) {
        await fetch('/api/refresh', { method: 'POST' }).catch(() => {});
      }
      const res = await fetch(opts?.bustCache ? `/api/dashboard?t=${Date.now()}` : '/api/dashboard', {
        cache: opts?.bustCache ? 'no-store' : 'default',
      });
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

  const insights = useMemo(
    () => data ? buildInsights(data.pl, data.clients) : [],
    [data]
  );

  // ── Shared header/nav (shown during loading & error too) ──────────────────
  const SiteHeader = ({ showNav = false }: { showNav?: boolean }) => (
    <header className="site-header">
      <div className="site-header-inner">
        <div className="logo">
          <span className="client">SWELLWAVE MEDIA</span>
          <span className="x">×</span>
          <span className="agen">AGEN</span><span className="cfo">CFO</span>
        </div>
        {showNav && (
          <nav className="site-nav">
            {(['financials', 'revenue', 'expenses', 'clients', 'people'] as const).map(t => (
              <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
            ))}
          </nav>
        )}
      </div>
    </header>
  );

  if (!data && !error) return (
    <>
      <SiteHeader />
      <div className="loading-screen">
        <div className="spinner" />
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>Fetching live data from Google Sheets…</div>
      </div>
    </>
  );

  if (error) return (
    <>
      <SiteHeader />
      <div className="error-box"><h3>Could not load dashboard data</h3><pre>{error}</pre></div>
    </>
  );

  const { pl, expenseCategories, cogsCategories, clients, clientProfits, teamMembers, serviceCapacity, transactions = [], budget = [] } = data!;
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

  // Operating margin
  const operatingMargin = pl.revenue.map((r, i) =>
    r > 0 ? +(((r - (pl.cogs[i] ?? 0) - (pl.opex[i] ?? 0)) / r) * 100).toFixed(2) : 0
  );

  // Range filter
  const rStart = Math.max(0, Math.min(rangeStart, N - 1));
  const rEnd   = (rangeEnd >= 0 && rangeEnd < N) ? rangeEnd : N - 1;
  const rangeLabels = labels.slice(rStart, rEnd + 1);
  const rangeLen    = rEnd - rStart + 1;
  const rangeIsOne  = rStart === rEnd;
  const rangeLabel  = rangeIsOne ? labels[rStart] : `${labels[rStart]} – ${labels[rEnd]}`;
  const sumRange    = (arr: number[]) => arr.slice(rStart, rEnd + 1).reduce((a, b) => a + (b || 0), 0);
  const priorStart  = rStart - rangeLen;
  const priorEnd    = rStart - 1;
  const hasPrior    = priorStart >= 0 && priorEnd >= 0;
  const sumPrior    = (arr: number[]) => hasPrior ? arr.slice(priorStart, priorEnd + 1).reduce((a, b) => a + (b || 0), 0) : 0;
  const deltaLabel  = hasPrior ? (rangeIsOne ? labels[priorEnd] : `prior ${rangeLen}mo`) : '—';

  // Service types for Revenue filter
  const serviceTypes = [...new Set(clients.map(c => c.service).filter(Boolean))];

  const arrow = (c: string) => c === 'up' ? '▲' : c === 'down' ? '▼' : '—';

  return (
    <ErrorBoundary>
    <>
      {/* ── SITE HEADER + NAV ──────────────────────────────────────────── */}
      <header className="site-header">
        <div className="site-header-inner">
          <div className="logo">
            <span className="client">SWELLWAVE MEDIA</span>
            <span className="x">×</span>
            <span className="agen">AGEN</span><span className="cfo">CFO</span>
          </div>
          <nav className="site-nav">
            {(['financials', 'revenue', 'expenses', 'clients', 'people'] as const).map(t => (
              <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
            ))}
          </nav>
        </div>
      </header>

      {/* ── GLOBAL FILTER BAR ──────────────────────────────────────────── */}
      <div className="global-filters">
        <div className="global-filters-inner">
          <span className="gf-label">Filters</span>

          <span className="gf-label" style={{ marginLeft: 4 }}>Period</span>
          <select className="gf-select" value={pidx} onChange={e => setPeriod(Number(e.target.value))}>
            {labels.map((l, i) => <option key={l} value={i}>{l}</option>)}
          </select>
          <span className="status-badge">{pl.months[pidx]?.status ?? 'Actuals'}</span>

          <span className="gf-label" style={{ marginLeft: 8 }}>Range</span>
          <select className="gf-select" value={rStart} onChange={e => setRangeStart(Number(e.target.value))}>
            {labels.map((l, i) => <option key={l} value={i}>{l}</option>)}
          </select>
          <span className="gf-arrow">→</span>
          <select className="gf-select" value={rEnd} onChange={e => setRangeEnd(Number(e.target.value))}>
            {labels.map((l, i) => <option key={l} value={i}>{l}</option>)}
          </select>

          <div className="last-actuals-badge">
            <span className="la-label">Last updated</span>
            <strong>{lastRefresh.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
          </div>
          <button className="refresh-btn" onClick={() => load({ bustCache: true })} title="Force-refresh from Google Sheets">↻</button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          PHASE 1 — FINANCIALS
      ══════════════════════════════════════════════════════════════════ */}
      <div className={`page${tab === 'financials' ? ' active' : ''}`}>
        <div className="page-content">
          <PageHero
            eyebrow="Financial overview"
            title="Financials"
            subline={`${rangeLabel} · live from Finance Model`}
          />

          <InsightsPanel insights={insights} period={currentPeriod} />

          {(() => {
            const rev   = sumRange(pl.revenue);
            const cogsS = sumRange(pl.cogs);
            const opexS = sumRange(pl.opex);
            const net   = sumRange(pl.netIncome);
            const grossM = rev > 0 ? ((rev - cogsS) / rev) * 100 : 0;
            const netM   = rev > 0 ? (net / rev) * 100 : 0;
            const revP   = sumPrior(pl.revenue);
            const netP   = sumPrior(pl.netIncome);
            const cogsP  = sumPrior(pl.cogs);
            const grossMP = revP > 0 ? ((revP - cogsP) / revP) * 100 : 0;
            const netMP   = revP > 0 ? (netP / revP) * 100 : 0;
            const dRev = hasPrior ? mom(rev, revP) : { cls: 'flat', str: '—' };
            const dNet = hasPrior ? mom(net, netP) : { cls: 'flat', str: '—' };
            const dGM  = hasPrior ? pp(grossM, grossMP) : { cls: 'flat', str: '—' };
            const dNM  = hasPrior ? pp(netM, netMP) : { cls: 'flat', str: '—' };
            return (
              <div className="kpi-grid">
                <div className="kpi">
                  <div className="label">Revenue · {rangeLabel}</div>
                  <div className="value">{fmt(rev)}</div>
                  <div className={`delta ${dRev.cls}`}>{arrow(dRev.cls)} {dRev.str} vs {deltaLabel}</div>
                </div>
                <div className="kpi green">
                  <div className="label">Net Income · {rangeLabel}</div>
                  <div className="value">{fmt(net)}</div>
                  <div className={`delta ${dNet.cls}`}>{arrow(dNet.cls)} {dNet.str} vs {deltaLabel}</div>
                </div>
                <div className="kpi">
                  <div className="label">Net Margin · {rangeLabel}</div>
                  <div className="value">{pct(netM)}</div>
                  <div className={`delta ${dNM.cls}`}>{arrow(dNM.cls)} {dNM.str} vs {deltaLabel}</div>
                </div>
                <div className="kpi amber">
                  <div className="label">Gross Margin · {rangeLabel}</div>
                  <div className="value">{pct(grossM)}</div>
                  <div className={`delta ${dGM.cls}`}>{arrow(dGM.cls)} {dGM.str} vs {deltaLabel}</div>
                </div>
              </div>
            );
          })()}

          <div className="grid-2 gap">
            <div className="panel">
              <h2>Revenue vs Net Income</h2>
              <div className="sub">Bars = revenue · line = net income · {labels[rStart]} – {labels[rEnd]}</div>
              <div className="chart-wrap tall">
                <TrendChart
                  labels={rangeLabels}
                  revenue={pl.revenue.slice(rStart, rEnd+1)}
                  cogs={pl.cogs.slice(rStart, rEnd+1)}
                  netIncome={pl.netIncome.slice(rStart, rEnd+1)}
                />
              </div>
            </div>
            <div className="panel">
              <h2>Monthly Margins</h2>
              <div className="sub">Gross margin vs operating margin trend</div>
              <div className="chart-wrap tall">
                <DualMarginChart
                  labels={rangeLabels}
                  gross={pl.grossMargin.slice(rStart, rEnd+1)}
                  operating={operatingMargin.slice(rStart, rEnd+1)}
                />
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

          {/* ── Budget vs Actuals ─────────────────────────────────────── */}
          {(() => {
            if (!budget.length) return null;
            const rangeMonthKeys = new Set(rangeLabels.map(l => l.trim().toLowerCase()));
            const rowsInRange = budget.filter(b => rangeMonthKeys.has(b.month.trim().toLowerCase()));
            if (!rowsInRange.length) return null;
            const aggMap = new Map<string, { category: string; group: string; budget: number; actual: number; isTotal: boolean }>();
            for (const b of rowsInRange) {
              const key = b.group + '||' + b.category;
              const e = aggMap.get(key);
              if (e) { e.budget += b.budget; e.actual += b.actual; }
              else aggMap.set(key, { category: b.category, group: b.group, budget: b.budget, actual: b.actual, isTotal: b.isTotal });
            }
            const rowsThisMonth = [...aggMap.values()].map(r => ({ ...r, month: rangeLabel, varianceDollar: r.budget - r.actual, variancePct: 0 }));

            const agg = (g: string) => {
              const totalRow = rowsThisMonth.find(b => b.group === g && b.isTotal);
              if (totalRow) return { budget: totalRow.budget, actual: totalRow.actual };
              const rs = rowsThisMonth.filter(b => b.group === g && !b.isTotal);
              return { budget: rs.reduce((a, b) => a + b.budget, 0), actual: rs.reduce((a, b) => a + b.actual, 0) };
            };

            const totRev  = agg('Revenue');
            const totCogs = agg('COGS');
            const totOpex = agg('Expenses');

            const netRow = rowsThisMonth.find(b => b.group === 'Metrics' && /net income/i.test(b.category));
            const netActual = netRow ? netRow.actual : totRev.actual - totCogs.actual - totOpex.actual;
            const netBudget = netRow ? netRow.budget : totRev.budget - totCogs.budget - totOpex.budget;

            const Card = ({ label, b, a, positiveIsGood }: { label: string; b: number; a: number; positiveIsGood: boolean }) => {
              const v = a - b;
              const pctV = b !== 0 ? (v / Math.abs(b)) * 100 : 0;
              const isGood = positiveIsGood ? v >= 0 : v <= 0;
              const cls = b === 0 ? '' : isGood ? 'good' : 'bad';
              const ar  = v === 0 ? '—' : v > 0 ? '▲' : '▼';
              return (
                <div className={`bva-card ${cls}`}>
                  <div className="bl">{label}</div>
                  <div className="bv">{fmtFull(a)}</div>
                  <div className="bs"><span>Budget</span><span>{fmtFull(b)}</span></div>
                  <div className={`bvar ${cls}`}>{ar} {v >= 0 ? '+' : ''}{fmtFull(v)} {b !== 0 ? `(${pctV >= 0 ? '+' : ''}${pctV.toFixed(1)}%)` : ''}</div>
                </div>
              );
            };

            const groupOrder: { name: string; positiveIsGood: boolean; title: string }[] = [
              { name: 'Revenue',  positiveIsGood: true,  title: 'Revenue' },
              { name: 'COGS',     positiveIsGood: false, title: 'Cost of Sales' },
              { name: 'Expenses', positiveIsGood: false, title: 'Operating Expenses' },
            ];

            const Bar = ({ b, a, positiveIsGood }: { b: number; a: number; positiveIsGood: boolean }) => {
              if (b <= 0 && a <= 0) return <span style={{color:'var(--muted)', fontSize:11}}>—</span>;
              const max = Math.max(b, a, 1);
              const bPct = (b / max) * 100;
              const aPct = (a / max) * 100;
              const isGood = positiveIsGood ? a >= b : a <= b;
              const fillColor = isGood ? 'var(--green)' : 'var(--red)';
              return (
                <div className="bva-bar" title={`Actual ${fmtFull(a)} / Budget ${fmtFull(b)}`}>
                  <div className="bva-bar-fill" style={{ width: `${aPct}%`, background: fillColor, opacity: 0.85 }} />
                  {b > 0 ? <div className="bva-bar-mark" style={{ left: `${bPct}%` }} /> : null}
                </div>
              );
            };

            return (
              <div className="panel gap">
                <h2>Budget vs Actuals · {rangeLabel}</h2>
                <div className="sub">Variance analysis by category — aggregated across the selected range</div>
                <div className="metrics-strip" style={{ marginTop: 8 }}>
                  <Card label="Revenue"            b={totRev.budget}  a={totRev.actual}  positiveIsGood />
                  <Card label="Cost of Sales"      b={totCogs.budget} a={totCogs.actual} positiveIsGood={false} />
                  <Card label="Operating Expenses" b={totOpex.budget} a={totOpex.actual} positiveIsGood={false} />
                  <Card label="Net Income"         b={netBudget}      a={netActual}      positiveIsGood />
                </div>
                <div className="tbl-scroll" style={{ marginTop: 16 }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ minWidth: 200 }}>Category</th>
                        <th className="num">Budget</th>
                        <th className="num">Actual</th>
                        <th className="num">Variance $</th>
                        <th className="num">Variance %</th>
                        <th>Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupOrder.map(g => {
                        const detail = rowsThisMonth.filter(b => b.group === g.name && !b.isTotal);
                        if (!detail.length) return null;
                        const totalRow = rowsThisMonth.find(b => b.group === g.name && b.isTotal);
                        const subB = totalRow ? totalRow.budget : detail.reduce((a, b) => a + b.budget, 0);
                        const subA = totalRow ? totalRow.actual : detail.reduce((a, b) => a + b.actual, 0);
                        const subV = subA - subB;
                        const subVPct = subB !== 0 ? (subV / Math.abs(subB)) * 100 : 0;
                        const subGood = g.positiveIsGood ? subV >= 0 : subV <= 0;
                        const subColor = subB === 0 ? 'var(--muted)' : subGood ? 'var(--green)' : 'var(--red)';
                        return (
                          <React.Fragment key={g.name}>
                            <tr className="bva-section"><td colSpan={6}>{g.title}</td></tr>
                            {detail.map((r, i) => {
                              const v = r.actual - r.budget;
                              const vPct = r.budget !== 0 ? (v / Math.abs(r.budget)) * 100 : 0;
                              const isGood = g.positiveIsGood ? v >= 0 : v <= 0;
                              const color = r.budget === 0 ? 'var(--muted)' : isGood ? 'var(--green)' : 'var(--red)';
                              return (
                                <tr key={i}>
                                  <td style={{ paddingLeft: 14 }}>{r.category}</td>
                                  <td className="num">{r.budget > 0 ? fmtFull(r.budget) : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                                  <td className="num"><strong>{fmtFull(r.actual)}</strong></td>
                                  <td className="num" style={{ color }}>{r.budget === 0 ? '—' : (v >= 0 ? '+' : '') + fmtFull(v)}</td>
                                  <td className="num" style={{ color }}>{r.budget === 0 ? '—' : (vPct >= 0 ? '+' : '') + vPct.toFixed(1) + '%'}</td>
                                  <td><Bar b={r.budget} a={r.actual} positiveIsGood={g.positiveIsGood} /></td>
                                </tr>
                              );
                            })}
                            <tr className="bva-subtotal">
                              <td><strong>Total {g.title}</strong></td>
                              <td className="num"><strong>{fmtFull(subB)}</strong></td>
                              <td className="num"><strong>{fmtFull(subA)}</strong></td>
                              <td className="num" style={{ color: subColor }}><strong>{(subV >= 0 ? '+' : '') + fmtFull(subV)}</strong></td>
                              <td className="num" style={{ color: subColor }}><strong>{subB === 0 ? '—' : (subVPct >= 0 ? '+' : '') + subVPct.toFixed(1) + '%'}</strong></td>
                              <td><Bar b={subB} a={subA} positiveIsGood={g.positiveIsGood} /></td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                      <tr className="grand-total">
                        <td><strong>Net Income</strong></td>
                        <td className="num"><strong>{fmtFull(netBudget)}</strong></td>
                        <td className="num"><strong>{fmtFull(netActual)}</strong></td>
                        <td className="num" style={{ color: (netActual - netBudget) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          <strong>{(netActual - netBudget >= 0 ? '+' : '') + fmtFull(netActual - netBudget)}</strong>
                        </td>
                        <td className="num" style={{ color: (netActual - netBudget) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          <strong>{netBudget === 0 ? '—' : (((netActual - netBudget) / Math.abs(netBudget)) * 100 >= 0 ? '+' : '') + (((netActual - netBudget) / Math.abs(netBudget)) * 100).toFixed(1) + '%'}</strong>
                        </td>
                        <td><Bar b={netBudget} a={netActual} positiveIsGood /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          <LiveFooter sources="Finance Model + Budget" />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          PHASE 1 — REVENUE
      ══════════════════════════════════════════════════════════════════ */}
      <div className={`page${tab === 'revenue' ? ' active' : ''}`}>
        <div className="page-content">
          <PageHero
            eyebrow="Service revenue"
            title="Revenue"
            subline={`${rangeLabel} · live from Services + Clients`}
          />

          <InsightsPanel insights={insights.filter(i => i.type !== 'warn' || i.text.toLowerCase().includes('revenue'))} period={currentPeriod} pillLabel="Revenue Insights" />

          {(() => {
            const rev    = sumRange(pl.revenue);
            const revP   = sumPrior(pl.revenue);
            const dRev   = hasPrior ? mom(rev, revP) : { cls: 'flat', str: '—' };
            const byClient = clients.reduce<Record<string, number>>((acc, c) => {
              acc[c.client] = (acc[c.client] ?? 0) + c.monthlyRevenue.slice(rStart, rEnd+1).reduce((a,b)=>a+(b||0),0);
              return acc;
            }, {});
            const totalRev = Object.values(byClient).reduce((a,b)=>a+b, 0);
            const sorted   = Object.entries(byClient).sort((a,b) => b[1] - a[1]);
            const topShare = totalRev > 0 && sorted.length ? (sorted[0][1] / totalRev) * 100 : 0;
            const activeLines = Object.values(clientMonthly).filter(arr => arr.slice(rStart, rEnd+1).some(v => v > 0)).length;
            return (
              <div className="kpi-grid">
                <div className="kpi">
                  <div className="label">Total Revenue · {rangeLabel}</div>
                  <div className="value">{fmt(rev)}</div>
                  <div className={`delta ${dRev.cls}`}>{arrow(dRev.cls)} {dRev.str} vs {deltaLabel}</div>
                </div>
                <div className="kpi amber">
                  <div className="label">Active Clients</div>
                  <div className="value">{uniqueClients.filter(c => c.status?.toLowerCase().includes('active')).length}</div>
                  <div className="delta">Generating revenue</div>
                </div>
                <div className="kpi">
                  <div className="label">Active Revenue Lines</div>
                  <div className="value">{activeLines}</div>
                  <div className="delta">Service lines billed in range</div>
                </div>
                <div className="kpi">
                  <div className="label">Top Client Concentration</div>
                  <div className="value" style={{ color: 'var(--amber)' }}>{topShare > 0 ? pct(topShare) : '—'}</div>
                  <div className="delta" style={{ color: 'var(--amber)' }}>{sorted[0]?.[0] ?? 'Single-client risk'}</div>
                </div>
              </div>
            );
          })()}

          <div className="grid-21 gap">
            <div className="panel">
              <h2>Monthly Revenue Breakdown</h2>
              <div className="sub">By service line — {labels[rStart]} – {labels[rEnd]}</div>
              <div className="chart-wrap tall">
                <StackedBarChart
                  labels={rangeLabels}
                  datasets={Object.entries(clientMonthly).map(([label, data], i) => ({
                    label, data: data.slice(rStart, rEnd+1),
                    color: [BLUE, 'rgba(19,144,235,0.5)', GREEN, PURPLE, YELLOW, AMBER][i % 6],
                  }))}
                  statuses={pl.months.slice(rStart, rEnd+1).map(m => m.status)}
                />
              </div>
            </div>
            <div className="panel" style={{alignSelf:'start', display:'flex', flexDirection:'column', gap:20}}>
              {(() => {
                const lines = Object.entries(clientMonthly).map(([label, vals]) => ({ label, v: vals[pidx] ?? 0 })).filter(x => x.v > 0);
                const total = lines.reduce((a, x) => a + x.v, 0);
                const colors = [BLUE, 'rgba(19,144,235,0.6)', GREEN, PURPLE, YELLOW, AMBER];
                return (
                  <>
                    <div>
                      <h2>Revenue Mix · {currentPeriod}</h2>
                      <div className="sub">By service type</div>
                      <DonutChart labels={lines.map(x => x.label)} values={lines.map(x => x.v)} centerLabel={fmt(total)} centerSub="Total" />
                      <div className="legend" style={{ marginTop: 14, justifyContent: 'center' }}>
                        {lines.map((x, i) => (
                          <div key={x.label} className="legend-item">
                            <div className="legend-dot" style={{ background: colors[i % 6] }} />
                            {x.label.split(' · ')[0]} ({pct((x.v / total) * 100)})
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="divider" />
                    <div className="stat-row" style={{flexDirection:'column', gap:10, marginBottom:0}}>
                      {lines.slice(0, 3).map((x, i) => (
                        <div key={x.label} className="stat-item">
                          <div className="sl">{x.label.split(' · ')[0]} ({currentPeriod})</div>
                          <div className="sv" style={{color: colors[i % 6]}}>{fmtFull(x.v)}</div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          <div className="panel gap">
            <h2>Revenue by Client × Month</h2>
            <div className="sub">One row per client · service line — scroll horizontally · LTV column locked right</div>
            <div className="filter-bar">
              <input type="text" placeholder="Search client…" value={momRevSearch} onChange={e => setMomRevSearch(e.target.value)} style={{minWidth:200}} />
              <select value={momRevType} onChange={e => setMomRevType(e.target.value)}>
                <option value="">All Services</option>
                {serviceTypes.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {(() => {
                const rows = clients.filter(c => c.client)
                  .filter(c => !momRevSearch || (c.client + ' ' + (c.service||'')).toLowerCase().includes(momRevSearch.toLowerCase()))
                  .filter(c => !momRevType || c.service === momRevType);
                const rangeTotal = rows.reduce((sum, c) => sum + c.monthlyRevenue.slice(rStart, rEnd+1).reduce((a,b)=>a+b,0), 0);
                return <span className="tbl-count">{rows.length} rows · {fmtFull(rangeTotal)} in range</span>;
              })()}
            </div>
            <div className="mom-wrap">
              {(() => {
                const rows = clients.filter(c => c.client)
                  .filter(c => !momRevSearch || (c.client + ' ' + (c.service||'')).toLowerCase().includes(momRevSearch.toLowerCase()))
                  .filter(c => !momRevType || c.service === momRevType)
                  .map(c => ({ ...c, rangeTotal: c.monthlyRevenue.slice(rStart, rEnd+1).reduce((a,b)=>a+b,0) }))
                  .sort((a, b) => b.rangeTotal - a.rangeTotal);
                const colTotals = rangeLabels.map((_, i) =>
                  rows.reduce((sum, c) => sum + (c.monthlyRevenue[rStart + i] ?? 0), 0)
                );
                const grandTotal = colTotals.reduce((a,b)=>a+b,0);
                return (
                  <table className="mom-tbl">
                    <thead>
                      <tr>
                        <th className="col-frozen" style={{textAlign:'left', minWidth:220}}>Client · Service</th>
                        <th style={{minWidth:110, color:'var(--blue)'}}>LTV (range)</th>
                        {rangeLabels.map(l => <th key={l} style={{minWidth:110}}>{l}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((c, i) => (
                        <tr key={i}>
                          <td className="col-frozen"><strong>{c.client}</strong>{c.service ? <span style={{color:'var(--muted)', fontWeight:400}}> · {c.service}</span> : null}</td>
                          <td className="num" style={{color:'var(--blue)'}}><strong>{fmtFull(c.rangeTotal)}</strong></td>
                          {rangeLabels.map((_, j) => {
                            const v = c.monthlyRevenue[rStart + j] ?? 0;
                            return <td key={j} className="num">{v > 0 ? fmtFull(v) : <span className="cell-zero">—</span>}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="col-frozen"><strong>Total</strong></td>
                        <td className="num" style={{color:'var(--green)'}}><strong>{fmtFull(grandTotal)}</strong></td>
                        {colTotals.map((v, i) => <td key={i} className="num"><strong>{fmtFull(v)}</strong></td>)}
                      </tr>
                    </tfoot>
                  </table>
                );
              })()}
            </div>
          </div>

          <div className="panel gap">
            <h2>Client Payments</h2>
            <div className="sub">All revenue transactions{labels.length ? ` — ${labels[0]} to ${labels[N-1]}` : ''}</div>
            {(() => {
              const revTxns = transactions.filter(t => t.kind === 'Revenue');
              const cats = [...new Set(revTxns.map(t => t.category))].sort();
              const filtered = revTxns
                .filter(t => !revTxnCat    || t.category === revTxnCat)
                .filter(t => !revTxnSearch || (t.vendor + ' ' + t.description + ' ' + t.category).toLowerCase().includes(revTxnSearch.toLowerCase()))
                .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
              const total = filtered.reduce((a, t) => a + t.amount, 0);
              return (
                <>
                  <div className="filter-bar">
                    <span className="filter-label">Type</span>
                    <select value={revTxnCat} onChange={e => setRevTxnCat(e.target.value)}>
                      <option value="">All Types</option>
                      {cats.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input type="text" placeholder="Search client / vendor…" value={revTxnSearch} onChange={e => setRevTxnSearch(e.target.value)} style={{minWidth:220}} />
                    <span className="tbl-count">{filtered.length} transactions · {fmtFull(total)}</span>
                  </div>
                  <div className="tbl-scroll tbl-scroll-y" style={{maxHeight:440}}>
                    <table>
                      <thead>
                        <tr>
                          <th style={{minWidth:110}}>Date</th>
                          <th>Client / Name</th>
                          <th style={{minWidth:140}}>Type</th>
                          <th className="num">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.length === 0 ? (
                          <tr><td colSpan={4} style={{color:'var(--muted)', padding:16, textAlign:'center'}}>No matching transactions</td></tr>
                        ) : filtered.map((t, i) => (
                          <tr key={i}>
                            <td style={{color:'var(--muted)', fontSize:12}}>{fmtDate(t.date)}</td>
                            <td><strong>{t.vendor || t.description || '—'}</strong></td>
                            <td><span className="pill neutral" style={{textTransform:'none', letterSpacing:0}}>{t.category}</span></td>
                            <td className="num" style={{color:'var(--blue)', fontWeight:700}}>{fmtFull(t.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>

          <LiveFooter sources="Services + Clients" />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          PHASE 1 — EXPENSES
      ══════════════════════════════════════════════════════════════════ */}
      <div className={`page${tab === 'expenses' ? ' active' : ''}`}>
        <div className="page-content">
          <PageHero
            eyebrow="Costs"
            title="Expenses"
            subline={`${rangeLabel} · live from Costs + Finance Model`}
          />

          <InsightsPanel insights={insights.filter(i => i.text.toLowerCase().includes('cogs') || i.text.toLowerCase().includes('opex') || i.text.toLowerCase().includes('margin') || i.text.toLowerCase().includes('cost'))} period={currentPeriod} pillLabel="Expense Insights" />

          {(() => {
            const cogsS = sumRange(pl.cogs);
            const opexS = sumRange(pl.opex);
            const revS  = sumRange(pl.revenue);
            const cogsP = sumPrior(pl.cogs);
            const opexP = sumPrior(pl.opex);
            const dCogs = hasPrior ? mom(cogsS, cogsP) : { cls: 'flat', str: '—' };
            const dOpex = hasPrior ? mom(opexS, opexP) : { cls: 'flat', str: '—' };
            return (
              <div className="kpi-grid">
                <div className="kpi">
                  <div className="label">Total COGS · {rangeLabel}</div>
                  <div className="value">{fmt(cogsS)}</div>
                  <div className={`delta ${dCogs.cls}`}>{arrow(dCogs.cls)} {dCogs.str} vs {deltaLabel}</div>
                </div>
                <div className="kpi amber">
                  <div className="label">Total OpEx · {rangeLabel}</div>
                  <div className="value">{fmt(opexS)}</div>
                  <div className={`delta ${dOpex.cls}`}>{arrow(dOpex.cls)} {dOpex.str} vs {deltaLabel}</div>
                </div>
                <div className="kpi">
                  <div className="label">COGS % of Revenue</div>
                  <div className="value">{revS > 0 ? pct((cogsS / revS) * 100) : '—'}</div>
                  <div className="delta">Across {rangeLen} {rangeLen === 1 ? 'month' : 'months'}</div>
                </div>
                <div className="kpi">
                  <div className="label">Total Spend · {rangeLabel}</div>
                  <div className="value">{fmt(cogsS + opexS)}</div>
                  <div className="delta">COGS + OpEx</div>
                </div>
              </div>
            );
          })()}

          <div className="grid-21 gap">
            <div className="panel">
              <h2>Total Spend by Month</h2>
              <div className="sub">COGS + OpEx stacked by category</div>
              <div className="chart-wrap tall">
                <StackedBarChart
                  labels={rangeLabels}
                  datasets={[...cogsChartData, ...opexChartData].map(d => ({ ...d, data: d.data.slice(rStart, rEnd+1) }))}
                  statuses={pl.months.slice(rStart, rEnd+1).map(m => m.status)}
                />
              </div>
            </div>
            <div className="panel" style={{alignSelf:'start'}}>
              <h2>Expense Category · {currentPeriod}</h2>
              <div className="sub">Breakdown by category and type</div>
              <div className="tbl-scroll-y" style={{maxHeight:340, marginTop:8}}>
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th style={{width:64}}>Type</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cogsCategories.map(c => {
                      const v = c.values[pidx] ?? 0;
                      return v > 0 ? (
                        <tr key={c.name}>
                          <td>{c.name.replace('- Service Delivery','').trim()}</td>
                          <td><span className="pill info">COGS</span></td>
                          <td className="num" style={{color:'var(--red)'}}>{fmtFull(v)}</td>
                        </tr>
                      ) : null;
                    })}
                    <tr className="subtotal">
                      <td><strong>Total COGS</strong></td>
                      <td>—</td>
                      <td className="num"><strong>{fmtFull(pl.cogs[pidx] ?? 0)}</strong></td>
                    </tr>
                    {expenseCategories.filter(e => (e.values[pidx] ?? 0) > 0).map(e => (
                      <tr key={e.name}>
                        <td>{e.name.replace(' Expenses','').replace('and other ','')}</td>
                        <td><span className="pill warn">OpEx</span></td>
                        <td className="num" style={{color:'var(--red)'}}>{fmtFull(e.values[pidx] ?? 0)}</td>
                      </tr>
                    ))}
                    <tr className="subtotal">
                      <td><strong>Total OpEx</strong></td>
                      <td>—</td>
                      <td className="num"><strong>{fmtFull(pl.opex[pidx] ?? 0)}</strong></td>
                    </tr>
                    <tr className="grand-total">
                      <td><strong>Total Expenses</strong></td>
                      <td>—</td>
                      <td className="num"><strong>{fmtFull((pl.cogs[pidx] ?? 0) + (pl.opex[pidx] ?? 0))}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid-2 gap">
            <div className="panel">
              <h2>Cost of Sales Breakdown</h2>
              <div className="sub">COGS by category — {labels[rStart]} – {labels[rEnd]}</div>
              <div className="chart-wrap tall">
                <StackedBarChart
                  labels={rangeLabels}
                  datasets={cogsChartData.map(d => ({ ...d, data: d.data.slice(rStart, rEnd+1) }))}
                  statuses={pl.months.slice(rStart, rEnd+1).map(m => m.status)}
                />
              </div>
              <div className="legend">{cogsChartData.map(d => <div key={d.label} className="legend-item"><div className="legend-dot" style={{background:d.color}} />{d.label}</div>)}</div>
            </div>
            <div className="panel">
              <h2>OpEx Breakdown</h2>
              <div className="sub">Operating expenses — {labels[rStart]} – {labels[rEnd]}</div>
              <div className="chart-wrap tall">
                <StackedBarChart
                  labels={rangeLabels}
                  datasets={opexChartData.map(d => ({ ...d, data: d.data.slice(rStart, rEnd+1) }))}
                  statuses={pl.months.slice(rStart, rEnd+1).map(m => m.status)}
                />
              </div>
              <div className="legend">{opexChartData.map(d => <div key={d.label} className="legend-item"><div className="legend-dot" style={{background:d.color}} />{d.label}</div>)}</div>
            </div>
          </div>

          <div className="panel gap">
            <h2>Spend by Vendor × Category × Month</h2>
            <div className="sub">One row per vendor × category · scroll horizontally · total locked right</div>
            {(() => {
              const buckets = new Map<string, { vendor: string; category: string; monthly: number[] }>();
              for (const t of transactions) {
                if (t.kind !== 'Expense') continue;
                const idx = dateToMonthIdx(t.date, labels);
                if (idx < 0) continue;
                const vendor = t.vendor || '—';
                const key = vendor + '||' + t.category;
                let b = buckets.get(key);
                if (!b) { b = { vendor, category: t.category, monthly: Array(N).fill(0) }; buckets.set(key, b); }
                b.monthly[idx] += t.amount;
              }
              const allRows = [...buckets.values()];
              const cats = [...new Set(allRows.map(r => r.category))].sort();
              const filteredRows = allRows
                .filter(r => !momExpCat    || r.category === momExpCat)
                .filter(r => !momExpSearch || (r.vendor + ' ' + r.category).toLowerCase().includes(momExpSearch.toLowerCase()))
                .map(r => ({ ...r, rangeTotal: r.monthly.slice(rStart, rEnd+1).reduce((a,b)=>a+b,0) }))
                .sort((a,b) => b.rangeTotal - a.rangeTotal);
              const colTotals  = rangeLabels.map((_, i) => filteredRows.reduce((sum, r) => sum + (r.monthly[rStart + i] ?? 0), 0));
              const grandTotal = colTotals.reduce((a,b)=>a+b,0);
              return (
                <>
                  <div className="filter-bar">
                    <input type="text" placeholder="Search vendor…" value={momExpSearch} onChange={e => setMomExpSearch(e.target.value)} style={{minWidth:200}} />
                    <select value={momExpCat} onChange={e => setMomExpCat(e.target.value)}>
                      <option value="">All Categories</option>
                      {cats.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <span className="tbl-count">{filteredRows.length} rows · {fmtFull(grandTotal)} in range</span>
                  </div>
                  <div className="mom-wrap">
                    {filteredRows.length === 0 ? (
                      <div style={{padding:20, color:'var(--muted)', fontSize:13, textAlign:'center'}}>
                        {transactions.length === 0 ? 'No transactions in sheet yet.' : 'No matching rows.'}
                      </div>
                    ) : (
                      <table className="mom-tbl">
                        <thead>
                          <tr>
                            <th className="col-frozen" style={{textAlign:'left', minWidth:200}}>Vendor</th>
                            <th style={{minWidth:180}}>Category</th>
                            <th style={{minWidth:110, color:'var(--amber)'}}>Total (range)</th>
                            {rangeLabels.map(l => <th key={l} style={{minWidth:110}}>{l}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRows.slice(0, 300).map((r, i) => (
                            <tr key={i}>
                              <td className="col-frozen"><strong>{r.vendor}</strong></td>
                              <td style={{fontSize:11, color:'var(--muted)'}}>{r.category}</td>
                              <td className="num" style={{color:'var(--amber)'}}><strong>{fmtFull(r.rangeTotal)}</strong></td>
                              {rangeLabels.map((_, j) => {
                                const v = r.monthly[rStart + j] ?? 0;
                                return <td key={j} className="num" style={{color: v > 0 ? 'var(--red)' : undefined}}>{v > 0 ? fmtFull(v) : <span className="cell-zero">—</span>}</td>;
                              })}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td className="col-frozen"><strong>Total Spend</strong></td>
                            <td>—</td>
                            <td className="num" style={{color:'var(--amber)'}}><strong>{fmtFull(grandTotal)}</strong></td>
                            {colTotals.map((v, i) => <td key={i} className="num"><strong>{fmtFull(v)}</strong></td>)}
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>
                </>
              );
            })()}
          </div>

          <div className="panel gap">
            <h2>Expense Transactions</h2>
            <div className="sub">Full ledger{labels.length ? ` — ${labels[0]} to ${labels[N-1]}` : ''}</div>
            {(() => {
              const expTxns = transactions.filter(t => t.kind === 'Expense');
              const cats = [...new Set(expTxns.map(t => t.category))].sort();
              const filtered = expTxns
                .filter(t => !expTxnCat    || t.category === expTxnCat)
                .filter(t => !expTxnSearch || (t.vendor + ' ' + t.description + ' ' + t.category).toLowerCase().includes(expTxnSearch.toLowerCase()))
                .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
              const total = filtered.reduce((a, t) => a + t.amount, 0);
              return (
                <>
                  <div className="filter-bar">
                    <span className="filter-label">Category</span>
                    <select value={expTxnCat} onChange={e => setExpTxnCat(e.target.value)}>
                      <option value="">All Categories</option>
                      {cats.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input type="text" placeholder="Search vendor / description…" value={expTxnSearch} onChange={e => setExpTxnSearch(e.target.value)} style={{minWidth:220}} />
                    <span className="tbl-count">{filtered.length} transactions · {fmtFull(total)}</span>
                  </div>
                  <div className="tbl-scroll tbl-scroll-y" style={{maxHeight:440}}>
                    <table>
                      <thead>
                        <tr>
                          <th style={{minWidth:110}}>Date</th>
                          <th>Vendor / Description</th>
                          <th style={{minWidth:160}}>Category</th>
                          <th className="num">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.length === 0 ? (
                          <tr><td colSpan={4} style={{color:'var(--muted)', padding:16, textAlign:'center'}}>No matching transactions</td></tr>
                        ) : filtered.map((t, i) => (
                          <tr key={i}>
                            <td style={{color:'var(--muted)', fontSize:12}}>{fmtDate(t.date)}</td>
                            <td><strong>{t.vendor || '—'}</strong>{t.description && t.description !== t.vendor ? <div style={{fontSize:11, color:'var(--muted)', marginTop:2}}>{t.description}</div> : null}</td>
                            <td><span className="pill warn" style={{textTransform:'none', letterSpacing:0}}>{t.category}</span></td>
                            <td className="num" style={{color:'var(--red)', fontWeight:700}}>{fmtFull(t.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>

          <LiveFooter sources="Costs + Finance Model" />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          PHASE 3 — CLIENTS
      ══════════════════════════════════════════════════════════════════ */}
      <div className={`page${tab === 'clients' ? ' active' : ''}`}>
        <div className="page-content">
          <PageHero
            eyebrow="Client profitability"
            title="Clients"
            subline={`${currentPeriod} · live from Client Profit`}
          />

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
            {(() => {
              const byClient = clients.reduce<Record<string, number>>((acc, c) => {
                acc[c.client] = (acc[c.client] ?? 0) + (c.monthlyRevenue[pidx] ?? 0);
                return acc;
              }, {});
              const total = Object.values(byClient).reduce((a,b)=>a+b, 0);
              const sorted = Object.entries(byClient).sort((a,b) => b[1] - a[1]);
              const topShare = total > 0 && sorted.length ? (sorted[0][1] / total) * 100 : 0;
              const level = topShare >= 60 ? 'HIGH' : topShare >= 40 ? 'MEDIUM' : 'LOW';
              const cls   = topShare >= 60 ? 'amber' : topShare >= 40 ? '' : 'green';
              return (
                <div className={`kpi ${cls}`}>
                  <div className="label">Concentration Risk</div>
                  <div className="value">{level}</div>
                  <div className="delta" style={{ color: topShare >= 60 ? 'var(--amber)' : topShare >= 40 ? 'var(--muted)' : 'var(--green)' }}>
                    {sorted[0]?.[0] ?? '—'} {topShare ? `· ${topShare.toFixed(0)}% of rev` : ''}
                  </div>
                </div>
              );
            })()}
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
              <div className="sub">Revenue, cost &amp; margin by service line</div>
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
                    <div style={{marginTop:20, paddingTop:16, borderTop:'1px solid var(--card-border)'}}>
                      <div style={{fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10}}>Pipeline Sources (Tracked)</div>
                      <div style={{display:'flex', flexDirection:'column', gap:6, fontSize:12}}>
                        {Object.entries(sources).map(([s, n]) => (
                          <div key={s} style={{display:'flex', justifyContent:'space-between'}}>
                            <span>{s}</span>
                            <span style={{color:'var(--blue)'}}>{n}</span>
                          </div>
                        ))}
                        {['Ads'].filter(s => !sources[s]).map(s => (
                          <div key={s} style={{display:'flex', justifyContent:'space-between'}}>
                            <span>{s}</span>
                            <span style={{color:'var(--muted)'}}>0 closed</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          <LiveFooter sources="Client Profit" />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          PHASE 3 — PEOPLE
      ══════════════════════════════════════════════════════════════════ */}
      <div className={`page${tab === 'people' ? ' active' : ''}`}>
        <div className="page-content">
          <PageHero
            eyebrow="Team profitability"
            title="People"
            subline={`${currentPeriod} · live from Team Profit`}
          />

          {(() => {
            const active   = teamMembers.filter(m => m.status?.toLowerCase() === 'active');
            const expected = teamMembers.filter(m => m.status?.toLowerCase() === 'expected');
            const billable = active.filter(m => m.costPerHour > 0);
            const avgCph   = billable.length ? billable.reduce((a, m) => a + m.costPerHour, 0) / billable.length : 0;
            const totalHrs = active.reduce((a, m) => a + (m.totalHours || 0), 0);
            const totalSal = active.reduce((a, m) => a + (m.contractedSalary || 0), 0);
            return (
              <div className="kpi-grid">
                <div className="kpi">
                  <div className="label">Team Members</div>
                  <div className="value">{active.length}</div>
                  <div className="delta">{expected.length > 0 ? `+${expected.length} expected · ` : ''}Active delivery team</div>
                </div>
                <div className="kpi green">
                  <div className="label">Avg Cost / Hour</div>
                  <div className="value">${avgCph.toFixed(0)}</div>
                  <div className="delta">Across {billable.length} billable {billable.length === 1 ? 'member' : 'members'}</div>
                </div>
                <div className="kpi">
                  <div className="label">Total Contracted Hrs / Mo</div>
                  <div className="value">{totalHrs} hrs</div>
                  <div className="delta">{fmtFull(totalSal)} / mo payroll</div>
                </div>
                <div className="kpi amber">
                  <div className="label">Clients Served</div>
                  <div className="value">{uniqueClients.filter(c => c.status?.toLowerCase().includes('active')).length}</div>
                  <div className="delta">Active accounts</div>
                </div>
              </div>
            );
          })()}

          <div className="panel gap">
            <h2>Delivery Team</h2>
            <div className="sub">All team members — active and expected</div>
            {teamMembers.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13, padding: 16 }}>No team members in sheet.</div>
            ) : teamMembers.map(m => {
              const isActive   = m.status?.toLowerCase() === 'active';
              const isExpected = m.status?.toLowerCase() === 'expected';
              const pillCls    = isActive ? 'active' : isExpected ? 'warn' : 'neutral';
              return (
                <div key={m.name} className="person-card">
                  <div className="person-avatar">{m.name[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div className="person-name">{m.name}</div>
                    <div className="person-role">{m.department}{m.category ? ` · ${m.category}` : ''}{m.startDate ? ` · Started ${m.startDate}` : ''}</div>
                    <div className="person-stats">
                      <div className="ps-item"><div className="ps-l">Monthly Salary</div><div className="ps-v">{fmtFull(m.contractedSalary)}</div></div>
                      <div className="ps-item"><div className="ps-l">Cost / Hour</div><div className="ps-v">${m.costPerHour > 0 ? m.costPerHour.toFixed(0) : '—'}</div></div>
                      <div className="ps-item"><div className="ps-l">Hours / Mo</div><div className="ps-v">{m.totalHours}</div></div>
                      <div className="ps-item"><div className="ps-l">Status</div><div className="ps-v"><span className={`pill ${pillCls}`}>{m.status}</span></div></div>
                    </div>
                  </div>
                </div>
              );
            })}
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
              <h2>Hours by Service Type</h2>
              <div className="sub">Total hrs required at each intensity level</div>
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
              <div style={{marginTop:16, paddingTop:14, borderTop:'1px solid var(--card-border)'}}>
                <div style={{fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10}}>People Cost Allocation · {currentPeriod}</div>
                <div className="tbl-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>Service</th>
                        <th className="num">People Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientProfits.filter(c => c.peopleCost > 0).map((c, i) => (
                        <tr key={i}>
                          <td>{c.client}</td>
                          <td>{c.service || '—'}</td>
                          <td className="num">{fmtFull(c.peopleCost)}</td>
                        </tr>
                      ))}
                      <tr className="tr-grand">
                        <td colSpan={2}><strong>Total Allocated</strong></td>
                        <td className="num"><strong>{fmtFull(clientProfits.reduce((a, c) => a + c.peopleCost, 0))}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <LiveFooter sources="Team Profit" />
        </div>
      </div>
    </>
    </ErrorBoundary>
  );
}
