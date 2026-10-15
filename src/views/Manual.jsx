import Icon, { DEPT_ICON } from '../components/Icon';
import { DEPTS } from '../data';

const DAILY = {
  prod: ['日付・商品コードを選ぶ', '製造数と不良数を入力（良品数は自動計算）', 'ラインと担当者を入力'],
  wh: ['日付・商品コードを選ぶ', '入庫数・出庫数を入力', '金曜日は棚卸の実在庫も入力。差異があれば備考に理由を記入'],
  sales: ['日付・取引先・商品コードを選ぶ', '受注数と出荷数を入力（未出荷は自動計算）', '分納の場合は出荷した分だけを入力'],
  ec: ['日付・チャネル・商品コードを選ぶ', '受注数と出荷数を入力', 'モールごとに1行ずつ入力']
};

const FAQ = [
  { q: 'セルが赤くなった', a: '入力ルールに合わない値です（マイナス、不良数が製造数より多い など）。セルにカーソルを合わせると理由が表示されます。' },
  { q: 'ダッシュボードに数字が反映されない', a: 'Looker Studio は最大15分ごとに更新されます。すぐ確認したい場合は、レポート右上の「︙」→「データを更新」を押してください。' },
  { q: '過去の日付を修正したい', a: '入力シートの該当行を直接修正してください。集計とダッシュボードは自動で再計算されます。' },
  { q: '新しい商品を追加したい', a: 'M_商品 シートに1行追加します（管理者のみ）。プルダウン・集計・ダッシュボードに自動で反映されます。' }
];

export default function Manual({ ctx }) {
  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">社内担当者向け</span>
          <h1>簡易操作マニュアル</h1>
          <p className="lead">毎日の作業は「自分の部署のシートに入力する」だけです。集計とダッシュボードの更新は自動で行われます。</p>
        </div>
        <button type="button" className="btn ghost" onClick={() => window.print()}><Icon name="book" size={15} />印刷する</button>
      </div>

      <section className="card">
        <header className="card-head"><div><h2>1日の流れ</h2></div></header>
        <div className="day-flow">
          <div><span>17:00 まで</span><b>各部署が当日分を入力</b><p>製造・営業・EC は当日中、倉庫は出荷締め後に入力</p></div>
          <Icon name="arrow" size={20} />
          <div><span>自動</span><b>集計シートが再計算</b><p>入力と同時に、在庫・受注残・照合が更新されます</p></div>
          <Icon name="arrow" size={20} />
          <div><span>15分以内</span><b>ダッシュボードに反映</b><p>40インチモニターの表示も自動で切り替わります</p></div>
          <Icon name="arrow" size={20} />
          <div><span>翌朝</span><b>朝礼で確認</b><p>在庫の注意表示と、部署間の差異をチェック</p></div>
        </div>
      </section>

      <section className="card">
        <header className="card-head"><div><h2>部署ごとの入力手順</h2><p>入力するのは白いセルだけ。灰色のセルは自動計算です</p></div></header>
        <div className="manual-grid">
          {DEPTS.map((d) => (
            <div key={d.key} className="manual-dept">
              <div className="md-head"><span><Icon name={DEPT_ICON[d.key]} size={18} /></span><div><b>{d.name}</b><small>シート：{d.sheet}</small></div></div>
              <ol>{DAILY[d.key].map((s) => <li key={s}>{s}</li>)}</ol>
            </div>
          ))}
        </div>
        <button type="button" className="btn ghost" onClick={() => ctx.go('sheets')}><Icon name="sheet" size={15} />入力シートで試してみる</button>
      </section>

      <div className="grid two">
        <section className="card">
          <header className="card-head"><div><h2>40インチモニターでの表示</h2></div></header>
          <ol className="num-list">
            <li>モニターにつないだPCで、Looker Studio のレポートを開く</li>
            <li>右上の「表示」→ ページ「40インチ表示」を選ぶ</li>
            <li>ブラウザを全画面表示（F11）にする</li>
            <li>レポートの自動更新は「15分」に設定済みのため、操作は不要</li>
          </ol>
          <button type="button" className="btn ghost" onClick={ctx.openTv}><Icon name="tv" size={15} />表示イメージを見る</button>
        </section>
        <section className="card">
          <header className="card-head"><div><h2>困ったときは</h2></div></header>
          <div className="faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary><Icon name="info" size={15} />{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
