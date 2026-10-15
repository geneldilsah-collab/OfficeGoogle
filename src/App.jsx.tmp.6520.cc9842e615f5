import { useCallback, useEffect, useMemo, useState } from 'react';
import { PRODUCTS, buildSeed } from './data';
import { buildDaily, buildView, inputStatus, md } from './aggregate';
import Icon from './components/Icon';
import Dashboard from './views/Dashboard';
import TvMode from './views/TvMode';
import Sheets from './views/Sheets';
import Reconcile from './views/Reconcile';
import Design from './views/Design';
import Manual from './views/Manual';

const STORAGE_KEY = 'ops-dashboard-demo-v1';
const NAV = [
  { key: 'dashboard', label: 'ダッシュボード', icon: 'dashboard', sub: 'Looker Studio' },
  { key: 'sheets', label: '入力シート', icon: 'sheet', sub: 'スプレッドシート' },
  { key: 'reconcile', label: '集計・照合', icon: 'check2', sub: 'テストデータ' },
  { key: 'design', label: '構成設計', icon: 'layers', sub: 'シート・数式' },
  { key: 'manual', label: '操作マニュアル', icon: 'book', sub: '担当者向け' }
];

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* 読めない場合は初期データ */ }
  return buildSeed();
}

function initialPage() {
  const h = window.location.hash.replace('#/', '');
  return NAV.some((n) => n.key === h) ? h : 'dashboard';
}

export default function App() {
  const [sheets, setSheets] = useState(load);
  const [page, setPage] = useState(initialPage);
  const [theme, setTheme] = useState(() => (new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light'));
  const [tv, setTv] = useState(() => new URLSearchParams(window.location.search).get('tv') === '1');
  const [filters, setFilters] = useState({ days: 14, products: PRODUCTS.map((p) => p.code), party: 'all' });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sheets)); } catch { /* 保存不可の環境 */ }
  }, [sheets]);
  useEffect(() => {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/${page}`);
  }, [page]);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  const notify = useCallback((message) => {
    setToast({ message, id: Date.now() });
    setTimeout(() => setToast(null), 2800);
  }, []);

  const daily = useMemo(() => buildDaily(sheets), [sheets]);
  const view = useMemo(() => buildView(sheets, daily, filters), [sheets, daily, filters]);
  const status = useMemo(() => inputStatus(sheets), [sheets]);

  const reset = () => {
    setSheets(buildSeed());
    notify('テストデータを初期状態に戻しました');
  };

  const ctx = { sheets, setSheets, daily, view, filters, setFilters, status, notify, go: setPage, openTv: () => setTv(true) };

  return (
    <div className="app">
      <header className="appbar">
        <div className="brand">
          <div className="brand-mark"><Icon name="chart" size={18} stroke={2.4} /></div>
          <div>
            <b>日次業務ダッシュボード</b>
            <small>製造・在庫・受注・出荷 ／ 国産野菜ドレッシング 4品目</small>
          </div>
        </div>
        <nav className="tabs" aria-label="画面">
          {NAV.map((n) => (
            <button key={n.key} type="button" className={page === n.key ? 'is-active' : ''} onClick={() => setPage(n.key)}>
              <Icon name={n.icon} size={16} />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="appbar-right">
          <span className="sync"><i />データ最終日 {md(view.last)}</span>
          <button type="button" className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="表示テーマを切り替え" title="ライト／ダーク">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
          </button>
          <button type="button" className="btn dark" onClick={() => setTv(true)}><Icon name="tv" size={16} />40インチ表示</button>
        </div>
      </header>

      <main className="main" key={page}>
        {page === 'dashboard' && <Dashboard ctx={ctx} />}
        {page === 'sheets' && <Sheets ctx={ctx} reset={reset} />}
        {page === 'reconcile' && <Reconcile ctx={ctx} />}
        {page === 'design' && <Design />}
        {page === 'manual' && <Manual ctx={ctx} />}
      </main>

      <nav className="bottom-tabs" aria-label="画面">
        {NAV.map((n) => (
          <button key={n.key} type="button" className={page === n.key ? 'is-active' : ''} onClick={() => setPage(n.key)}>
            <Icon name={n.icon} size={19} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      {tv && <TvMode ctx={ctx} onClose={() => setTv(false)} />}
      {toast && <div className="toast" key={toast.id}><Icon name="check" size={16} stroke={2.6} />{toast.message}</div>}
    </div>
  );
}
