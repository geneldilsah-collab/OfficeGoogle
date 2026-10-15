import { useState } from 'react';
import Icon, { DEPT_ICON } from '../components/Icon';
import { DEPTS } from '../data';

const FORMULAS = [
  {
    title: '集計_縦持ち（4部署のデータを1つの表にまとめる）',
    note: 'Looker Studio が最も扱いやすい「日付・商品・指標・数量」の縦持ち形式に変換します。部署のシートの列構成が変わらない限り、行が増えても自動で追従します。',
    code: `={
  QUERY(入力_製造!A2:E, "select A, B, '製造', D - E where A is not null label '製造' '', D - E ''", 0);
  QUERY(入力_倉庫!A2:E, "select A, B, '入庫', D where A is not null label '入庫' ''", 0);
  QUERY(入力_倉庫!A2:E, "select A, B, '出庫', E where A is not null label '出庫' ''", 0);
  QUERY(入力_営業!A2:F, "select A, C, '受注_営業', E where A is not null label '受注_営業' ''", 0);
  QUERY(入力_営業!A2:F, "select A, C, '出荷_営業', F where A is not null label '出荷_営業' ''", 0);
  QUERY(入力_EC!A2:F,   "select A, C, '受注_EC', E where A is not null label '受注_EC' ''", 0);
  QUERY(入力_EC!A2:F,   "select A, C, '出荷_EC', F where A is not null label '出荷_EC' ''", 0)
}`
  },
  {
    title: '集計_日次（在庫の計算）',
    note: '倉庫の入出庫を日付順に積み上げ、M_商品の期首在庫を足して計算在庫を出します。棚卸実在庫との照合にも使います。',
    code: `=M_商品!E2
 + SUMIFS(集計_縦持ち!D:D, 集計_縦持ち!B:B, B2, 集計_縦持ち!C:C, "入庫", 集計_縦持ち!A:A, "<="&A2)
 - SUMIFS(集計_縦持ち!D:D, 集計_縦持ち!B:B, B2, 集計_縦持ち!C:C, "出庫", 集計_縦持ち!A:A, "<="&A2)`
  },
  {
    title: '入力シートの商品名（自動表示）',
    note: '入力者は商品コードをプルダウンで選ぶだけ。商品名は数式で自動表示し、手入力による表記ゆれを防ぎます。',
    code: `=ARRAYFORMULA(IF(B2:B = "", , VLOOKUP(B2:B, M_商品!A:B, 2, FALSE)))`
  },
  {
    title: '照合（部署間の整合チェック）',
    note: '製造良品と倉庫入庫、出荷合計と倉庫出庫を日付×商品で突き合わせ、差があればフラグを立てます。',
    code: `=IF(SUMIFS(集計_縦持ち!D:D, 集計_縦持ち!A:A, A2, 集計_縦持ち!B:B, B2, 集計_縦持ち!C:C, "製造")
   = SUMIFS(集計_縦持ち!D:D, 集計_縦持ち!A:A, A2, 集計_縦持ち!B:B, B2, 集計_縦持ち!C:C, "入庫"),
   "一致", "要確認")`
  }
];

const STEPS = [
  { t: '要件確認・Excelテンプレートの確認', d: '4部署のExcelと運用ルールを確認し、集計に必要な項目・単位をすり合わせ', w: '2〜3日' },
  { t: 'スプレッドシートへの移行・調整', d: '入力シート・マスタ・入力規則・保護範囲を作成', w: '3〜4日' },
  { t: '集計シートの作成', d: '縦持ち集計・在庫計算・照合シートを作成', w: '2〜3日' },
  { t: 'Looker Studio の構築', d: '商品別・日別・取引先別のレポートと40インチ表示用ページ', w: '3〜5日' },
  { t: 'テストデータで照合', d: 'テストケースに沿って集計結果を確認し、修正', w: '2日' },
  { t: 'マニュアル作成・納品', d: '担当者向け操作マニュアル、納品後14日間の初期不具合対応', w: '2日＋14日' }
];

