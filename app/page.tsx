'use client';

import { useEffect, useState, useCallback } from 'react';
import type { DashboardData } from '@/lib/types';
import {
  TrendChart, MarginChart, StackedBarChart, GroupedBarChart,
  DonutChart, HorizontalBarChart,
  BLUE, GREEN, RED, AMBER, PURPLE, YELLOW,
  fmt, fmtFull,
} from '@/components/Charts';

// ── Helpers ────────────────────────────────────────────────────────────────────
const pct = (v: number) => v.toFixed(1) + '%';
const delta = (a: number, b: number, isMargin = false) => {
  if (b === 0) return '';
  const d = isMargin ? a - b : ((a - b) / Math.abs(b)) * 100;
  const sym = d >= 0 ? '▲' : '▼';
  const cls = d >= 0 ? 'up' : 'down';
  return { sym, cls, val: isMargin ? `${d >= 0 ? '+' : ''}${d.toFixed(1)}pp` : `${d >= 0 ? '+' : ''}${d.toFixed(1)}%` };
};

function DeltaBadge({ a, b, isMargin = false }: { a: number; b: number; isMargin?: boolean }) {
  const d = delta(a, b, isMargin);
  if (!d) return null;
  return <div className={`delta ${d.cls}`}>{d.sym} {d.val} vs prior month</div>;
}

