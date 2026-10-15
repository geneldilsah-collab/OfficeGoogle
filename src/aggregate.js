import { CHANNELS, CUSTOMERS, PRODUCTS, TODAY, addDays } from './data';

export const fmt = (n) => Math.round(n).toLocaleString('ja-JP');
export const md = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// 4つの入力シートを「日付×商品」の集計表にまとめる（スプレッドシートの 集計_日次 シートに相当）
export function buildDaily(sheets) {
  const dates = new Set();
  [...sheets.prod, ...sheets.wh, ...sheets.sales, ...sheets.ec].forEach((r) => r.date && dates.add(r.date));
  const sorted = [...dates].sort();
  const blank = () => ({ produced: 0, defect: 0, good: 0, orderB2B: 0, shipB2B: 0, orderEC: 0, shipEC: 0, inbound: 0, outbound: 0, count: null });
  const table = {};
  sorted.forEach((d) => { table[d] = Object.fromEntries(PRODUCTS.map((p) => [p.code, blank()])); });

  sheets.prod.forEach((r) => {
    const c = table[r.date]?.[r.product];
    if (!c) return;
    c.produced += num(r.qty);
    c.defect += num(r.defect);
    c.good += num(r.qty) - num(r.defect);
  });
  sheets.wh.forEach((r) => {
    const c = table[r.date]?.[r.product];
    if (!c) return;
    c.inbound += num(r.inbound);
    c.outbound += num(r.outbound);
    if (r.count !== null && r.count !== '' && r.count !== undefined) c.count = num(r.count);
  });
  sheets.sales.forEach((r) => {
    const c = table[r.date]?.[r.product];
    if (!c) return;
    c.orderB2B += num(r.order);
    c.shipB2B += num(r.ship);
  });
  sheets.ec.forEach((r) => {
    const c = table[r.date]?.[r.product];
    if (!c) return;
    c.orderEC += num(r.order);
    c.shipEC += num(r.ship);
  });

  // 在庫（倉庫の入出庫から計算）と受注残（累計受注−累計出荷）
  const stock = Object.fromEntries(PRODUCTS.map((p) => [p.code, p.opening]));
  const backlog = Object.fromEntries(PRODUCTS.map((p) => [p.code, 0]));
  sorted.forEach((d) => {
    PRODUCTS.forEach((p) => {
      const c = table[d][p.code];
      stock[p.code] += c.inbound - c.outbound;
      backlog[p.code] += c.orderB2B + c.orderEC - c.shipB2B - c.shipEC;
      c.stock = stock[p.code];
      c.backlog = backlog[p.code];
    });
  });
  return { dates: sorted, table };
}

