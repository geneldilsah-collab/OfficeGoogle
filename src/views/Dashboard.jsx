import { useState } from 'react';
import Icon, { DEPT_ICON } from '../components/Icon';
import { DataTable, Heatmap, InventoryBullets, Legend, PartyBars, Sparkline, StackedBars } from '../components/Charts';
import { CHANNELS, CUSTOMERS, DEPTS, PRODUCTS, TODAY } from '../data';
import { fmt, md } from '../aggregate';

const METRICS = [
  { key: 'good', label: '製造（良品）' },
  { key: 'order', label: '受注' },
  { key: 'ship', label: '出荷' }
];

export function Delta({ k }) {
  if (k.prev === null || k.prev === undefined || k.prev === 0) return <span className="delta muted">前期間データなし</span>;
  const diff = k.value - k.prev;
  const pct = (diff / k.prev) * 100;
  const flat = Math.abs(pct) < 0.5;
  const good = k.key === 'stock' ? null : (k.lowerIsBetter ? diff < 0 : diff > 0);
  const cls = flat || good === null ? 'neutral' : good ? 'up-good' : 'up-bad';
  return (
    <span className={`delta ${cls}`}>
      {!flat && <Icon name={diff > 0 ? 'up' : 'down'} size={12} stroke={2.6} />}
      {flat ? '横ばい' : `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`}
      <small>{k.point ? '前期間末比' : '前期間比'}</small>
    </span>
  );
}

export function KpiTiles({ view }) {
  return (
    <section className="kpis">
      {view.kpis.map((k) => (
        <article key={k.key} className="kpi">
          <div className="kpi-top"><span>{k.label}</span><em>{k.dept}</em></div>
          <div className="kpi-value">{fmt(k.value)}<small>{k.unit}</small></div>
          <Delta k={k} />
          <Sparkline data={k.spark} />
        </article>
      ))}
    </section>
  );
}

export function Card({ title, sub, actions, table, children, className = '' }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={`card ${className}`}>
      <header className="card-head">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        <div className="card-actions">
          {actions}
          {table && (
            <button type="button" className={`ghost-btn ${asTable ? 'is-on' : ''}`} onClick={() => setAsTable(!asTable)} title="表で見る">
              <Icon name={asTable ? 'chart' : 'table'} size={15} />{asTable ? 'グラフ' : '表'}
            </button>
          )}
        </div>
      </header>
      {asTable && table ? table() : children}
    </section>
  );
}

export function DailyChart({ view, height = 300 }) {
  const [metric, setMetric] = useState('ship');
  const series = view.series(metric);
  const label = METRICS.find((m) => m.key === metric).label;
  return (
    <Card
      className="span-2"
      title={`日別・商品別の${label}数`}
      sub="土日は背景を薄く表示。最新日と最大日に合計値を表示しています"
      actions={(
        <div className="seg sm" role="group" aria-label="指標">
          {METRICS.map((m) => <button key={m.key} type="button" className={metric === m.key ? 'is-active' : ''} onClick={() => setMetric(m.key)}>{m.label}</button>)}
        </div>
      )}
      table={() => (
        <DataTable
          head={['日付', ...view.products.map((p) => p.name), '合計']}
          rows={series.map((s) => [md(s.date), ...view.products.map((p) => fmt(s.values[p.code])), fmt(view.products.reduce((t, p) => t + s.values[p.code], 0))])}
        />
      )}
    >
      <Legend products={view.products} />
      <StackedBars series={series} products={view.products} height={height} />
    </Card>
  );
}

export function InventoryCard({ view }) {
  return (
    <Card
      title="商品別の在庫"
      sub={`${md(view.last)}時点・在庫日数は直近7日の平均出荷から算出`}
      table={() => (
        <DataTable head={['商品', '在庫', '安全在庫', '在庫日数', '受注残']} rows={view.inventory.map((i) => [i.name, fmt(i.stock), fmt(i.safety), `${i.cover.toFixed(1)}日`, fmt(i.backlog)])} />
      )}
    >
      <InventoryBullets items={view.inventory} />
    </Card>
  );
}

export function PartyCard({ view }) {
  return (
    <Card
      title="取引先・チャネル別の受注"
      sub={`直近${view.days.length}日・選択中の商品`}
      table={() => <DataTable head={['取引先・チャネル', '区分', '受注', '出荷', '出荷率']} rows={view.parties.map((r) => [r.name, r.kind, fmt(r.order), fmt(r.ship), `${r.order ? Math.round((r.ship / r.order) * 100) : 0}%`])} />}
    >
      <PartyBars rows={view.parties} limit={6} />
    </Card>
  );
}

