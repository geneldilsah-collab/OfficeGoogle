import { useMemo, useState } from 'react';
import Icon, { DEPT_ICON } from '../components/Icon';
import { CHANNELS, CUSTOMERS, DEPTS, LINES, PRODUCTS, TODAY, addDays } from '../data';
import { fmt, md, rowErrors } from '../aggregate';

const pName = (code) => PRODUCTS.find((p) => p.code === code)?.name ?? '';
const n = (v) => (v === '' || v === null || v === undefined ? 0 : Number(v));

// シートの列定義（実際のスプレッドシートと同じ並び）
const COLS = {
  prod: [
    { key: 'date', label: '日付', type: 'date', w: 118 },
    { key: 'product', label: '商品コード', type: 'product', w: 120 },
    { key: '_name', label: '商品名', calc: (r) => pName(r.product), f: '=VLOOKUP(B,M_商品,2,FALSE)', w: 130 },
    { key: 'qty', label: '製造数', type: 'num', w: 92 },
    { key: 'defect', label: '不良数', type: 'num', w: 92 },
    { key: '_good', label: '良品数', calc: (r) => fmt(n(r.qty) - n(r.defect)), f: '=D-E', w: 92, num: true },
    { key: 'line', label: 'ライン', type: 'select', options: LINES, w: 96 },
    { key: 'staff', label: '担当', type: 'text', w: 90 }
  ],
  wh: [
    { key: 'date', label: '日付', type: 'date', w: 118 },
    { key: 'product', label: '商品コード', type: 'product', w: 120 },
    { key: '_name', label: '商品名', calc: (r) => pName(r.product), f: '=VLOOKUP(B,M_商品,2,FALSE)', w: 130 },
    { key: 'inbound', label: '入庫数', type: 'num', w: 92 },
    { key: 'outbound', label: '出庫数', type: 'num', w: 92 },
    { key: 'count', label: '棚卸実在庫（金曜）', type: 'num', optional: true, w: 140 },
    { key: 'staff', label: '担当', type: 'text', w: 80 },
    { key: 'note', label: '備考', type: 'text', w: 160 }
  ],
  sales: [
    { key: 'date', label: '日付', type: 'date', w: 118 },
    { key: 'customer', label: '取引先', type: 'select', options: CUSTOMERS.map((c) => c.code), optLabel: (v) => CUSTOMERS.find((c) => c.code === v)?.name, w: 170 },
    { key: 'product', label: '商品コード', type: 'product', w: 120 },
    { key: '_name', label: '商品名', calc: (r) => pName(r.product), f: '=VLOOKUP(C,M_商品,2,FALSE)', w: 130 },
    { key: 'order', label: '受注数', type: 'num', w: 92 },
    { key: 'ship', label: '出荷数', type: 'num', w: 92 },
    { key: '_rest', label: '未出荷', calc: (r) => fmt(n(r.order) - n(r.ship)), f: '=E-F', w: 92, num: true }
  ],
  ec: [
    { key: 'date', label: '日付', type: 'date', w: 118 },
    { key: 'channel', label: 'チャネル', type: 'select', options: CHANNELS, w: 130 },
    { key: 'product', label: '商品コード', type: 'product', w: 120 },
    { key: '_name', label: '商品名', calc: (r) => pName(r.product), f: '=VLOOKUP(C,M_商品,2,FALSE)', w: 130 },
    { key: 'order', label: '受注数', type: 'num', w: 92 },
    { key: 'ship', label: '出荷数', type: 'num', w: 92 }
  ]
};
const LETTER = 'ABCDEFGHIJ';

// 数値セル：全角数字も受け付け、空欄は「未入力」として扱う
function parseCell(text, optional) {
  const raw = text.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0)).replace(/[^\d-]/g, '');
  if (raw === '') return optional ? null : '';
  if (raw === '-') return '-';
  return Number(raw);
}

