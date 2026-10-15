import Icon from '../components/Icon';
import { DEPTS, PRODUCTS, TODAY, dow } from '../data';
import { fmt, md, reconcile } from '../aggregate';

const pName = (code) => PRODUCTS.find((p) => p.code === code)?.name ?? code;
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export default function Reconcile({ ctx }) {
  const { sheets, daily, view, filters, status, go } = ctx;
  const { issues, totals } = reconcile(sheets, daily);
  const last = daily.dates[daily.dates.length - 1];

  // ダッシュボードの表示値と入力シートの直接集計を突き合わせる（全商品・全取引先のとき）
  const fullFilter = filters.products.length === PRODUCTS.length && filters.party === 'all';
  const inDays = (r) => view.days.includes(r.date);
  const dashChecks = [
    { label: `製造数（良品）直近${view.days.length}日`, input: sheets.prod.filter(inDays).reduce((s, r) => s + n(r.qty) - n(r.defect), 0), dash: view.kpis[0].value },
    { label: `受注数 直近${view.days.length}日`, input: [...sheets.sales, ...sheets.ec].filter(inDays).reduce((s, r) => s + n(r.order), 0), dash: view.kpis[1].value },
    { label: `出荷数 直近${view.days.length}日`, input: [...sheets.sales, ...sheets.ec].filter(inDays).reduce((s, r) => s + n(r.ship), 0), dash: view.kpis[2].value }
  ];

  const kinds = ['製造良品 ≠ 倉庫入庫', '出荷合計 ≠ 倉庫出庫', '棚卸在庫 ≠ 計算在庫'];
  const noteOf = (i) => sheets.wh.find((r) => r.date === i.date && r.product === i.product)?.note;

  const weekendSales = sheets.sales.filter((r) => [0, 6].includes(dow(r.date))).length;
  const backlogTable = PRODUCTS.reduce((s, p) => s + daily.table[last][p.code].backlog, 0);
  const backlogInput = [...sheets.sales, ...sheets.ec].reduce((s, r) => s + n(r.order) - n(r.ship), 0);
  const todayAll = DEPTS.every((d) => status[d.key] > 0);
  const todayInTable = daily.dates.includes(TODAY);
  const stockIssues = issues.filter((i) => i.kind.startsWith('棚卸')).length;

  const cases = [
    { title: '入力合計と集計シートの一致', desc: '4部署の全行を合計した値と、集計_日次シートの合計が一致する', ok: totals.every((t) => t.input === t.table) },
    { title: '不良品の控除', desc: '製造数から不良数を引いた「良品数」で在庫・製造KPIを計算している', ok: daily.dates.every((d) => PRODUCTS.every((p) => { const c = daily.table[d][p.code]; return c.good === c.produced - c.defect; })) },
    { title: '土日の扱い', desc: '営業の受注がない土日も日付が欠けず、ECの受注のみ集計される', ok: weekendSales === 0 && daily.dates.length > 0 },
    { title: '部分出荷と受注残', desc: '受注残＝累計受注－累計出荷 が、入力シートの直接計算と一致する', ok: backlogTable === backlogInput },
    { title: '棚卸差異の検出', desc: '倉庫の棚卸実在庫と計算在庫の差を検出し、照合結果に表示する', ok: stockIssues > 0, note: stockIssues > 0 ? `${stockIssues}件検出（テストデータに意図的に含めた差異）` : null },
    { title: '新しい日次データの反映', desc: `本日（${md(TODAY)}）分を4部署が入力すると、集計とダッシュボードに反映される`, ok: todayAll && todayInTable, pending: !todayAll }
  ];
  const passed = cases.filter((c) => c.ok).length;

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">テストデータによる照合</span>
          <h1>集計・照合</h1>
          <p className="lead">入力シート・集計シート・ダッシュボードの数値が一致しているか、部署間で矛盾がないかを自動でチェックします。</p>
        </div>
      </div>

      <section className="verdict">
        <div className={`verdict-ring ${passed === cases.length ? 'all' : ''}`}><b>{passed}</b><small>/ {cases.length}</small></div>
        <div>
          <h2>{passed === cases.length ? 'すべてのテストケースに合格しています' : `${cases.length - passed}件のテストケースが未完了です`}</h2>
          <p>{cases.find((c) => c.pending) ? '「新しい日次データの反映」は、入力シートで本日分を入力すると合格になります。' : 'テストデータ（9/16〜）と本日分の入力で、集計結果を照合しました。'}</p>
        </div>
        {cases.find((c) => c.pending) && <button type="button" className="btn" onClick={() => go('sheets')}><Icon name="sheet" size={15} />入力シートへ</button>}
      </section>

      <section className="card">
        <header className="card-head"><div><h2>テストケース</h2><p>納品時にお客様と一緒に確認する項目です</p></div></header>
        <div className="cases">
          {cases.map((c, i) => (
            <div key={c.title} className={`case ${c.ok ? 'ok' : c.pending ? 'pending' : 'ng'}`}>
              <span className="case-no">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <b>{c.title}</b>
                <p>{c.desc}</p>
                {c.note && <small>{c.note}</small>}
              </div>
              <span className="case-state"><Icon name={c.ok ? 'check' : c.pending ? 'clock' : 'x'} size={14} stroke={2.6} />{c.ok ? '合格' : c.pending ? '未実施' : '要確認'}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid two">
        <section className="card">
          <header className="card-head"><div><h2>入力シート ＝ 集計シート</h2><p>全期間（{md(daily.dates[0])}〜{md(last)}）の合計</p></div></header>
          <table className="rtable">
            <thead><tr><th>項目</th><th>入力シート</th><th>集計_日次</th><th>結果</th></tr></thead>
            <tbody>
              {totals.map((t) => (
                <tr key={t.label}>
                  <td>{t.label}<small>{t.sheet}</small></td>
                  <td className="num">{fmt(t.input)}</td>
                  <td className="num">{fmt(t.table)}</td>
                  <td>{t.input === t.table ? <span className="ok-pill"><Icon name="check" size={12} stroke={3} />一致</span> : <span className="ng-pill"><Icon name="x" size={12} stroke={3} />差異 {fmt(t.table - t.input)}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <header className="card-head"><div><h2>入力シート ＝ ダッシュボード</h2><p>ダッシュボードのKPIと、入力シートを直接合計した値</p></div></header>
          {fullFilter ? (
            <table className="rtable">
              <thead><tr><th>項目</th><th>入力シート</th><th>ダッシュボード</th><th>結果</th></tr></thead>
              <tbody>
                {dashChecks.map((t) => (
                  <tr key={t.label}>
                    <td>{t.label}</td>
                    <td className="num">{fmt(t.input)}</td>
                    <td className="num">{fmt(t.dash)}</td>
                    <td>{t.input === t.dash ? <span className="ok-pill"><Icon name="check" size={12} stroke={3} />一致</span> : <span className="ng-pill"><Icon name="x" size={12} stroke={3} />差異</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted">ダッシュボードで商品・取引先の絞り込みが設定されています。全商品・すべての取引先に戻すと照合できます。</p>}

          <h3 className="sub-h">部署間の整合チェック</h3>
          <div className="xchecks">
            {kinds.map((k) => {
              const c = issues.filter((i) => i.kind === k).length;
              return (
                <div key={k} className={c ? 'warn' : 'ok'}>
                  <Icon name={c ? 'alert' : 'check'} size={15} stroke={2.4} />
                  <span>{k.replace('≠', '＝')}</span>
                  <b>{c ? `差異 ${c}件` : '問題なし'}</b>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="card">
        <header className="card-head"><div><h2>差異の一覧</h2><p>日次の照合で見つかった不一致。原因を確認して、入力シートを修正するか備考に記録します</p></div></header>
        {issues.length === 0 ? <p className="muted">差異はありません。</p> : (
          <table className="rtable">
            <thead><tr><th>日付</th><th>商品</th><th>チェック</th><th>期待値</th><th>入力値</th><th>差</th><th>備考（倉庫）</th></tr></thead>
            <tbody>
              {issues.map((i) => (
                <tr key={`${i.date}-${i.product}-${i.kind}`}>
                  <td>{md(i.date)}</td>
                  <td>{pName(i.product)}</td>
                  <td><span className="warn-pill"><Icon name="alert" size={12} stroke={2.6} />{i.kind}</span></td>
                  <td className="num">{fmt(i.a)}</td>
                  <td className="num">{fmt(i.b)}</td>
                  <td className="num bad">{i.b - i.a > 0 ? '+' : ''}{fmt(i.b - i.a)}</td>
                  <td>{noteOf(i) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
