import { useState } from 'react';
import { useVaultStore } from '@/lib/store';
import { fmt, orderTotal, statusLabel, toDateInputValue, inDateRange } from '@/lib/utils';
import Icon from '@/components/Icon';

type ChartType = 'bar' | 'area' | 'column' | 'waterfall' | 'donut';

export default function Analytics() {
  const orders   = useVaultStore((s) => s.orders);
  const items    = useVaultStore((s) => s.items);
  const settings = useVaultStore((s) => s.settings);
  const platforms = settings.platforms ?? [];

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [chartType, setChartType] = useState<ChartType>('bar');

  function togglePlatform(p: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  function applyPreset(preset: 'all' | 'today' | 'week' | 'month') {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'all') { setDateFrom(''); setDateTo(''); return; }
    if (preset === 'today') {
      const t = toDateInputValue(now); setDateFrom(t); setDateTo(t);
    } else if (preset === 'week') {
      const start = new Date(now); start.setDate(now.getDate() - now.getDay() + 1); start.setHours(0, 0, 0, 0);
      setDateFrom(toDateInputValue(start)); setDateTo(toDateInputValue(now));
    } else if (preset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setDateFrom(toDateInputValue(start)); setDateTo(toDateInputValue(now));
    }
  }

  const visibleOrders = (() => {
    let list = selectedPlatforms.length === 0 ? orders : orders.filter((o) => selectedPlatforms.includes(o.source));
    if (dateFrom || dateTo) list = list.filter((o) => inDateRange(o.createdAt, dateFrom, dateTo));
    return list;
  })();

  const done  = visibleOrders.filter((o) => o.status === 'done');
  const now   = new Date();
  const rev   = (arr: typeof done) => arr.reduce((a, o) => a + orderTotal(o), 0);

  const todayStr   = now.toDateString();
  const todayO     = done.filter((o) => new Date(o.createdAt).toDateString() === todayStr);
  const weekStart  = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1); weekStart.setHours(0,0,0,0);
  const weekO      = done.filter((o) => new Date(o.createdAt) >= weekStart);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthO     = done.filter((o) => new Date(o.createdAt) >= monthStart);

  // Last 7 days
  const days7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(now.getDate() - (6 - i));
    const ds = d.toDateString();
    return { label: d.toLocaleDateString(undefined, { weekday:'short', day:'numeric' }), val: rev(done.filter((o) => new Date(o.createdAt).toDateString() === ds)) };
  });
  const maxD7 = Math.max(...days7.map((x) => x.val), 1);

  // Item revenue
  const itemRev: Record<string, number> = {};
  done.forEach((o) => o.items.forEach((oi) => { itemRev[oi.itemId] = (itemRev[oi.itemId] || 0) + oi.price * oi.qty; }));
  const topItems = Object.entries(itemRev).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([id, val]) => ({ item: items.find((i) => i.id === id), val })).filter((x) => x.item);
  const maxIR = Math.max(...topItems.map((x) => x.val), 1);

  const allStatuses = ['waiting', 'accepted', 'delivered', 'waiting_payment', 'payment_complete', 'done'] as const;
  const statusColors: Record<string, string> = { done:'var(--green)', waiting:'#a16207', accepted:'var(--orange)', delivered:'var(--accent)', waiting_payment:'var(--purple)', payment_complete:'#0f766e' };

  function Bar({ val, max, color }: { val: number; max: number; color?: string }) {
    return (
      <div className="chart-bar-track">
        <div className="chart-bar-fill" style={{ width: `${val ? Math.round(val / max * 100) : 0}%`, ...(color ? { background: color } : {}) }} />
      </div>
    );
  }

  function ChartToggle({ value, onChange }: { value: ChartType; onChange: (t: ChartType) => void }) {
    const types: { key: ChartType; label: string }[] = [
      { key: 'bar',    label: 'Bar'    },
      { key: 'column', label: 'Column' },
      { key: 'area',   label: 'Area'   },
      { key: 'waterfall', label: 'Waterfall' },
      { key: 'donut',  label: 'Donut'  },
    ];
    return (
      <div style={{ display:'flex', gap:4 }}>
        {types.map(({ key, label }) => (
          <button
            key={key}
            className={`btn btn-xs ${value === key ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize:11, padding:'2px 8px' }}
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  function SvgChart({ data, max, color, type }: { data: { label: string; val: number }[]; max: number; color?: string; type: 'area' | 'column' | 'waterfall' | 'donut' }) {
    const W = 400;
    const H = 160;
    const pad = { top: 10, bottom: 28, left: 8, right: 8 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;
    const n = data.length;
    const fill = color || 'var(--accent)';
    const baseY = pad.top + chartH;
    const PIE_COLORS = ['var(--accent)', '#7c3aed', 'var(--green)', 'var(--orange)', '#0f766e', '#a16207', '#e11d48', '#0284c7'];

    if (type === 'waterfall') {
      const total = data.reduce((a, d) => a + d.val, 0);
      const wMax  = Math.max(total, max, 1);
      const gap   = chartW / n;
      const colW  = Math.max(4, gap * 0.55);
      let cumulative = 0;
      const bars = data.map((d, i) => {
        const startPct = cumulative / wMax;
        const heightPct = d.val / wMax;
        cumulative += d.val;
        const cx2 = pad.left + gap * i + gap / 2;
        const barH = heightPct * chartH;
        const barY = baseY - (startPct + heightPct) * chartH;
        return { cx2, barY, barH, d, i, prev: startPct * chartH };
      });

      return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:H, overflow:'visible' }}>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1={pad.left} x2={W - pad.right} y1={pad.top + chartH * (1 - f)} y2={pad.top + chartH * (1 - f)} stroke="var(--border)" strokeWidth={0.5} />
          ))}
          {bars.map((b, i) => (
            <g key={i}>
              <rect x={b.cx2 - colW / 2} y={b.barY} width={colW} height={Math.max(b.barH, 1)} fill={fill} rx={2} fillOpacity={0.85 + i * 0.02} />
              {i < bars.length - 1 && (
                <line
                  x1={b.cx2 + colW / 2} y1={b.barY}
                  x2={bars[i + 1].cx2 - colW / 2} y2={b.barY}
                  stroke="var(--text-hint)" strokeWidth={0.8} strokeDasharray="3,2"
                />
              )}
            </g>
          ))}
          {bars.map((b, i) => (
            <text key={i} x={b.cx2} y={H - 4} textAnchor="middle" fontSize={9} fill="var(--text-hint)">
              {b.d.label.split(' ')[0]}
            </text>
          ))}
        </svg>
      );
    }

    if (type === 'column') {
      const gap  = chartW / n;
      const colW = Math.max(4, gap * 0.6);
      return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:H, overflow:'visible' }}>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1={pad.left} x2={W - pad.right} y1={pad.top + chartH * (1 - f)} y2={pad.top + chartH * (1 - f)} stroke="var(--border)" strokeWidth={0.5} />
          ))}
          {data.map((d, i) => {
            const h = max > 0 ? (d.val / max) * chartH : 0;
            const cx2 = pad.left + gap * i + gap / 2;
            return <rect key={i} x={cx2 - colW / 2} y={baseY - h} width={colW} height={h} fill={fill} rx={2} />;
          })}
          {data.map((d, i) => (
            <text key={i} x={pad.left + (chartW / n) * i + (chartW / n) / 2} y={H - 4} textAnchor="middle" fontSize={9} fill="var(--text-hint)">
              {d.label.split(' ')[0]}
            </text>
          ))}
        </svg>
      );
    }

    // area
    const pts = data.map((d, i) => ({
      x: pad.left + (n > 1 ? (i / (n - 1)) * chartW : chartW / 2),
      y: pad.top + chartH - (max > 0 ? (d.val / max) * chartH : 0),
      label: d.label,
    }));
    const polyline = pts.map((p) => `${p.x},${p.y}`).join(' ');
    const areaPath = n > 1
      ? `M${pts[0].x},${baseY} ` + pts.map((p) => `L${p.x},${p.y}`).join(' ') + ` L${pts[n - 1].x},${baseY} Z`
      : '';
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:H, overflow:'visible' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad.left} x2={W - pad.right} y1={pad.top + chartH * (1 - f)} y2={pad.top + chartH * (1 - f)} stroke="var(--border)" strokeWidth={0.5} />
        ))}
        {n > 1 && <path d={areaPath} fill={fill} fillOpacity={0.15} />}
        {n > 1 && <polyline points={polyline} fill="none" stroke={fill} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill={fill} />)}
        {pts.map((p, i) => (
          <text key={i} x={p.x} y={H - 4} textAnchor="middle" fontSize={9} fill="var(--text-hint)">
            {p.label.split(' ')[0]}
          </text>
        ))}
      </svg>
    );
  }

  return (
    <>
      <div className="section-title"><Icon name="analytics" size={18} style={{ marginRight: 8 }} />Analytics Dashboard</div>

      {/* Platform filter + Chart type toggle — side by side */}
      <div style={{ display:'flex', gap:12, marginBottom:16 }}>
        <div className="card" style={{ flex:1, padding:'12px 16px' }}>
          <div style={{ fontSize:12, color:'var(--text-hint)', fontWeight:600, marginBottom:8 }}>Filter by Platform</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            <button
              className={`btn btn-sm ${selectedPlatforms.length === 0 ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setSelectedPlatforms([])}
            >
              All
            </button>
            {platforms.map((p) => (
              <button
                key={p}
                className={`btn btn-sm ${selectedPlatforms.includes(p) ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => togglePlatform(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="card" style={{ padding:'12px 16px', flexShrink:0 }}>
          <div style={{ fontSize:12, color:'var(--text-hint)', fontWeight:600, marginBottom:8 }}>Chart Type</div>
          <ChartToggle value={chartType} onChange={setChartType} />
        </div>
      </div>

      {/* Date range filter */}
      <div className="card" style={{ marginBottom:16, padding:'12px 16px' }}>
        <div style={{ fontSize:12, color:'var(--text-hint)', marginBottom:8, fontWeight:600 }}>Filter by Date</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
          {(['all', 'today', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              className={`btn btn-sm ${datePreset === p ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => applyPreset(p)}
            >
              {p === 'all' ? 'All Time' : p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
          <span style={{ fontSize:12, color:'var(--text-hint)' }}>or custom:</span>
          <input
            type="date"
            className="inp inp-sm"
            style={{ width:140 }}
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setDatePreset('all'); }}
          />
          <span style={{ fontSize:12, color:'var(--text-hint)' }}>to</span>
          <input
            type="date"
            className="inp inp-sm"
            style={{ width:140 }}
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setDatePreset('all'); }}
          />
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom:20 }}>
        {[
          { label:'Today',      val: rev(todayO), cnt: todayO.length },
          { label:'This Week',  val: rev(weekO),  cnt: weekO.length },
          { label:'This Month', val: rev(monthO), cnt: monthO.length },
          { label:'All Time',   val: rev(done),   cnt: done.length },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{fmt(s.val)} <span style={{ fontSize:14, fontWeight:500 }}>$ USD</span></div>
            <div className="stat-sub">{s.cnt} orders</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom:20 }}>
        <div className="card">
          <div className="card-title">Revenue — Last 7 Days</div>
          {chartType === 'bar' ? (
            <div className="chart-bar-wrap">
              {days7.map((d) => (
                <div key={d.label} className="chart-bar-row">
                  <div className="chart-bar-label">{d.label}</div>
                  <Bar val={d.val} max={maxD7} />
                  <div className="chart-bar-val">{fmt(d.val)}</div>
                </div>
              ))}
            </div>
          ) : (
            <SvgChart data={days7} max={maxD7} type={chartType as 'area' | 'column' | 'waterfall' | 'donut'} />
          )}
        </div>
        <div className="card">
          <div className="card-title">Revenue by Item</div>
          {topItems.length === 0 ? (
            <div className="empty-state" style={{ padding:16 }}>No data</div>
          ) : chartType === 'bar' ? (
            <div className="chart-bar-wrap">
              {topItems.map((x) => (
                <div key={x.item!.id} className="chart-bar-row">
                  <div className="chart-bar-label">{x.item!.name}</div>
                  <Bar val={x.val} max={maxIR} color="#7c3aed" />
                  <div className="chart-bar-val">{fmt(x.val)}</div>
                </div>
              ))}
            </div>
          ) : (
            <SvgChart
              data={topItems.map((x) => ({ label: x.item!.name, val: x.val }))}
              max={maxIR}
              color="#7c3aed"
              type={chartType as 'area' | 'column' | 'waterfall' | 'donut'}
            />
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom:20 }}>
        <div className="card-title">Order Status Breakdown</div>
        <div className="status-grid">
          {allStatuses.map((s) => {
            const cnt    = visibleOrders.filter((o) => o.status === s).length;
            const pct    = Math.round(cnt / (visibleOrders.length || 1) * 100);
            const revenue = rev(visibleOrders.filter((o) => o.status === s) as typeof done);
            return (
              <div key={s} style={{ textAlign:'center', padding:16, borderRadius:8, background:'var(--bg-card-inner, var(--bg-2))', border:'1px solid var(--border)' }}>
                <div style={{ fontSize:36, fontWeight:800, color: statusColors[s] }}>{cnt}</div>
                <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:4, fontWeight:600 }}>{statusLabel(s)}</div>
                <div style={{ fontSize:11, color:'var(--text-hint)', marginTop:2 }}>{pct}% of all</div>
                {revenue > 0 && <div style={{ fontSize:12, color: statusColors[s], marginTop:6, fontWeight:600 }}>{fmt(revenue)} $</div>}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
