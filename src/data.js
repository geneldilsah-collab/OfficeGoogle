// デモ用データ（商品・取引先はすべて架空です）
// スプレッドシートの各シートと同じ列構成で保持し、集計は aggregate.js で行う。

export const TODAY = '2026-10-15';
export const START = '2026-09-16';

// M_商品（1種4品目）— 色は商品に固定（フィルターで並びが変わっても色は変えない）
export const PRODUCTS = [
  { code: 'P01', name: '和風たまねぎ', full: '国産野菜ドレッシング 和風たまねぎ 300ml', safety: 1200, opening: 2600, color: 1 },
  { code: 'P02', name: '焙煎ごま', full: '国産野菜ドレッシング 焙煎ごま 300ml', safety: 1000, opening: 1400, color: 2 },
  { code: 'P03', name: '青じそ', full: '国産野菜ドレッシング 青じそ 300ml', safety: 800, opening: 1500, color: 3 },
  { code: 'P04', name: 'シーザー', full: '国産野菜ドレッシング シーザー 300ml', safety: 600, opening: 760, color: 4 }
];

// M_取引先（営業販売管理）
export const CUSTOMERS = [
  { code: 'C01', name: '丸辰スーパー', weight: 1.0 },
  { code: 'C02', name: 'ハナマルストア', weight: 0.75 },
  { code: 'C03', name: '青葉生協', weight: 0.6 },
  { code: 'C04', name: '東都フードサービス', weight: 0.45 },
  { code: 'C05', name: 'みどり商事', weight: 0.3 }
];

// EC受注管理のチャネル
export const CHANNELS = ['自社EC', '楽天市場', 'Amazon'];
export const LINES = ['Aライン', 'Bライン'];
export const STAFF = { prod: ['田村', '小川'], wh: ['森', '石田'] };

export const DEPTS = [
  { key: 'prod', name: '製造', sheet: '入力_製造', owner: '製造部' },
  { key: 'wh', name: '倉庫', sheet: '入力_倉庫', owner: '物流倉庫' },
  { key: 'sales', name: '営業販売管理', sheet: '入力_営業', owner: '営業部' },
  { key: 'ec', name: 'EC受注管理', sheet: '入力_EC', owner: 'EC事業部' }
];

function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

export const addDays = (d, n) => {
  const t = new Date(`${d}T00:00:00`);
  t.setDate(t.getDate() + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};
export const dow = (d) => new Date(`${d}T00:00:00`).getDay();

export function buildSeed() {
  const r = rng(20261015);
  const prod = [];
  const wh = [];
  const sales = [];
  const ec = [];
  const days = [];
  for (let d = START; d < TODAY; d = addDays(d, 1)) days.push(d);

  const productBias = { P01: 1.0, P02: 0.9, P03: 0.62, P04: 0.48 };
  const prodBias = { P01: 0.92, P02: 0.76, P03: 0.6, P04: 0.37 }; // 製造計画（在庫水準の差を出すため商品ごとに調整）
  let id = 1;

  days.forEach((d, i) => {
    const w = dow(d);
    const weekend = w === 0 || w === 6;
    const trend = 1 + i * 0.006;

    PRODUCTS.forEach((p) => {
      const bias = productBias[p.code];

      // 営業販売管理：平日中心。取引先×商品ごとに受注・出荷を記録
      let shipB2B = 0;
      if (!weekend) {
        CUSTOMERS.forEach((c) => {
          if (r() < 0.25 * (1.1 - c.weight * 0.3)) return; // 発注のない日
          const order = Math.round((60 + r() * 70) * c.weight * bias * trend);
          const ship = Math.max(0, order - (r() < 0.18 ? Math.round(order * (0.2 + r() * 0.3)) : 0));
          sales.push({ id: id++, date: d, customer: c.code, product: p.code, order, ship });
          shipB2B += ship;
        });
      }

      // EC受注管理：週末にやや増える
      let shipEC = 0;
      CHANNELS.forEach((ch, ci) => {
        const base = [26, 34, 22][ci];
        const order = Math.round(base * bias * (weekend ? 1.35 : 1) * trend * (0.75 + r() * 0.5));
        const ship = r() < 0.12 ? Math.round(order * 0.7) : order;
        ec.push({ id: id++, date: d, channel: ch, product: p.code, order, ship });
        shipEC += ship;
      });

      // 製造：平日のみ。在庫を安全在庫の2倍程度に保つ想定の数量
      let good = 0;
      if (!weekend) {
        const qty = Math.round((330 + r() * 160) * prodBias[p.code] * trend);
        const defect = Math.round(qty * (0.004 + r() * 0.012));
        prod.push({ id: id++, date: d, product: p.code, qty, defect, line: LINES[p.code === 'P01' || p.code === 'P03' ? 0 : 1], staff: STAFF.prod[i % 2] });
        good = qty - defect;
      }

      // 倉庫：入庫＝製造良品、出庫＝営業＋ECの出荷。金曜は棚卸実在庫を記録
      wh.push({ id: id++, date: d, product: p.code, inbound: good, outbound: shipB2B + shipEC, count: null, staff: STAFF.wh[i % 2] });
    });
  });

  // 金曜の棚卸実在庫（計算在庫と照合する）— 1件だけ破損による差異を入れておく
  const stock = Object.fromEntries(PRODUCTS.map((p) => [p.code, p.opening]));
  wh.forEach((row) => {
    stock[row.product] += row.inbound - row.outbound;
    if (dow(row.date) === 5) {
      const diff = row.date === '2026-10-09' && row.product === 'P02' ? -6 : 0;
      row.count = stock[row.product] + diff;
      if (diff) row.note = '破損3ケース（6本）';
    }
  });

  return { prod, wh, sales, ec };
}
