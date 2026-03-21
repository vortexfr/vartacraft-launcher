import { useState, useEffect, useCallback, useRef } from 'react';
import Splash from './pages/Splash';
import Home from './pages/Home';
import Settings from './pages/Settings';
import Credits from './pages/Credits';
import Mentions from './pages/Mentions';
import CrashReport from './pages/CrashReport';
import News from './pages/News';
import Welcome from './pages/Welcome';
import Screenshots from './pages/Screenshots';
import Mods from './pages/Mods';
import Transition from './pages/Transition';

export default function App() {
  const [page, setPage]           = useState('splash');
  const [overlay, setOverlay]     = useState('hidden'); // 'hidden' | 'in' | 'out'
  const [overlayKey, setOverlayKey] = useState(0);       // force remount on each new nav
  const [crashData, setCrashData] = useState(null);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updatePct,  setUpdatePct]  = useState(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const navRef = useRef([]);

  // Cinematic page transition: dark overlay + gold sweep line
  const navigate = useCallback((newPage) => {
    // Cancel all pending timers from any previous transition
    navRef.current.forEach(t => t && clearTimeout(t));

    // New key → React remounts the overlay div → animation always replays
    setOverlayKey(k => k + 1);
    setOverlay('in');

    const t1 = setTimeout(() => {
      setPage(newPage);
      setOverlay('out');
      const t2    = setTimeout(() => setOverlay('hidden'), 480);
      const tSafe = setTimeout(() => setOverlay('hidden'), 1400); // safety net
      navRef.current = [null, t2, tSafe];
    }, 280);

    navRef.current = [t1];
  }, []);

  // Intercept close globally via IPC event from main process
  useEffect(() => {
    if (!window.launcher) return;
    const unsub = window.launcher.onCloseRequest(() => setShowCloseConfirm(true));
    return () => unsub?.();
  }, []);

  function confirmClose() {
    setShowCloseConfirm(false);
    window.launcher?.confirmClose();
  }

  useEffect(() => {
    if (!window.launcher) return;
    const c1 = window.launcher.onCrashReport((data) => { setCrashData(data); navigate('crash'); });
    const c2 = window.launcher.onUpdateAvailable((data) => setUpdateInfo(data));
    const c3 = window.launcher.onUpdateProgress((pct)  => setUpdatePct(pct));
    return () => { c1?.(); c2?.(); c3?.(); };
  }, [navigate]);

  function handleUpdate() {
    if (!updateInfo) return;
    setUpdatePct(0);
    window.launcher.startUpdate(updateInfo.url).catch(() => setUpdatePct(null));
  }

  const page_el = (() => {
    if (page === 'splash')      return <Splash      onDone={() => navigate('transition')} />;
    if (page === 'transition')  return <Transition  onDone={() => navigate('home')} />;
    if (page === 'crash')       return <CrashReport data={crashData} onBack={() => navigate('home')} />;
    if (page === 'welcome')     return <Welcome      onDone={() => navigate('home')} />;
    if (page === 'news')        return <News         onBack={() => navigate('home')} />;
    if (page === 'screenshots') return <Screenshots  onBack={() => navigate('home')} />;
    if (page === 'mods')        return <Mods         onBack={() => navigate('home')} />;
    if (page === 'settings')    return <Settings     onBack={() => navigate('home')} />;
    if (page === 'credits')     return <Credits      onBack={() => navigate('home')} />;
    if (page === 'mentions')    return <Mentions     onBack={() => navigate('home')} />;
    return <Home onNav={navigate} />;
  })();

  return (
    <>
      {page_el}

      {updateInfo && (
        <div style={{
          position:'fixed', inset:0, zIndex:9999,
          background:'rgba(8,8,16,0.85)', backdropFilter:'blur(6px)',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <div style={{
            background:'#0f0e14', border:'1px solid rgba(201,151,42,0.4)',
            borderRadius:'10px', padding:'2rem 2.5rem', maxWidth:'380px', width:'90%',
            textAlign:'center', color:'#ddd5c4', fontFamily:'Cinzel, serif',
          }}>
            <div style={{ fontSize:'1.5rem', fontWeight:700, color:'#c9972a', marginBottom:'0.5rem' }}>
              Mise à jour disponible
            </div>
            <div style={{ fontSize:'0.85rem', marginBottom:'0.25rem', opacity:0.7 }}>
              v{updateInfo.current} → <strong style={{color:'#c9972a'}}>v{updateInfo.latest}</strong>
            </div>
            {updateInfo.notes && (
              <div style={{ fontSize:'0.78rem', opacity:0.55, margin:'0.5rem 0 1rem', fontFamily:'Inter, sans-serif' }}>
                {updateInfo.notes}
              </div>
            )}
            {updatePct === null ? (
              <button onClick={handleUpdate} style={{
                background:'linear-gradient(135deg,#c9972a,#a07820)',
                border:'none', borderRadius:'6px', color:'#fff',
                fontFamily:'Cinzel, serif', fontWeight:700,
                padding:'0.6rem 1.8rem', cursor:'pointer', fontSize:'0.9rem',
                width:'100%',
              }}>
                Mettre à jour
              </button>
            ) : (
              <div>
                <div style={{
                  background:'rgba(255,255,255,0.08)', borderRadius:'4px',
                  overflow:'hidden', height:'8px', margin:'0.75rem 0 0.4rem',
                }}>
                  <div style={{
                    height:'100%', width:`${updatePct}%`,
                    background:'linear-gradient(90deg,#c9972a,#e8b840)',
                    transition:'width 0.3s ease',
                  }} />
                </div>
                <div style={{ fontSize:'0.78rem', opacity:0.6, fontFamily:'Inter, sans-serif' }}>
                  {updatePct < 100 ? `Téléchargement… ${updatePct}%` : 'Installation en cours…'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Close confirmation */}
      {showCloseConfirm && (
        <div style={{
          position:'fixed', inset:0, zIndex:10001,
          background:'rgba(6,4,1,0.88)', backdropFilter:'blur(8px)',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <div style={{
            background:'#0f0e14', border:'1px solid rgba(201,151,42,0.3)',
            borderRadius:'12px', padding:'2rem 2.2rem', maxWidth:'360px', width:'90%',
            textAlign:'center', color:'#ddd5c4', fontFamily:'Inter, sans-serif',
            boxShadow:'0 0 40px rgba(0,0,0,0.6)',
          }}>
            <div style={{ marginBottom:'0.8rem' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(201,151,42,0.65)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>
            <div style={{ fontSize:'1rem', fontWeight:700, fontFamily:'Cinzel, serif', color:'#ddd5c4', marginBottom:'0.5rem', letterSpacing:'0.05em' }}>
              Fermer le launcher ?
            </div>
            <div style={{ fontSize:'0.76rem', lineHeight:1.6, color:'rgba(221,213,196,0.55)', marginBottom:'1.4rem' }}>
              Si une partie est en cours, le jeu sera également arrêté.
            </div>
            <div style={{ display:'flex', gap:'0.75rem', justifyContent:'center' }}>
              <button onClick={confirmClose} className="popup-btn-close">
                Fermer
              </button>
              <button onClick={() => setShowCloseConfirm(false)} className="popup-btn-cancel">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cinematic transition overlay */}
      {overlay !== 'hidden' && (
        <div key={overlayKey} className={`nav-overlay nav-overlay--${overlay}`} />
      )}
    </>
  );
}