export default function Design() {
  const [copied, setCopied] = useState(null);
  const copy = (i, text) => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(i); setTimeout(() => setCopied(null), 1600); }).catch(() => {});
  };

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">構成設計</span>
          <h1>シート構成と、データの流れ</h1>
          <p className="lead">手入力を前提に、入力・マスタ・集計・表示の役割を分けて設計します。商品追加やAPI連携のときも、変更が一部のシートだけで済む構成です。</p>
        </div>
      </div>

      <section className="card flow-card">
        <div className="flow">
          <div className="flow-col">
            <h4>① 入力（各部署）</h4>
            {DEPTS.map((d) => (
              <div key={d.key} className="node input"><Icon name={DEPT_ICON[d.key]} size={16} /><div><b>{d.sheet}</b><small>{d.owner}が毎日入力</small></div></div>
            ))}
          </div>
          <div className="flow-arrow"><Icon name="arrow" size={22} /></div>
          <div className="flow-col">
            <h4>② マスタ</h4>
            <div className="node master"><Icon name="db" size={16} /><div><b>M_商品</b><small>商品コード・名称・安全在庫・期首在庫</small></div></div>
            <div className="node master"><Icon name="db" size={16} /><div><b>M_取引先</b><small>取引先・EC チャネル</small></div></div>
            <p className="flow-note">プルダウンの選択肢と、集計の基準になります</p>
          </div>
          <div className="flow-arrow"><Icon name="arrow" size={22} /></div>
          <div className="flow-col">
            <h4>③ 集計（数式・入力不可）</h4>
            <div className="node calc"><Icon name="layers" size={16} /><div><b>集計_縦持ち</b><small>4部署を1つの表に（QUERY）</small></div></div>
            <div className="node calc"><Icon name="layers" size={16} /><div><b>集計_日次</b><small>日付×商品の在庫・受注残</small></div></div>
            <div className="node calc"><Icon name="check2" size={16} /><div><b>照合</b><small>部署間の差異チェック</small></div></div>
          </div>
          <div className="flow-arrow"><Icon name="arrow" size={22} /></div>
          <div className="flow-col">
            <h4>④ 表示</h4>
            <div className="node view"><Icon name="dashboard" size={16} /><div><b>Looker Studio</b><small>商品別・日別・取引先別</small></div></div>
            <div className="node view"><Icon name="tv" size={16} /><div><b>40インチ表示ページ</b><small>1920×1080・自動更新</small></div></div>
          </div>
        </div>
      </section>

      <div className="grid two">
        <section className="card">
          <header className="card-head"><div><h2>将来の拡張に備えた設計</h2></div></header>
          <div className="future">
            <div><span className="future-tag">商品の追加</span><p><b>M_商品 に1行追加するだけ。</b>入力シートのプルダウン、集計、ダッシュボードのフィルターに自動で反映されます。</p></div>
            <div><span className="future-tag">API連携</span><p><b>入力シートと同じ列の「取込」シートを用意。</b>手入力をAPI取り込みに置き換えても、集計シートとダッシュボードは変更不要です。</p></div>
            <div><span className="future-tag">データ量の増加</span><p><b>縦持ち形式で集計を一本化。</b>将来BigQueryなどに移す場合も、同じ列構成のまま移行できます。</p></div>
          </div>
        </section>
        <section className="card">
          <header className="card-head"><div><h2>運用ルール（手入力前提）</h2></div></header>
          <ul className="rules">
            <li><Icon name="shield" size={15} />集計・マスタシートは保護し、入力シートのみ各部署が編集</li>
            <li><Icon name="check" size={15} />商品・取引先・チャネルはプルダウンで選択（表記ゆれ防止）</li>
            <li><Icon name="alert" size={15} />マイナス値・矛盾する数値はセルが赤くなる（条件付き書式）</li>
            <li><Icon name="clock" size={15} />日次更新：各部署が当日分を入力 → Looker Studio は15分ごとに自動更新</li>
            <li><Icon name="link" size={15} />すべてお客様のGoogleアカウント上に構築（データは社外に出ません）</li>
          </ul>
        </section>
      </div>

      <section className="card">
        <header className="card-head"><div><h2>主な数式（実際に使用する想定）</h2><p>Googleスプレッドシートの標準関数のみで構成し、特別なツールは使いません</p></div></header>
        <div className="formulas">
          {FORMULAS.map((f, i) => (
            <div key={f.title} className="formula">
              <div className="formula-head">
                <b>{f.title}</b>
                <button type="button" className="ghost-btn" onClick={() => copy(i, f.code)}><Icon name={copied === i ? 'check' : 'copy'} size={14} />{copied === i ? 'コピーしました' : 'コピー'}</button>
              </div>
              <p>{f.note}</p>
              <pre><code>{f.code}</code></pre>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <header className="card-head"><div><h2>作業の流れ（目安）</h2><p>各工程で画面を共有しながら進めます</p></div></header>
        <ol className="timeline">
          {STEPS.map((s, i) => (
            <li key={s.t}>
              <span className="tl-no">{i + 1}</span>
              <div><b>{s.t}</b><p>{s.d}</p></div>
              <em>{s.w}</em>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
