import { useLayoutEffect, useRef, useState } from 'react';
import { fmt, md } from '../aggregate';
import { dow } from '../data';
import Icon from './Icon';

// ---- 共通 ----
function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(600);
  useLayoutEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.floor(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const niceMax = (v) => {
  if (v <= 0) return 10;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};

export const pColor = (p) => `var(--p${p.color})`;

export function Tooltip({ tip }) {
  if (!tip) return null;
  return (
    <div className="tip" style={{ left: tip.x, top: tip.y }} role="status">
      {tip.title && <div className="tip-title">{tip.title}</div>}
      {tip.rows.map((r) => (
        <div key={r.label} className="tip-row">
          {r.color && <i style={{ background: r.color }} />}
          <span>{r.label}</span>
          <b>{r.value}</b>
        </div>
      ))}
      {tip.foot && <div className="tip-foot"><span>{tip.foot[0]}</span><b>{tip.foot[1]}</b></div>}
    </div>
  );
}

export function Legend({ products }) {
  return (
    <div className="legend">
      {products.map((p) => <span key={p.code}><i style={{ background: pColor(p) }} />{p.name}</span>)}
    </div>
  );
}

// ---- KPI のスパークライン（単一系列なので中立色） ----
export function Sparkline({ data, height = 36 }) {
  const [ref, w] = useWidth();
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const pts = data.map((v, i) => [(i / Math.max(1, data.length - 1)) * (w - 8) + 4, height - 4 - ((v - min) / (max - min || 1)) * (height - 10)]);
  const last = pts[pts.length - 1];
  return (
    <div ref={ref} className="spark">
      <svg width={w} height={height} aria-hidden="true">
        <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--ink-2)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {last && <circle cx={last[0]} cy={last[1]} r="4" fill="var(--ink-1)" stroke="var(--surface)" strokeWidth="2" />}
      </svg>
    </div>
  );
}