// ダッシュボードのフィルター（期間・商品・取引先/チャネル）を適用した集計
export function buildView(sheets, daily, f) {
  const last = daily.dates[daily.dates.length - 1];
  const range = (end, n) => Array.from({ length: n }, (_, i) => addDays(end, i - n + 1)).filter((d) => daily.table[d]);
  const days = range(last, f.days);
  const prevDays = range(addDays(last, -f.days), f.days);
  const products = PRODUCTS.filter((p) => f.products.includes(p.code));

  // 取引先・チャネルで絞った受注／出荷
  const partyRows = (d) => {
    const s = sheets.sales.filter((r) => r.date === d && (f.party === 'all' || f.party === r.customer));
    const e = sheets.ec.filter((r) => r.date === d && (f.party === 'all' || f.party === r.channel));
    return [...s, ...e];
  };
  const metricOf = (d, p, key) => {
    const c = daily.table[d]?.[p];
    if (!c) return 0;
    if (key === 'good') return c.good;
    if (key === 'order' || key === 'ship') {
      if (f.party === 'all') return key === 'order' ? c.orderB2B + c.orderEC : c.shipB2B + c.shipEC;
      return partyRows(d).filter((r) => r.product === p).reduce((s, r) => s + num(r[key]), 0);
    }
    return 0;
  };
  const sumOver = (ds, key) => ds.reduce((s, d) => s + products.reduce((t, p) => t + metricOf(d, p.code, key), 0), 0);

  const stockAt = (d) => products.reduce((s, p) => s + (daily.table[d]?.[p.code].stock ?? 0), 0);
  const backlogAt = (d) => products.reduce((s, p) => s + (daily.table[d]?.[p.code].backlog ?? 0), 0);
  const prevLast = prevDays[prevDays.length - 1];

  const kpis = [
    { key: 'good', label: '製造数（良品）', unit: '本', value: sumOver(days, 'good'), prev: sumOver(prevDays, 'good'), spark: days.map((d) => sumOver([d], 'good')), dept: '製造' },
    { key: 'order', label: '受注数', unit: '本', value: sumOver(days, 'order'), prev: sumOver(prevDays, 'order'), spark: days.map((d) => sumOver([d], 'order')), dept: '営業＋EC' },
    { key: 'ship', label: '出荷数', unit: '本', value: sumOver(days, 'ship'), prev: sumOver(prevDays, 'ship'), spark: days.map((d) => sumOver([d], 'ship')), dept: '営業＋EC' },
    { key: 'stock', label: '在庫数', unit: '本', value: stockAt(last), prev: prevLast ? stockAt(prevLast) : null, spark: days.map(stockAt), dept: '倉庫', point: true },
    { key: 'backlog', label: '受注残', unit: '本', value: backlogAt(last), prev: prevLast ? backlogAt(prevLast) : null, spark: days.map(backlogAt), dept: '営業＋EC', point: true, lowerIsBetter: true }
  ];

  const series = (key) => days.map((d) => ({ date: d, values: Object.fromEntries(products.map((p) => [p.code, metricOf(d, p.code, key)])) }));

  // 在庫の状況（在庫日数＝在庫 ÷ 直近7日の平均出荷）
  const last7 = range(last, 7);
  const inventory = products.map((p) => {
    const c = daily.table[last][p.code];
    const avgShip = last7.reduce((s, d) => s + daily.table[d][p.code].shipB2B + daily.table[d][p.code].shipEC, 0) / last7.length;
    const cover = avgShip ? c.stock / avgShip : 99;
    const status = c.stock < p.safety ? 'critical' : c.stock < p.safety * 1.3 ? 'warning' : 'good';
    return { ...p, stock: c.stock, safety: p.safety, cover, backlog: c.backlog, status };
  });

  // 取引先・チャネル別の受注
  const partyTotals = [
    ...CUSTOMERS.map((c) => ({ key: c.code, name: c.name, kind: '営業', order: 0, ship: 0 })),
    ...CHANNELS.map((ch) => ({ key: ch, name: ch, kind: 'EC', order: 0, ship: 0 }))
  ];
  const byKey = Object.fromEntries(partyTotals.map((x) => [x.key, x]));
  sheets.sales.forEach((r) => { if (days.includes(r.date) && f.products.includes(r.product)) { byKey[r.customer].order += num(r.order); byKey[r.customer].ship += num(r.ship); } });
  sheets.ec.forEach((r) => { if (days.includes(r.date) && f.products.includes(r.product)) { byKey[r.channel].order += num(r.order); byKey[r.channel].ship += num(r.ship); } });
  const parties = partyTotals.filter((x) => f.party === 'all' || x.key === f.party).sort((a, b) => b.order - a.order);

  return { last, days, products, kpis, series, inventory, parties, metricOf };
}

// 本日の入力状況（部署ごと）
export function inputStatus(sheets) {
  return {
    prod: sheets.prod.filter((r) => r.date === TODAY).length,
    wh: sheets.wh.filter((r) => r.date === TODAY).length,
    sales: sheets.sales.filter((r) => r.date === TODAY).length,
    ec: sheets.ec.filter((r) => r.date === TODAY).length
  };
}