export function HeatCard({ view, className = 'span-2' }) {
  const valueOf = (d, p) => view.metricOf(d, p, 'ship');
  return (
    <Card
      className={className}
      title="商品×日の出荷数"
      sub="濃いほど出荷が多い日。曜日による波と、商品ごとの動きを一目で確認できます"
      table={() => <DataTable head={['商品', ...view.days.map(md)]} rows={view.products.map((p) => [p.name, ...view.days.map((d) => fmt(valueOf(d, p.code)))])} />}
    >
      <Heatmap days={view.days} products={view.products} valueOf={valueOf} />
    </Card>
  );
}

export function InputStatus({ status, go, compact = false }) {
  const done = DEPTS.filter((d) => status[d.key] > 0).length;
  return (
    <section className={`input-status ${compact ? 'compact' : ''}`}>
      <div className="is-head">
        <Icon name="clock" size={16} />
        <b>本日（{md(TODAY)}）の入力状況</b>
        <span className={`is-count ${done === 4 ? 'all' : ''}`}>{done} / 4 部署</span>
      </div>
      <div className="is-list">
        {DEPTS.map((d) => {
          const ok = status[d.key] > 0;
          return (
            <button key={d.key} type="button" className={`is-item ${ok ? 'ok' : 'wait'}`} onClick={() => go?.('sheets')} disabled={!go}>
              <Icon name={DEPT_ICON[d.key]} size={16} />
              <span>{d.name}</span>
              <em><Icon name={ok ? 'check' : 'clock'} size={12} stroke={2.6} />{ok ? `入力済 ${status[d.key]}行` : '未入力'}</em>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function Dashboard({ ctx }) {
  const { view, filters, setFilters, status, go, openTv } = ctx;
  const toggleProduct = (code) => {
    const has = filters.products.includes(code);
    if (has && filters.products.length === 1) return;
    setFilters({ ...filters, products: has ? filters.products.filter((c) => c !== code) : PRODUCTS.map((p) => p.code).filter((c) => c === code || filters.products.includes(c)) });
  };
  const partyApplied = filters.party !== 'all';

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">Looker Studio レポート（デモ）</span>
          <h1>製造・在庫・受注・出荷 ダッシュボード</h1>
        </div>
        <button type="button" className="btn ghost" onClick={openTv}><Icon name="maximize" size={16} />40インチモニターで表示</button>
      </div>

      <div className="filters" role="group" aria-label="フィルター">
        <div className="filter">
          <label><Icon name="calendar" size={14} />期間</label>
          <div className="seg">
            {[7, 14, 30].map((n) => <button key={n} type="button" className={filters.days === n ? 'is-active' : ''} onClick={() => setFilters({ ...filters, days: n })}>直近{n}日</button>)}
          </div>
        </div>
        <div className="filter">
          <label><Icon name="filter" size={14} />商品</label>
          <div className="chips">
            {PRODUCTS.map((p) => (
              <button key={p.code} type="button" className={`chip ${filters.products.includes(p.code) ? 'is-on' : ''}`} onClick={() => toggleProduct(p.code)} aria-pressed={filters.products.includes(p.code)}>
                <i style={{ background: `var(--p${p.color})` }} />{p.name}
              </button>
            ))}
          </div>
        </div>
        <div className="filter">
          <label><Icon name="briefcase" size={14} />取引先・チャネル</label>
          <select className="select" value={filters.party} onChange={(e) => setFilters({ ...filters, party: e.target.value })}>
            <option value="all">すべて</option>
            <optgroup label="営業（取引先）">{CUSTOMERS.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</optgroup>
            <optgroup label="EC（チャネル）">{CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}</optgroup>
          </select>
        </div>
      </div>
      {partyApplied && <p className="filter-note"><Icon name="info" size={14} />取引先・チャネルの絞り込みは受注・出荷に適用されます（製造・在庫は全体の値）。</p>}

      <InputStatus status={status} go={go} />
      <KpiTiles view={view} />

      <div className="grid">
        <DailyChart view={view} />
        <InventoryCard view={view} />
        <PartyCard view={view} />
        <HeatCard view={view} />
      </div>
    </div>
  );
}
