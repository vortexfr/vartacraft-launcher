import { useState, useEffect } from 'react';
import Splash from './pages/Splash';
import Home from './pages/Home';
import Settings from './pages/Settings';
import Credits from './pages/Credits';
import Mentions from './pages/Mentions';
import CrashReport from './pages/CrashReport';

export default function App() {
  const [page, setPage]         = useState('splash');
  const [crashData, setCrashData] = useState(null);
  const [updateInfo, setUpdateInfo] = useState(null);   // { current, latest, url, notes }
  const [updatePct,  setUpdatePct]  = useState(null);   // null=idle, 0-100=downloading

  useEffect(() => {
    if (!window.launcher) return;
    window.launcher.onCrashReport((data) => {
      setCrashData(data);
      setPage('crash');
    });
    window.launcher.onUpdateAvailable((data) => setUpdateInfo(data));
    window.launcher.onUpdateProgress((pct)  => setUpdatePct(pct));
  }, []);

  function handleUpdate() {
    if (!updateInfo) return;
    setUpdatePct(0);
    window.launcher.startUpdate(updateInfo.url).catch(() => setUpdatePct(null));
  }

  const page_el = (() => {
    if (page === 'splash')   return <Splash onDone={() => setPage('home')} />;
    if (page === 'crash')    return <CrashReport data={crashData} onBack={() => setPage('home')} />;
    if (page === 'settings') return <Settings onBack={() => setPage('home')} />;
    if (page === 'credits')  return <Credits  onBack={() => setPage('home')} />;
    if (page === 'mentions') return <Mentions onBack={() => setPage('home')} />;
    return <Home onNav={setPage} />;
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
    </>
  );
}