function blankRow(dept, product = 'P01') {
  const base = { id: Date.now() + Math.random(), date: TODAY, product };
  if (dept === 'prod') return { ...base, qty: '', defect: '', line: product === 'P01' || product === 'P03' ? 'Aライン' : 'Bライン', staff: '' };
  if (dept === 'wh') return { ...base, inbound: '', outbound: '', count: null, staff: '', note: '' };
  if (dept === 'sales') return { ...base, customer: 'C01', order: '', ship: '' };
  return { ...base, channel: '自社EC', order: '', ship: '' };
}

// 「本日分をサンプル入力」：前日までの傾向から現実的な値を作る（他部署の本日入力とも整合させる）
function sampleToday(dept, sheets) {
  const avg = (rows, key, p) => {
    const xs = rows.filter((r) => r.product === p && r.date >= addDays(TODAY, -7)).map((r) => n(r[key]));
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  };
  const jitter = (v) => Math.max(0, Math.round(v * (0.92 + Math.random() * 0.16)));
  if (dept === 'prod') {
    return PRODUCTS.map((p) => {
      const qty = jitter(avg(sheets.prod, 'qty', p.code));
      return { ...blankRow('prod', p.code), qty, defect: Math.round(qty * 0.008), staff: '田村' };
    });
  }
  if (dept === 'sales') {
    return CUSTOMERS.slice(0, 4).flatMap((c) => PRODUCTS.map((p) => {
      const order = jitter(avg(sheets.sales.filter((r) => r.customer === c.code), 'order', p.code));
      return { ...blankRow('sales', p.code), customer: c.code, order, ship: order };
    })).filter((r) => r.order > 0);
  }
  if (dept === 'ec') {
    return CHANNELS.flatMap((ch) => PRODUCTS.map((p) => {
      const order = jitter(avg(sheets.ec.filter((r) => r.channel === ch), 'order', p.code));
      return { ...blankRow('ec', p.code), channel: ch, order, ship: order };
    }));
  }
  // 倉庫：本日の製造良品＝入庫、本日の出荷合計＝出庫
  return PRODUCTS.map((p) => {
    const inbound = sheets.prod.filter((r) => r.date === TODAY && r.product === p.code).reduce((s, r) => s + n(r.qty) - n(r.defect), 0);
    const outbound = [...sheets.sales, ...sheets.ec].filter((r) => r.date === TODAY && r.product === p.code).reduce((s, r) => s + n(r.ship), 0);
    return { ...blankRow('wh', p.code), inbound, outbound, staff: '森' };
  });
}