// ---- 日別・商品別の積み上げ棒 ----
export function StackedBars({ series, products, height = 300, unit = '本' }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const m = { l: 48, r: 12, t: 22, b: 30 };
  const totals = series.map((s) => products.reduce((t, p) => t + (s.values[p.code] || 0), 0));
  const yMax = niceMax(Math.max(...totals, 1) * 1.08);
  const ih = height - m.t - m.b;
  const iw = w - m.l - m.r;
  const band = iw / Math.max(1, series.length);
  const bw = Math.max(4, Math.min(34, band * 0.62));
  const y = (v) => m.t + ih - (v / yMax) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * yMax);
  const every = series.length > 20 ? 4 : series.length > 10 ? 2 : 1;
  const maxIdx = totals.indexOf(Math.max(...totals));

  const tip = hover === null ? null : {
    x: Math.min(Math.max(m.l + band * hover + band / 2, 90), w - 90),
    y: 6,
    title: `${md(series[hover].date)}（${'日月火水木金土'[dow(series[hover].date)]}）`,
    rows: [...products].reverse().map((p) => ({ label: p.name, value: `${fmt(series[hover].values[p.code] || 0)}${unit}`, color: pColor(p) })),
    foot: ['合計', `${fmt(totals[hover])}${unit}`]
  };

  return (
    <div ref={ref} className="chart-wrap" onMouseLeave={() => setHover(null)}>
      <svg width={w} height={height} role="img" aria-label="日別・商品別の積み上げ棒グラフ">
        {series.map((s, i) => (dow(s.date) === 0 || dow(s.date) === 6) && (
          <rect key={`we${i}`} x={m.l + band * i} y={m.t} width={band} height={ih} fill="var(--weekend)" />
        ))}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--axis)' : 'var(--grid)'} strokeWidth="1" />
            <text x={m.l - 8} y={y(t) + 4} textAnchor="end" className="tick">{fmt(t)}</text>
          </g>
        ))}
        {hover !== null && <rect x={m.l + band * hover} y={m.t} width={band} height={ih} fill="var(--hover)" />}
        {series.map((s, i) => {
          let acc = 0;
          const x = m.l + band * i + (band - bw) / 2;
          const visible = products.filter((p) => (s.values[p.code] || 0) > 0);
          return (
            <g key={s.date}>
              {visible.map((p, k) => {
                const v = s.values[p.code];
                const y0 = y(acc);
                acc += v;
                const y1 = y(acc);
                const isTop = k === visible.length - 1;
                const h = Math.max(0, y0 - y1 - (isTop ? 0 : 2)); // 2px のすき間
                const top = y0 - h;
                const r = isTop ? Math.min(4, h, bw / 2) : 0;
                const d = `M${x},${y0} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${y0} Z`;
                return <path key={p.code} d={d} fill={pColor(p)} opacity={hover === null || hover === i ? 1 : 0.55} />;
              })}
              {(i === series.length - 1 || i === maxIdx) && totals[i] > 0 && (
                <text x={x + bw / 2} y={y(totals[i]) - 7} textAnchor="middle" className="direct">{fmt(totals[i])}</text>
              )}
              {i % every === (series.length - 1) % every && (
                <text x={m.l + band * i + band / 2} y={height - 10} textAnchor="middle" className="tick">{md(s.date)}</text>
              )}
              <rect x={m.l + band * i} y={m.t} width={band} height={ih + m.b} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={-1} />
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

// ---- 在庫（バレット：棒＝在庫、縦線＝安全在庫） ----
const STATUS = {
  good: { label: '適正', icon: 'check' },
  warning: { label: '注意', icon: 'alert' },
  critical: { label: '不足', icon: 'alert' }
};

export function InventoryBullets({ items }) {
  const max = niceMax(Math.max(...items.map((i) => Math.max(i.stock, i.safety * 2))));
  return (
    <div className="bullets">
      {items.map((i) => (
        <div key={i.code} className="bullet">
          <div className="bullet-head">
            <span className="bullet-name"><i style={{ background: pColor(i) }} />{i.name}</span>
            <span className={`status st-${i.status}`}><Icon name={STATUS[i.status].icon} size={13} stroke={2.6} />{STATUS[i.status].label}</span>
          </div>
          <div className="bullet-track" title={`在庫 ${fmt(i.stock)}本／安全在庫 ${fmt(i.safety)}本`}>
            <div className="bullet-fill" style={{ width: `${(i.stock / max) * 100}%`, background: pColor(i) }} />
            <div className="bullet-safety" style={{ left: `${(i.safety / max) * 100}%` }} />
          </div>
          <div className="bullet-meta">
            <b>{fmt(i.stock)}<small>本</small></b>
            <span>安全在庫 <b>{fmt(i.safety)}</b></span>
            <span>在庫日数 <b>{i.cover.toFixed(1)}</b>日</span>
            <span>受注残 <b>{fmt(i.backlog)}</b>本</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- 取引先・チャネル別（単一系列＝中立色の横棒） ----
export function PartyBars({ rows, limit = 8 }) {
  const max = Math.max(...rows.map((r) => r.order), 1);
  return (
    <div className="party">
      {rows.slice(0, limit).map((r, i) => (
        <div key={r.key} className="party-row">
          <span className="party-rank">{i + 1}</span>
          <div className="party-main">
            <div className="party-top">
              <span>{r.name}<em className={`kind k-${r.kind}`}>{r.kind}</em></span>
              <b>{fmt(r.order)}<small>本</small></b>
            </div>
            <div className="party-track"><i style={{ width: `${(r.order / max) * 100}%` }} /></div>
            <small className="party-sub">出荷 {fmt(r.ship)}本・出荷率 {r.order ? Math.round((r.ship / r.order) * 100) : 0}%</small>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- 商品×日 の出荷ヒートマップ（単色の濃淡） ----
export function Heatmap({ days, products, valueOf }) {
  const [hover, setHover] = useState(null);
  const vals = products.flatMap((p) => days.map((d) => valueOf(d, p.code)));
  const max = Math.max(...vals, 1);
  return (
    <div className="heat" onMouseLeave={() => setHover(null)}>
      <div className="heat-grid" style={{ gridTemplateColumns: `104px repeat(${days.length}, minmax(0, 1fr))`, "--cols": days.length }}>
        {products.map((p) => (
          <div key={p.code} className="heat-row" style={{ display: 'contents' }}>
            <span className="heat-label"><i style={{ background: pColor(p) }} />{p.name}</span>
            {days.map((d) => {
              const v = valueOf(d, p.code);
              const on = hover && hover.d === d && hover.p === p.code;
              return (
                <span
                  key={d}
                  className={`heat-cell ${on ? 'on' : ''}`}
                  style={{ '--a': 0.06 + (v / max) * 0.88 }}
                  onMouseEnter={() => setHover({ d, p: p.code, v, name: p.name })}
                  title={`${p.name} ${md(d)}：${fmt(v)}本`}
                />
              );
            })}
          </div>
        ))}
        <span />
        {days.map((d, i) => <span key={d} className="heat-x">{i % Math.ceil(days.length / 7) === (days.length - 1) % Math.ceil(days.length / 7) ? md(d) : ''}</span>)}
      </div>
      <div className="heat-foot">
        <span className="heat-read">{hover ? `${hover.name}・${md(hover.d)}：${fmt(hover.v)}本` : 'セルにカーソルを合わせると数量を表示'}</span>
        <span className="heat-scale">0<i />{fmt(max)}本</span>
      </div>
    </div>
  );
}

// ---- 表ビュー（すべてのグラフに用意） ----
export function DataTable({ head, rows }) {
  return (
    <div className="dtable-wrap">
      <table className="dtable">
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