function bar(v: number, max: number, colorClass: string, maxPx = 80) {
  const w = Math.round(Math.abs(v) / Math.max(max, 1) * maxPx);
  return <div className="cell-bar"><span className={`bar ${colorClass}`} style={{ width: w }} /></div>;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('executive');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
      setLastRefresh(new Date());
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  // Auto-refresh every 5 minutes
  useEffect(() => {
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (!data && !error) {
    return (
      <>
        <header className="header">
          <div className="logo"><span>AGEN</span><span className="b">CFO</span><span className="x">×</span>SWELLWAVE MEDIA</div>
        </header>
        <div className="loading-screen">
          <div className="spinner" />
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Fetching live data from Google Sheets…</div>
        </div>
      </>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <>
        <header className="header">
          <div className="logo"><span>AGEN</span><span className="b">CFO</span><span className="x">×</span>SWELLWAVE MEDIA</div>
        </header>
        <div className="error-box">
          <h3>Could not load dashboard data</h3>
          <pre>{error}</pre>
        </div>
      </>
    );
  }

  const { pl, expenseCategories, cogsCategories, clients, clientProfits, teamMembers, serviceCapacity } = data!;
  const N = pl.months.length;
  const labels = pl.months.map(m => m.label);
  const last = N - 1;
  const prev = N - 2;

  // YTD sums
  const ytdRev  = pl.revenue.reduce((a, b) => a + b, 0);
  const ytdNet  = pl.netIncome.reduce((a, b) => a + b, 0);
  const ytdCogs = pl.cogs.reduce((a, b) => a + b, 0);
  const ytdOpex = pl.opex.reduce((a, b) => a + b, 0);
  const avgNet  = pl.netMargin.reduce((a, b) => a + b, 0) / N;

  // Revenue by client line (aggregated across months)
  const clientMonthly = clients.reduce<Record<string, number[]>>((acc, c) => {
    const key = c.client + (c.service ? ` · ${c.service}` : '');
    if (!acc[key]) acc[key] = Array(c.monthlyRevenue.length).fill(0);
    c.monthlyRevenue.forEach((v, i) => { if (i < acc[key].length) acc[key][i] += v; });
    return acc;
  }, {});

  // Unique clients for roster
  const uniqueClients = [...new Map(clients.map(c => [c.client, c])).values()];

  // OpEx top categories for stacked chart (sum > 0 across months)
  const opexChartData = expenseCategories
    .filter(e => e.values.slice(0, N).some(v => v > 0))
    .slice(0, 6)
    .map((e, i) => ({ label: e.name.replace('and other ', ''), data: e.values.slice(0, N), color: [BLUE, GREEN, AMBER, PURPLE, YELLOW, 'rgba(255,255,255,0.25)'][i] }));

  // COGS chart data
  const cogsChartData = cogsCategories.map((c, i) => ({
    label: c.name.replace('- Service Delivery', '').trim(),
    data: c.values.slice(0, N),
    color: [RED, AMBER, PURPLE][i] ?? PURPLE,
  }));

  // Max profit for bar scaling in clients table
  const maxProfit = Math.max(...clientProfits.map(c => Math.abs(c.profit)), 1);

  return (
    <>
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header className="header">
        <div className="logo">
          <span>AGEN</span><span className="b">CFO</span>
          <span className="x">×</span>
          SWELLWAVE MEDIA
        </div>
        <div className="header-right">
          <div className="last-updated">
            Live · refreshed {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            &nbsp;·&nbsp;
            <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: 11, textDecoration: 'underline' }}>
              Refresh
            </button>
          </div>
          <div className="period-badge">
            {labels[0]} – {labels[last]} · {pl.months[last].status}
          </div>
        </div>
      </header>

      {/* ── NAV ────────────────────────────────────────────────────────── */}
      <nav>
        {(['executive', 'revenue', 'expenses', 'clients', 'people'] as const).map(t => (
          <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>

      {/* ══════════════════════════════════════════════════════════════════
          EXECUTIVE
      ══════════════════════════════════════════════════════════════════ */}
      <div className={`page${tab === 'executive' ? ' active' : ''}`}>

        <div className="kpi-grid">
          <div className="kpi">
            <div className="label">Total Revenue · {labels[last]}</div>
            <div className="value">{fmt(pl.revenue[last])}</div>
            <DeltaBadge a={pl.revenue[last]} b={pl.revenue[prev]} />
          </div>
          <div className="kpi green">
            <div className="label">Net Income · {labels[last]}</div>
            <div className="value">{fmt(pl.netIncome[last])}</div>
            <DeltaBadge a={pl.netIncome[last]} b={pl.netIncome[prev]} />
          </div>
          <div className="kpi">
            <div className="label">Net Margin · {labels[last]}</div>
            <div className="value">{pct(pl.netMargin[last])}</div>
            <DeltaBadge a={pl.netMargin[last]} b={pl.netMargin[prev]} isMargin />
          </div>
          <div className="kpi amber">
            <div className="label">Active Clients</div>
            <div className="value">{uniqueClients.filter(c => c.status.toLowerCase().includes('active')).length}</div>
            <div className="delta">— Stable YTD</div>
          </div>
        </div>

        <div className="grid-21 gap">
          <div className="panel">
            <h2>Revenue & Profit Trend</h2>
            <div className="sub">Monthly actuals</div>
            <div className="chart-wrap tall">
              <TrendChart labels={labels} revenue={pl.revenue} cogs={pl.cogs} netIncome={pl.netIncome} />
            </div>
          </div>
          <div className="panel">
            <h2>P&L Summary</h2>
            <div className="sub">By month — all actuals</div>
            <div className="tbl-scroll" style={{ marginTop: 8 }}>
              <table>
                <thead>
                  <tr>
                    <th>Line Item</th>
                    {labels.map(l => <th key={l} className="num">{l.replace(' 20', " '")}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Revenue</td>
                    {pl.revenue.map((v, i) => <td key={i} className="num">{fmtFull(v)}</td>)}
                  </tr>
                  <tr>
                    <td>Cost of Sales</td>
                    {pl.cogs.map((v, i) => <td key={i} className="num" style={{ color: 'var(--red)' }}>-{fmtFull(v)}</td>)}
                  </tr>
                  <tr className="tr-total">
                    <td>Gross Profit</td>
                    {pl.grossProfit.map((v, i) => <td key={i} className="num" style={{ color: 'var(--green)' }}>{fmtFull(v)}</td>)}
                  </tr>
                  <tr>
                    <td style={{ color: 'var(--muted)', fontSize: 11 }}>Gross Margin</td>
                    {pl.grossMargin.map((v, i) => <td key={i} className="num" style={{ color: 'var(--muted)', fontSize: 11 }}>{pct(v)}</td>)}
                  </tr>
                  <tr>
                    <td>Operating Expenses</td>
                    {pl.opex.map((v, i) => <td key={i} className="num" style={{ color: 'var(--red)' }}>-{fmtFull(v)}</td>)}
                  </tr>
                  <tr className="tr-grand">
                    <td><strong>Net Income</strong></td>
                    {pl.netIncome.map((v, i) => <td key={i} className="num">{fmtFull(v)}</td>)}
                  </tr>
                  <tr>
                    <td style={{ color: 'var(--muted)', fontSize: 11 }}>Net Margin</td>
                    {pl.netMargin.map((v, i) => <td key={i} className="num" style={{ color: 'var(--muted)', fontSize: 11 }}>{pct(v)}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="grid-3">
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
              <MarginChart labels={labels} values={pl.netMargin} color={GREEN} min={20} max={45} />
            </div>
          </div>
          <div className="panel">
            <h2>YTD Totals</h2>
            <div className="sub">{labels[0]} – {labels[last]} cumulative</div>
            <div className="stat-row" style={{ flexDirection: 'column', gap: 12, marginTop: 6 }}>
              <div className="stat-item"><div className="sl">YTD Revenue</div><div className="sv">{fmt(ytdRev)}</div></div>
              <div className="stat-item"><div className="sl">YTD Net Income</div><div className="sv" style={{ color: 'var(--green)' }}>{fmt(ytdNet)}</div></div>
              <div className="stat-item"><div className="sl">Avg Net Margin</div><div className="sv">{pct(avgNet)}</div></div>
              <div className="stat-item"><div className="sl">YTD COGS</div><div className="sv" style={{ color: 'var(--red)' }}>{fmt(ytdCogs)}</div></div>
            </div>
          </div>
        </div>

      </div>

      {/* ══════════════════════════════════════════════════════════════════
          REVENUE
      ══════════════════════════════════════════════════════════════════ */}
      <div className={`page${tab === 'revenue' ? ' active' : ''}`}>

        <div className="kpi-grid">
          <div className="kpi">
            <div className="label">Best Month</div>
            <div className="value">{fmt(Math.max(...pl.revenue))}</div>
            <div className="delta">{labels[pl.revenue.indexOf(Math.max(...pl.revenue))]}</div>
          </div>
          <div className="kpi green">
            <div className="label">Growth ({labels[0]}→{labels[last]})</div>
            <div className="value">+{pct(((pl.revenue[last] - pl.revenue[0]) / pl.revenue[0]) * 100)}</div>
            <div className="delta up">▲ {fmt(pl.revenue[0])} → {fmt(pl.revenue[last])}</div>
          </div>
          <div className="kpi">
            <div className="label">Revenue Source</div>
            <div className="value">100%</div>
            <div className="delta">Services</div>
          </div>
          <div className="kpi amber">
            <div className="label">Active Revenue Lines</div>
            <div className="value">{Object.keys(clientMonthly).length}</div>
            <div className="delta">Across {uniqueClients.length} clients</div>
          </div>
        </div>

        <div className="grid-21 gap">
          <div className="panel">
            <h2>Revenue by Client Line</h2>
            <div className="sub">Monthly stacked — all service lines</div>
            <div className="chart-wrap tall">
              <StackedBarChart
                labels={labels}
                datasets={Object.entries(clientMonthly).map(([label, data], i) => ({
                  label, data: data.slice(0, N),
                  color: [BLUE, 'rgba(19,144,235,0.5)', GREEN, PURPLE, YELLOW, AMBER][i % 6],
                }))}
              />
            </div>
          </div>
          <div className="panel">
            <h2>Revenue Mix · {labels[last]}</h2>
            <div className="sub">By service line</div>
            {(() => {
              const lastMonthByLine = Object.entries(clientMonthly)
                .map(([label, vals]) => ({ label, v: vals[last] ?? 0 }))
                .filter(x => x.v > 0);
              const total = lastMonthByLine.reduce((a, x) => a + x.v, 0);
              return (
                <>
                  <DonutChart
                    labels={lastMonthByLine.map(x => x.label)}
                    values={lastMonthByLine.map(x => x.v)}
                    centerLabel={fmt(total)}
                    centerSub="Total"
                  />
                  <div className="legend" style={{ marginTop: 16, justifyContent: 'center' }}>
                    {lastMonthByLine.map((x, i) => (
                      <div key={x.label} className="legend-item">
                        <div className="legend-dot" style={{ background: [BLUE, 'rgba(19,144,235,0.6)', GREEN, PURPLE, YELLOW, AMBER][i % 6] }} />
                        {x.label} ({pct((x.v / total) * 100)})
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        <div className="panel gap">
          <h2>Client Revenue by Month</h2>
          <div className="sub">All service lines — actuals & projected</div>
          <div className="tbl-scroll">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Service</th>
                  <th>Pod</th>
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
                      <td key={j} className="num" style={{ color: v === 0 ? 'var(--muted)' : undefined }}>
                        {v === 0 ? '—' : fmtFull(v)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="tr-grand">
                  <td colSpan={3}><strong>Total Revenue</strong></td>
                  {pl.revenue.map((v, i) => <td key={i} className="num"><strong>{fmtFull(v)}</strong></td>)}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ══════════════════════════════════════════════════════════════════
          EXPENSES
      ══════════════════════════════════════════════════════════════════ */}
      <div className={`page${tab === 'expenses' ? ' active' : ''}`}>

        <div className="kpi-grid">
          <div className="kpi">
            <div className="label">Total COGS · {labels[last]}</div>
            <div className="value">{fmt(pl.cogs[last])}</div>
            <DeltaBadge a={pl.cogs[last]} b={pl.cogs[prev]} />
          </div>
          <div className="kpi amber">
            <div className="label">Total OpEx · {labels[last]}</div>
            <div className="value">{fmt(pl.opex[last])}</div>
            <DeltaBadge a={pl.opex[last]} b={pl.opex[prev]} />
          </div>
          <div className="kpi">
            <div className="label">COGS % of Revenue</div>
            <div className="value">{pct((pl.cogs[last] / pl.revenue[last]) * 100)}</div>
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
            <h2>Cost of Sales Breakdown</h2>
            <div className="sub">Influencer contracts dominate</div>
            <div className="chart-wrap tall">
              <StackedBarChart labels={labels} datasets={cogsChartData} />
            </div>
            <div className="legend">
              {cogsChartData.map(d => (
                <div key={d.label} className="legend-item">
                  <div className="legend-dot" style={{ background: d.color }} />
                  {d.label}
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <h2>Operating Expense Breakdown</h2>
            <div className="sub">Stacked by category</div>
            <div className="chart-wrap tall">
              <StackedBarChart labels={labels} datasets={opexChartData} />
            </div>
            <div className="legend">
              {opexChartData.map(d => (
                <div key={d.label} className="legend-item">
                  <div className="legend-dot" style={{ background: d.color }} />
                  {d.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel gap">
          <h2>Operating Expense Detail</h2>
          <div className="sub">Line-by-line breakdown</div>
          <div className="tbl-scroll">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  {labels.map(l => <th key={l} className="num">{l}</th>)}
                  <th className="num">YTD</th>
                </tr>
              </thead>
              <tbody>
                {expenseCategories.filter(e => e.values.slice(0, N).some(v => v > 0)).map(e => {
                  const ytd = e.values.slice(0, N).reduce((a, b) => a + b, 0);
                  return (
                    <tr key={e.name}>
                      <td>{e.name}</td>
                      {e.values.slice(0, N).map((v, i) => (
                        <td key={i} className="num" style={{ color: v === 0 ? 'var(--muted)' : undefined }}>
                          {v === 0 ? '—' : fmtFull(v)}
                        </td>
                      ))}
                      <td className="num"><strong>{fmtFull(ytd)}</strong></td>
                    </tr>
                  );
                })}
                <tr className="tr-grand">
                  <td><strong>Total OpEx</strong></td>
                  {pl.opex.map((v, i) => <td key={i} className="num"><strong>{fmtFull(v)}</strong></td>)}
                  <td className="num"><strong>{fmtFull(ytdOpex)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ══════════════════════════════════════════════════════════════════
          CLIENTS
      ══════════════════════════════════════════════════════════════════ */}
      <div className={`page${tab === 'clients' ? ' active' : ''}`}>

        <div className="kpi-grid">
          <div className="kpi green">
            <div className="label">Active Clients</div>
            <div className="value">{uniqueClients.filter(c => c.status.toLowerCase().includes('active')).length}</div>
            <div className="delta up">Generating revenue</div>
          </div>
          <div className="kpi">
            <div className="label">Completed / Churned</div>
            <div className="value">{uniqueClients.filter(c => !c.status.toLowerCase().includes('active')).length}</div>
            {uniqueClients.filter(c => !c.status.toLowerCase().includes('active')).map(c => (
              <div key={c.client} className="delta" style={{ color: 'var(--amber)' }}>{c.client}: {c.endReason || 'Completed'}</div>
            ))}
          </div>
          <div className="kpi green">
            <div className="label">Best Client Margin</div>
            <div className="value">{pct(Math.max(...clientProfits.filter(c => c.margin > 0).map(c => c.margin)))}</div>
            <div className="delta up">Top performing line</div>
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
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Start Date</th>
                  <th>Source</th>
                  <th>Team</th>
                  <th>End Reason</th>
                </tr>
              </thead>
              <tbody>
                {uniqueClients.map(c => {
                  const statusClass = c.status.toLowerCase().includes('active') ? 'active' : 'lost';
                  return (
                    <tr key={c.client}>
                      <td><strong>{c.client}</strong></td>
                      <td><span className={`pill ${statusClass}`}>{c.status}</span></td>
                      <td>{c.startDate || '—'}</td>
                      <td>{c.source || '—'}</td>
                      <td>{c.teamMember || '—'}</td>
                      <td style={{ color: c.endReason ? 'var(--amber)' : undefined }}>{c.endReason || '—'}</td>
                    </tr>
                  );
                })}
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
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Service</th>
                    <th>Pod</th>
                    <th className="num">Revenue</th>
                    <th className="num">People Cost</th>
                    <th className="num">Profit</th>
                    <th className="num">Margin</th>
                    <th>Visual</th>
                  </tr>
                </thead>
                <tbody>
                  {clientProfits.map((c, i) => (
                    <tr key={i}>
                      <td><strong>{c.client}</strong></td>
                      <td>{c.service || '—'}</td>
                      <td>{c.pod || '—'}</td>
                      <td className="num">{c.revenue > 0 ? fmtFull(c.revenue) : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                      <td className="num" style={{ color: c.peopleCost > 0 ? 'var(--red)' : undefined }}>
                        {c.peopleCost > 0 ? fmtFull(c.peopleCost) : '—'}
                      </td>
                      <td className="num" style={{ color: c.profit > 0 ? 'var(--green)' : c.profit < 0 ? 'var(--red)' : undefined }}>
                        {c.profit !== 0 ? (c.profit < 0 ? '-' : '') + fmtFull(Math.abs(c.profit)) : '—'}
                      </td>
                      <td className="num" style={{ color: c.margin > 0 ? 'var(--green)' : c.margin < 0 ? 'var(--red)' : undefined }}>
                        {c.margin !== 0 ? pct(c.margin) : 'N/A'}
                      </td>
                      <td>{bar(c.profit, maxProfit, c.profit >= 0 ? 'green' : 'red')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="panel">
            <h2>Acquisition Source</h2>
            <div className="sub">Client mix by channel</div>
            {(() => {
              const sources = uniqueClients.reduce<Record<string, number>>((acc, c) => {
                const s = c.source || 'Unknown';
                acc[s] = (acc[s] ?? 0) + 1;
                return acc;
              }, {});
              return (
                <>
                  <DonutChart
                    labels={Object.keys(sources)}
                    values={Object.values(sources)}
                    centerLabel={String(uniqueClients.length)}
                    centerSub="Clients"
                  />
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

      {/* ══════════════════════════════════════════════════════════════════
          PEOPLE
      ══════════════════════════════════════════════════════════════════ */}
      <div className={`page${tab === 'people' ? ' active' : ''}`}>

        <div className="kpi-grid">
          <div className="kpi">
            <div className="label">Team Members</div>
            <div className="value">{teamMembers.length || 1}</div>
            <div className="delta">Active delivery team</div>
          </div>
          <div className="kpi green">
            <div className="label">Avg Cost / Hour</div>
            <div className="value">${teamMembers[0]?.costPerHour > 0 ? teamMembers[0].costPerHour.toFixed(0) : '333'}</div>
            <div className="delta">{teamMembers[0]?.name || 'Zenen'}</div>
          </div>
          <div className="kpi">
            <div className="label">Contracted Hrs / Mo</div>
            <div className="value">{teamMembers[0]?.totalHours || 30} hrs</div>
            <div className="delta">Per team member</div>
          </div>
          <div className="kpi amber">
            <div className="label">Clients Served</div>
            <div className="value">{uniqueClients.filter(c => c.status.toLowerCase().includes('active')).length}</div>
            <div className="delta">Active accounts</div>
          </div>
        </div>

        <div className="panel gap">
          <h2>Delivery Team</h2>
          <div className="sub">Active service team members and engagement details</div>
          {(teamMembers.length > 0 ? teamMembers : [{
            name: 'Zenen Chamizo', status: 'Active', department: 'Service Team',
            category: 'Delivery Team', startDate: '10-Aug-23',
            totalHours: 30, contractedSalary: 10000, costPerHour: 333,
          }]).map(m => (
            <div key={m.name} className="person-card">
              <div className="person-avatar">{m.name[0]}</div>
              <div style={{ flex: 1 }}>
                <div>
                  <div className="person-name">{m.name}</div>
                  <div className="person-role">{m.department} · {m.category} · Started {m.startDate}</div>
                </div>
                <div className="person-stats">
                  <div className="ps-item"><div className="ps-l">Monthly Salary</div><div className="ps-v">{fmtFull(m.contractedSalary)}</div></div>
                  <div className="ps-item"><div className="ps-l">Cost / Hour</div><div className="ps-v">${m.costPerHour > 0 ? m.costPerHour.toFixed(0) : 333}</div></div>
                  <div className="ps-item"><div className="ps-l">Contracted Hours</div><div className="ps-v">{m.totalHours} hrs/mo</div></div>
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
            {serviceCapacity.length > 0 ? (
              <div className="tbl-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Intensity</th>
                      <th className="num">Media Buying</th>
                      <th className="num">Leadership</th>
                      <th className="num">Client Success</th>
                      <th className="num">Total Hrs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceCapacity.map((s, i) => (
                      <tr key={i}>
                        <td><strong>{s.service}</strong></td>
                        <td>
                          <span className={`pill ${s.intensity === 'High' ? 'active' : s.intensity === 'Mid' ? 'warn' : 'info'}`}>
                            {s.intensity}
                          </span>
                        </td>
                        <td className="num">{s.mediaBuying}</td>
                        <td className="num">{s.leadership}</td>
                        <td className="num">{s.clientSuccess}</td>
                        <td className="num"><strong>{s.totalHours}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              // Fallback hardcoded data
              <div className="tbl-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Service</th><th>Intensity</th>
                      <th className="num">Media Buying</th><th className="num">Leadership</th>
                      <th className="num">Client Success</th><th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { s: 'Google Ads', i: 'Low',  mb: 20, ld: 0,  cs: 10 },
                      { s: 'Google Ads', i: 'Mid',  mb: 25, ld: 4,  cs: 15 },
                      { s: 'Google Ads', i: 'High', mb: 30, ld: 10, cs: 20 },
                      { s: 'Meta Ads',   i: 'Low',  mb: 8,  ld: 0,  cs: 4  },
                      { s: 'Meta Ads',   i: 'Mid',  mb: 10, ld: 2,  cs: 6  },
                      { s: 'Meta Ads',   i: 'High', mb: 30, ld: 10, cs: 20 },
                      { s: 'Email Mktg', i: 'Low',  mb: 8,  ld: 0,  cs: 4  },
                      { s: 'Email Mktg', i: 'Mid',  mb: 10, ld: 2,  cs: 6  },
                      { s: 'Email Mktg', i: 'High', mb: 30, ld: 10, cs: 20 },
                    ].map((r, i) => (
                      <tr key={i}>
                        <td><strong>{r.s}</strong></td>
                        <td><span className={`pill ${r.i === 'High' ? 'active' : r.i === 'Mid' ? 'warn' : 'info'}`}>{r.i}</span></td>
                        <td className="num">{r.mb}</td><td className="num">{r.ld}</td>
                        <td className="num">{r.cs}</td><td className="num"><strong>{r.mb + r.ld + r.cs}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="panel">
            <h2>Hours by Service & Intensity</h2>
            <div className="sub">Total capacity required</div>
            <div className="chart-wrap med">
              <HorizontalBarChart
                labels={
                  serviceCapacity.length > 0
                    ? serviceCapacity.map(s => `${s.service} ${s.intensity}`)
                    : ['GA Low', 'GA Mid', 'GA High', 'Meta Low', 'Meta Mid', 'Meta High', 'Email Low', 'Email Mid', 'Email High']
                }
                datasets={[
                  {
                    label: 'Media Buying',
                    data: serviceCapacity.length > 0
                      ? serviceCapacity.map(s => s.mediaBuying)
                      : [20, 25, 30, 8, 10, 30, 8, 10, 30],
                    color: 'rgba(19,144,235,0.75)',
                  },
                  {
                    label: 'Leadership',
                    data: serviceCapacity.length > 0
                      ? serviceCapacity.map(s => s.leadership)
                      : [0, 4, 10, 0, 2, 10, 0, 2, 10],
                    color: 'rgba(34,197,94,0.7)',
                  },
                  {
                    label: 'Client Success',
                    data: serviceCapacity.length > 0
                      ? serviceCapacity.map(s => s.clientSuccess)
                      : [10, 15, 20, 4, 6, 20, 4, 6, 20],
                    color: 'rgba(192,132,252,0.7)',
                  },
                ]}
              />
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