export default function Sheets({ ctx, reset }) {
  const { sheets, setSheets, status, notify, go } = ctx;
  const [dept, setDept] = useState('prod');
  const [scope, setScope] = useState('recent');
  const [sel, setSel] = useState(null);
  const cols = COLS[dept];
  const rows = sheets[dept];

  const visible = useMemo(() => {
    const withIndex = rows.map((r, i) => ({ r, row: i + 2 }));
    return scope === 'recent' ? withIndex.filter(({ r }) => r.date >= addDays(TODAY, -2)) : withIndex;
  }, [rows, scope]);

  const errors = useMemo(() => Object.fromEntries(rows.map((r) => [r.id, rowErrors(dept, r)])), [rows, dept]);
  const errCount = Object.values(errors).reduce((s, e) => s + Object.keys(e).length, 0);

  const setCell = (id, key, value) => {
    setSheets((s) => ({ ...s, [dept]: s[dept].map((r) => (r.id === id ? { ...r, [key]: value } : r)) }));
  };
  const addRows = (newRows, msg) => {
    setSheets((s) => ({ ...s, [dept]: [...s[dept], ...newRows] }));
    setScope('recent');
    notify(msg);
  };
  const removeRow = (id) => setSheets((s) => ({ ...s, [dept]: s[dept].filter((r) => r.id !== id) }));
  const clearToday = () => {
    setSheets((s) => ({ ...s, [dept]: s[dept].filter((r) => r.date !== TODAY) }));
    notify('本日の行を削除しました');
  };

  const deptInfo = DEPTS.find((d) => d.key === dept);
  const todayRows = rows.filter((r) => r.date === TODAY).length;
  const selCol = sel ? cols[sel.c] : null;
  const selRow = sel ? rows.find((r) => r.id === sel.id) : null;
  const selValue = selCol && selRow ? (selCol.calc ? selCol.f : selRow[selCol.key] ?? '') : '';

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">Googleスプレッドシート（デモ）</span>
          <h1>部署別の入力シート</h1>
          <p className="lead">各部署は自分のシートに1日1回入力するだけ。入力した内容は集計シートを通じて、ダッシュボードに自動で反映されます。</p>
        </div>
        <div className="title-actions">
          <button type="button" className="btn ghost" onClick={reset}><Icon name="refresh" size={15} />テストデータに戻す</button>
          <button type="button" className="btn" onClick={() => go('dashboard')}><Icon name="dashboard" size={15} />ダッシュボードで確認</button>
        </div>
      </div>

      <div className="steps-hint">
        <b>受け入れ確認の流れ：</b>
        <span><em>1</em>各部署のシートで「本日分をサンプル入力」（または手入力）</span>
        <Icon name="arrow" size={14} />
        <span><em>2</em>ダッシュボードで本日（{md(TODAY)}）の数値が反映されたことを確認</span>
        <Icon name="arrow" size={14} />
        <span><em>3</em>「集計・照合」で入力合計と集計結果の一致を確認</span>
      </div>

      <div className="sheet-app">
        <div className="sheet-top">
          <div className="sheet-doc">
            <div className="sheet-logo"><Icon name="sheet" size={18} /></div>
            <div><b>【DX】日次業務データ_ドレッシング</b><small>最終編集：たった今　・　自動保存</small></div>
          </div>
          <div className="sheet-tools">
            <div className="seg sm">
              <button type="button" className={scope === 'recent' ? 'is-active' : ''} onClick={() => setScope('recent')}>直近3日</button>
              <button type="button" className={scope === 'all' ? 'is-active' : ''} onClick={() => setScope('all')}>すべての行</button>
            </div>
            <button type="button" className="btn ghost sm" onClick={() => addRows([blankRow(dept)], '本日の空の行を追加しました')}><Icon name="plus" size={14} />本日の行を追加</button>
            <button type="button" className="btn sm" onClick={() => addRows(sampleToday(dept, sheets), `${deptInfo.name}：本日分のサンプルを入力しました`)}><Icon name="play" size={13} />本日分をサンプル入力</button>
            {todayRows > 0 && <button type="button" className="btn ghost sm danger" onClick={clearToday}><Icon name="trash" size={14} />本日分を消去</button>}
          </div>
        </div>

        <div className="fx-bar">
          <span className="fx-ref">{sel ? `${LETTER[sel.c]}${sel.row}` : '—'}</span>
          <span className="fx-sym">fx</span>
          <span className={`fx-val ${selCol?.calc ? 'formula' : ''}`}>{sel ? String(selValue) : 'セルを選択すると内容が表示されます'}</span>
        </div>

        <div className="grid-scroll">
          <table className="ss">
            <thead>
              <tr className="ss-letters">
                <th className="ss-corner" />
                {cols.map((c, i) => <th key={c.key} style={{ width: c.w, minWidth: c.w }} className={sel?.c === i ? 'on' : ''}>{LETTER[i]}</th>)}
                <th className="ss-act" />
              </tr>
              <tr className="ss-head">
                <th className="ss-rownum">1</th>
                {cols.map((c) => <th key={c.key} className={c.calc ? 'calc' : ''}>{c.label}{c.calc && <small>数式</small>}{c.optional && <small>任意</small>}</th>)}
                <th className="ss-act" />
              </tr>
            </thead>
            <tbody>
              {visible.map(({ r, row }) => {
                const err = errors[r.id] || {};
                const isToday = r.date === TODAY;
                return (
                  <tr key={r.id} className={isToday ? 'today' : ''}>
                    <th className={`ss-rownum ${sel?.id === r.id ? 'on' : ''}`}>{row}</th>
                    {cols.map((c, ci) => {
                      const active = sel?.id === r.id && sel?.c === ci;
                      const cls = `${c.calc ? 'calc' : ''} ${err[c.key] ? 'err' : ''} ${active ? 'active' : ''} ${c.type === 'num' || c.num ? 'num' : ''}`;
                      const focus = () => setSel({ id: r.id, c: ci, row });
                      if (c.calc) return <td key={c.key} className={cls} onClick={focus}>{c.calc(r)}</td>;
                      return (
                        <td key={c.key} className={cls} title={err[c.key] || ''}>
                          {c.type === 'num' && <input inputMode="numeric" value={r[c.key] ?? ''} onFocus={focus} onChange={(e) => setCell(r.id, c.key, parseCell(e.target.value, c.optional))} />}
                          {c.type === 'text' && <input value={r[c.key] ?? ''} onFocus={focus} onChange={(e) => setCell(r.id, c.key, e.target.value)} />}
                          {c.type === 'date' && <input type="date" value={r.date} onFocus={focus} onChange={(e) => setCell(r.id, 'date', e.target.value)} />}
                          {c.type === 'product' && (
                            <select value={r.product} onFocus={focus} onChange={(e) => setCell(r.id, 'product', e.target.value)}>
                              <option value="">選択</option>
                              {PRODUCTS.map((p) => <option key={p.code} value={p.code}>{p.code}</option>)}
                            </select>
                          )}
                          {c.type === 'select' && (
                            <select value={r[c.key]} onFocus={focus} onChange={(e) => setCell(r.id, c.key, e.target.value)}>
                              <option value="">選択</option>
                              {c.options.map((o) => <option key={o} value={o}>{c.optLabel ? c.optLabel(o) : o}</option>)}
                            </select>
                          )}
                        </td>
                      );
                    })}
                    <td className="ss-act"><button type="button" onClick={() => removeRow(r.id)} aria-label={`${row}行目を削除`} title="行を削除"><Icon name="trash" size={13} /></button></td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr><td colSpan={cols.length + 2} className="ss-empty">表示する行がありません。「本日の行を追加」から入力してください。</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="sheet-status">
          <span>{rows.length.toLocaleString()} 行</span>
          <span className={errCount ? 'bad' : 'good'}><Icon name={errCount ? 'alert' : 'check'} size={13} stroke={2.6} />{errCount ? `入力エラー ${errCount}件（赤いセル）` : '入力エラーなし'}</span>
          <span>本日の行 {todayRows}</span>
          <span className="muted">灰色の列は数式で自動計算（入力不要）</span>
        </div>

        <div className="sheet-tabs">
          {DEPTS.map((d) => (
            <button key={d.key} type="button" className={dept === d.key ? 'is-active' : ''} onClick={() => { setDept(d.key); setSel(null); }}>
              <Icon name={DEPT_ICON[d.key]} size={14} />
              {d.sheet}
              <i className={status[d.key] > 0 ? 'ok' : 'wait'} title={status[d.key] > 0 ? '本日入力済' : '本日未入力'} />
            </button>
          ))}
          <span className="tab-ro"><Icon name="db" size={14} />M_商品</span>
          <span className="tab-ro"><Icon name="db" size={14} />M_取引先</span>
          <span className="tab-ro"><Icon name="layers" size={14} />集計_日次</span>
        </div>
      </div>

      <div className="sheet-notes">
        <div><Icon name="shield" size={16} /><p><b>入力ミスを防ぐ設定</b>商品・取引先・チャネルはプルダウン（M_商品／M_取引先から参照）。マイナス値や「不良数＞製造数」「出荷数＞受注数」は赤く表示されます。</p></div>
        <div><Icon name="sheet" size={16} /><p><b>Excelテンプレートからの移行</b>ご用意いただいた4部署のExcelの列構成を活かし、日付・商品コードなど集計に必要な列だけ形式を統一します。</p></div>
        <div><Icon name="link" size={16} /><p><b>将来のAPI連携に備えて</b>各シートは「1行＝1日×1商品（×取引先）」の縦持ち形式。将来は同じ列のまま、手入力をAPI取り込みに置き換えられます。</p></div>
      </div>
    </div>
  );
}
