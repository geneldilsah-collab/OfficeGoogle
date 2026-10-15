import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from '../components/Icon';
import { DailyChart, HeatCard, InputStatus, InventoryCard, KpiTiles, PartyCard } from './Dashboard';
import { md } from '../aggregate';

const W = 1920;
const H = 1080;

export default function TvMode({ ctx, onClose }) {
  const { view, status } = ctx;
  const wrap = useRef(null);
  const [scale, setScale] = useState(1);
  const [dark, setDark] = useState(true);
  const [now, setNow] = useState(new Date());

  useLayoutEffect(() => {
    const fit = () => {
      const el = wrap.current;
      if (!el) return;
      setScale(Math.min(el.clientWidth / W, el.clientHeight / H));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30);
    const key = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', key);
    return () => { clearInterval(t); document.removeEventListener('keydown', key); };
  }, [onClose]);

  const full = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else wrap.current?.parentElement?.requestFullscreen?.();
  };

  return (
    <div className="tv-overlay" role="dialog" aria-label="40インチモニター表示">
      <div className="tv-bar">
        <span><Icon name="tv" size={16} />40インチモニター表示（1920×1080）— 実際のモニターでは全画面で表示されます</span>
        <div>
          <button type="button" className="tv-btn" onClick={() => setDark(!dark)}><Icon name={dark ? 'sun' : 'moon'} size={15} />{dark ? 'ライト' : 'ダーク'}</button>
          <button type="button" className="tv-btn" onClick={full}><Icon name="maximize" size={15} />全画面</button>
          <button type="button" className="tv-btn" onClick={onClose}><Icon name="x" size={15} />閉じる（Esc）</button>
        </div>
      </div>
      <div className="tv-stage" ref={wrap}>
        <div className={`tv-canvas ${dark ? 'tv-dark' : 'tv-light'}`} style={{ width: W, height: H, transform: `scale(${scale})` }}>
          <header className="tv-head">
            <div>
              <h1>製造・在庫・受注・出荷 ダッシュボード</h1>
              <p>国産野菜ドレッシング 4品目 ・ 直近{view.days.length}日 ・ データ最終日 {md(view.last)}</p>
            </div>
            <InputStatus status={status} compact />
            <div className="tv-clock">
              <b>{now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</b>
              <small><Icon name="refresh" size={12} />15分ごとに自動更新</small>
            </div>
          </header>
          <KpiTiles view={view} />
          <div className="tv-grid">
            <DailyChart view={view} height={300} />
            <InventoryCard view={view} />
            <PartyCard view={view} />
            <HeatCard view={view} />
          </div>
        </div>
      </div>
    </div>
  );
}