// 照合：部署間の整合と、入力合計＝集計表＝ダッシュボードの一致を確認
export function reconcile(sheets, daily) {
  const issues = [];
  daily.dates.forEach((d) => {
    PRODUCTS.forEach((p) => {
      const c = daily.table[d][p.code];
      if (c.inbound !== c.good) issues.push({ date: d, product: p.code, kind: '製造良品 ≠ 倉庫入庫', a: c.good, b: c.inbound });
      if (c.outbound !== c.shipB2B + c.shipEC) issues.push({ date: d, product: p.code, kind: '出荷合計 ≠ 倉庫出庫', a: c.shipB2B + c.shipEC, b: c.outbound });
      if (c.count !== null && c.count !== c.stock) issues.push({ date: d, product: p.code, kind: '棚卸在庫 ≠ 計算在庫', a: c.stock, b: c.count });
    });
  });

  const sumRows = (rows, key) => rows.reduce((s, r) => s + num(r[key]), 0);
  const sumTable = (key) => daily.dates.reduce((s, d) => s + PRODUCTS.reduce((t, p) => t + daily.table[d][p.code][key], 0), 0);
  const totals = [
    { label: '製造数', input: sumRows(sheets.prod, 'qty'), table: sumTable('produced'), sheet: '入力_製造' },
    { label: '不良数', input: sumRows(sheets.prod, 'defect'), table: sumTable('defect'), sheet: '入力_製造' },
    { label: '受注数（営業）', input: sumRows(sheets.sales, 'order'), table: sumTable('orderB2B'), sheet: '入力_営業' },
    { label: '出荷数（営業）', input: sumRows(sheets.sales, 'ship'), table: sumTable('shipB2B'), sheet: '入力_営業' },
    { label: '受注数（EC）', input: sumRows(sheets.ec, 'order'), table: sumTable('orderEC'), sheet: '入力_EC' },
    { label: '出荷数（EC）', input: sumRows(sheets.ec, 'ship'), table: sumTable('shipEC'), sheet: '入力_EC' },
    { label: '入庫数', input: sumRows(sheets.wh, 'inbound'), table: sumTable('inbound'), sheet: '入力_倉庫' },
    { label: '出庫数', input: sumRows(sheets.wh, 'outbound'), table: sumTable('outbound'), sheet: '入力_倉庫' }
  ];
  return { issues, totals };
}

// 入力値のチェック（スプレッドシートの「データの入力規則」と条件付き書式に相当）
export function rowErrors(dept, r) {
  const e = {};
  const neg = (k) => r[k] !== '' && r[k] !== null && Number(r[k]) < 0;
  const empty = (k) => r[k] === '' || r[k] === null || r[k] === undefined;
  if (!r.date) e.date = '日付は必須です';
  if (!r.product) e.product = '商品を選択してください';
  if (dept === 'prod') {
    if (empty('qty') || neg('qty')) e.qty = '0以上の数値を入力';
    if (neg('defect')) e.defect = '0以上の数値を入力';
    if (Number(r.defect) > Number(r.qty)) e.defect = '不良数が製造数を超えています';
  }
  if (dept === 'wh') {
    ['inbound', 'outbound'].forEach((k) => { if (empty(k) || neg(k)) e[k] = '0以上の数値を入力'; });
    if (neg('count')) e.count = '0以上の数値を入力';
  }
  if (dept === 'sales' || dept === 'ec') {
    if (dept === 'sales' && !r.customer) e.customer = '取引先を選択してください';
    if (dept === 'ec' && !r.channel) e.channel = 'チャネルを選択してください';
    if (empty('order') || neg('order')) e.order = '0以上の数値を入力';
    if (neg('ship')) e.ship = '0以上の数値を入力';
    if (Number(r.ship) > Number(r.order)) e.ship = '出荷数が受注数を超えています';
  }
  return e;
}
