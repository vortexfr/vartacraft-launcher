import { useState, useEffect, useCallback, useRef } from 'react';
import Splash from './pages/Splash';
import Home from './pages/Home';
import Settings from './pages/Settings';
import Credits from './pages/Credits';
import Mentions from './pages/Mentions';
import CrashReport from './pages/CrashReport';
import News from './pages/News';
import Login from './pages/Login';
import Screenshots from './pages/Screenshots';
import Mods from './pages/Mods';
import Transition from './pages/Transition';
import Radio from './pages/Radio';

export default function App() {
  const [page, setPage]           = useState(null); // null = vérification auth en cours
  const [overlay, setOverlay]     = useState('hidden'); // 'hidden' | 'in' | 'out'
  const [overlayKey, setOverlayKey] = useState(0);       // force remount on each new nav
  const [crashData, setCrashData] = useState(null);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updatePct,  setUpdatePct]  = useState(null);
  const [updateErr,  setUpdateErr]  = useState(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const navRef = useRef([]);

  // ── Radio global ──────────────────────────────────────────────
  const audioRef = useRef(null);
  const [radioStation, setRadioStation] = useState(null);
  const [radioPlaying, setRadioPlaying] = useState(false);
  const [radioVolume,  setRadioVolume]  = useState(0.7);

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = radioVolume;
    return () => { audioRef.current?.pause(); };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!audioRef.current) return;
    if (!radioStation || !radioPlaying) { audioRef.current.pause(); return; }
    audioRef.current.src = radioStation.url;
    audioRef.current.play().catch(() => setRadioPlaying(false));
  }, [radioStation, radioPlaying]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = radioVolume;
  }, [radioVolume]);

  function radioSelect(station) {
    if (radioStation?.id === station.id) setRadioPlaying(p => !p);
    else { setRadioStation(station); setRadioPlaying(true); }
  }
  const showBar = radioStation && !['login','splash','transition',null].includes(page);

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

  // Vérification auth au démarrage
  useEffect(() => {
    window.launcher?.getAuth()
      .then(auth => setPage(auth?.pseudo ? 'splash' : 'login'))
      .catch(() => setPage('login'));
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

  async function handleUpdate() {
    if (!updateInfo) return;
    setUpdateErr(null);
    setUpdatePct(0);
    try {
      const res = await window.launcher.startUpdate(updateInfo.url);
      if (!res?.success) {
        setUpdateErr(res?.error || 'Erreur lors du téléchargement.');
        setUpdatePct(null);
      }
    } catch {
      setUpdateErr('Impossible de télécharger la mise à jour.');
      setUpdatePct(null);
    }
  }

  const page_el = (() => {
    if (page === null)          return null;
    if (page === 'login')       return <Login        onDone={() => navigate('splash')} />;
    if (page === 'splash')      return <Splash       onDone={() => navigate('transition')} />;
    if (page === 'transition')  return <Transition   onDone={() => navigate('home')} />;
    if (page === 'crash')       return <CrashReport  data={crashData} onBack={() => navigate('home')} />;
    if (page === 'news')        return <News          onBack={() => navigate('home')} />;
    if (page === 'screenshots') return <Screenshots  onBack={() => navigate('home')} />;
    if (page === 'mods')        return <Mods         onBack={() => navigate('home')} />;
    if (page === 'settings')    return <Settings     onBack={() => navigate('home')} onLogout={() => navigate('login')} />;
    if (page === 'credits')     return <Credits      onBack={() => navigate('home')} />;
    if (page === 'mentions')    return <Mentions     onBack={() => navigate('home')} />;
    if (page === 'radio')       return <Radio        onBack={() => navigate('home')} currentStation={radioStation} isPlaying={radioPlaying} onSelect={radioSelect} volume={radioVolume} onVolume={setRadioVolume} />;
    return <Home onNav={navigate} radioBarActive={showBar} />;
  })();

  return (
    <>
      {page_el}

      {updateInfo && (
        <div style={{
          position:'fixed', inset:0, zIndex:9999,
          background:'rgba(8,8,16,0.85)', backdropFilter:'blur(6px)',
          display:'flex', alignItems:'center', justifyContent:'center',
          WebkitAppRegion:'no-drag',
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
            {updateErr && (
              <div style={{ fontSize:'0.75rem', color:'#f87171', margin:'0 0 0.75rem', fontFamily:'Inter, sans-serif' }}>
                {updateErr}
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
                    height:'100%',
                    width: updatePct > 0 ? `${updatePct}%` : '100%',
                    background:'linear-gradient(90deg,#c9972a,#e8b840)',
                    transition: updatePct > 0 ? 'width 0.3s ease' : 'none',
                    animation: updatePct === 0 ? 'progressPulse 1.2s ease-in-out infinite' : 'none',
                    opacity: updatePct === 0 ? 0.5 : 1,
                  }} />
                </div>
                <div style={{ fontSize:'0.78rem', opacity:0.6, fontFamily:'Inter, sans-serif' }}>
                  {updatePct === 0 ? 'Téléchargement en cours…' : updatePct < 100 ? `Téléchargement… ${updatePct}%` : 'Installation en cours…'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Close confirmation */}
      {showCloseConfirm && (
        <div style={{
          position:'fixed', inset:0, zIndex:20000,
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

      {/* Mini radio bar — persiste sur toutes les pages */}
      {showBar && (
        <div className="radio-bar">
          <div className="radio-bar-dot" style={{ '--dot-color': radioStation.color }} />
          <span className="radio-bar-name">{radioStation.name}</span>
          <span className="radio-bar-genre">{radioStation.genre}</span>
          <button className="radio-bar-btn" style={{WebkitAppRegion:'no-drag'}} onClick={() => setRadioPlaying(p => !p)}>
            {radioPlaying
              ? <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              : <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
          </button>
          <button className="radio-bar-btn" style={{WebkitAppRegion:'no-drag'}} onClick={() => { setRadioPlaying(false); setRadioStation(null); }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
          </button>
          <input type="range" min="0" max="1" step="0.01" value={radioVolume} onChange={e => setRadioVolume(parseFloat(e.target.value))} className="radio-bar-vol" style={{WebkitAppRegion:'no-drag'}} />
        </div>
      )}

      {/* Cinematic transition overlay */}
      {overlay !== 'hidden' && (
        <div key={overlayKey} className={`nav-overlay nav-overlay--${overlay}`} />
      )}
    </>
  );
}