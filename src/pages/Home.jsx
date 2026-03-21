import { useState, useEffect, useRef } from 'react';
import backgroundImg from '../assets/background.png';
import bannerImg from '../assets/banner.png';
import './Home.css';

export default function Home({ onNav }) {
  const [profiles, setProfiles] = useState([]);
  const [selected, setSelected] = useState('');
  const [ram, setRam] = useState(4);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState('');
  const [server, setServer] = useState(undefined);
  const [showDropdown, setShowDropdown] = useState(false);
  const [announcement, setAnnouncement] = useState(null);
  const [playtime, setPlaytime] = useState(null);
  const [ramWarning, setRamWarning] = useState(null); // { totalGb }
  const [ready, setReady] = useState(false);
  const [skinTransform, setSkinTransform] = useState('');
  const skinRef = useRef(null);
  const devConsole = localStorage.getItem('vc_devconsole') === '1';

  function formatPlaytime(seconds) {
    if (!seconds || seconds < 60) return null;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  useEffect(() => {
    window.launcher?.getProfiles()
      .then(data => {
        const profs = data?.profiles || [];
        if (profs.length === 0) { onNav('welcome'); return; }
        setProfiles(profs);
        setSelected(data?.selected || '');
        setReady(true);
      })
      .catch(() => setReady(true));

    const savedRam = Number(localStorage.getItem('vc_ram')) || 4;
    setRam(Math.max(4, savedRam));

    window.launcher?.pingServer()
      .then(res => setServer(res ?? null))
      .catch(() => setServer(null));

    // Restore launching state if install was in progress (e.g. user navigated away)
    window.launcher?.getIsLaunching().then(running => {
      if (running) {
        setLaunching(true);
        setStatus('Installation en cours...');
      }
    }).catch(() => {});

    window.launcher?.getAnnouncement()
      .then(ann => {
        if (!ann) return;
        const key = `vc_ann_${ann.id || ann.title}`;
        if (!localStorage.getItem(key)) setAnnouncement({ ...ann, key });
      })
      .catch(() => {});

    window.launcher?.getPlaytime()
      .then(setPlaytime)
      .catch(() => {});

    window.launcher?.getSystemRam()
      .then(({ totalGb }) => { if (totalGb <= 4.2) setRamWarning({ totalGb }); })
      .catch(() => {});

    const c1 = window.launcher?.onGameClosed(() => {
      setLaunching(false);
      setStatus('');
      setProgress(0);
      window.launcher?.getPlaytime().then(setPlaytime).catch(() => {});
    });

    const c2 = window.launcher?.onInstallStatus(({ text, pct }) => {
      setStatus(text);
      setProgress(pct ?? 0);
    });

    return () => { c1?.(); c2?.(); };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!skinRef.current) return;
      const rect = skinRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width  / 2;
      const cy = rect.top  + rect.height / 2;
      const dx = (e.clientX - cx) / window.innerWidth;
      const dy = (e.clientY - cy) / window.innerHeight;
      const ry =  dx * 12;
      const rx = -dy *  8;
      setSkinTransform(`perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg)`);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleLaunch = async () => {
    if (!selected.trim() || launching) return;
    setError('');
    setLaunching(true);
    setProgress(0);
    setStatus('Vérification...');
    if (devConsole) window.launcher?.openConsoleWindow();
    window.launcher?.setRPC('En jeu sur Vartacraft', selected.trim());
    const result = await window.launcher.launch({ username: selected.trim(), ram });
    if (!result.success) {
      setError(result.error);
      setLaunching(false);
      setStatus('');
      window.launcher?.setRPC('Au menu principal', null);
    }
  };

  const handleSelectProfile = async (name) => {
    setSelected(name);
    setShowDropdown(false);
    const data = await window.launcher?.getProfiles();
    if (data) window.launcher?.saveProfiles({ ...data, selected: name });
  };

  if (!ready) return null;

  return (
    <>
    <div className="home" onClick={() => setShowDropdown(false)}>
      <img className="home-bg" src={backgroundImg} alt="" />
      <div className="home-overlay" />

      {/* Announcement banner */}
      {announcement && (
        <div className="home-announcement">
          <span className="ann-icon">📢</span>
          <div className="ann-text">
            <strong>{announcement.title}</strong>
            {announcement.body && <span> — {announcement.body}</span>}
          </div>
          <button className="ann-close" onClick={() => {
            localStorage.setItem(announcement.key, '1');
            setAnnouncement(null);
          }}>✕</button>
        </div>
      )}

      {/* Titlebar */}
      <div className="titlebar">
        <div style={{ flex: 1 }} />
        <span className="titlebar-title">VARTACRAFT LAUNCHER</span>
        <div className="titlebar-controls">
          <button className="tb-btn"          onClick={() => window.launcher?.minimize()}><svg width="10" height="2" viewBox="0 0 10 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="0" y1="1" x2="10" y2="1"/></svg></button>
          <button className="tb-btn tb-close" onClick={() => window.launcher?.close()}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg></button>
        </div>
      </div>

      {/* Layout */}
      <div className="home-layout">
        {/* Left sidebar */}
        <nav className="home-sidebar">
          {/* Settings */}
          <button className="sidebar-btn" disabled={launching} onClick={() => onNav('settings')}>
            <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span className="sidebar-label">Paramètres</span>
          </button>

          {/* News */}
          <button className="sidebar-btn" disabled={launching} onClick={() => onNav('news')}>
            <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5"/><rect x="10" y="6" width="8" height="4" rx="1"/>
            </svg>
            <span className="sidebar-label">News</span>
          </button>

          {/* Crédits */}
          <button className="sidebar-btn" disabled={launching} onClick={() => onNav('credits')}>
            <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span className="sidebar-label">Crédits</span>
          </button>

          {/* Mentions légales */}
          <button className="sidebar-btn" disabled={launching} onClick={() => onNav('mentions')}>
            <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
            </svg>
            <span className="sidebar-label">Mentions</span>
          </button>

          {/* Mods / Resource packs */}
          <button className="sidebar-btn" disabled={launching} onClick={() => onNav('mods')}>
            <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
            </svg>
            <span className="sidebar-label">Ressources</span>
          </button>

          {/* Screenshots */}
          <button className="sidebar-btn" disabled={launching} onClick={() => onNav('screenshots')}>
            <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
            </svg>
            <span className="sidebar-label">Captures</span>
          </button>

          <div className="sidebar-bottom">
            {/* Site */}
            <button className="sidebar-btn" onClick={() => window.launcher?.openUrl('https://vartacraft.fr/')}>
              <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <span className="sidebar-label">Site</span>
            </button>

            {/* Discord */}
            <button className="sidebar-btn" onClick={() => window.launcher?.openUrl('https://discord.gg/YJkVJ7CRh9')}>
              <svg className="sidebar-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.046.033.06a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.1.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <span className="sidebar-label">Discord</span>
            </button>
          </div>
        </nav>

        {/* Main content */}
        <div className="home-main">
          <img className="home-banner" src={bannerImg} alt="Vartacraft" />

          {/* Server status */}
          <div className="home-server-status">
            {server === undefined ? (
              <span className="server-text server-loading">Connexion au serveur...</span>
            ) : server?.online ? (
              <>
                <span className="server-dot online" />
                <span className="server-text">{server.players.online}/{server.players.max} joueurs en ligne</span>
              </>
            ) : (
              <>
                <span className="server-dot offline" />
                <span className="server-text server-offline">Serveur hors ligne</span>
              </>
            )}
          </div>

          {/* Play area: skin + panel side by side */}
          <div className="home-play-area">
          {selected && (
            <div className="home-skin">
              <img
                ref={skinRef}
                className="home-skin-img"
                src={`https://mc-heads.net/body/${encodeURIComponent(selected)}/80`}
                alt=""
                style={{ transform: skinTransform, transition: 'transform 0.18s ease-out' }}
                onError={e => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
          )}

          {/* Panel */}
          <div className="home-panel" onClick={e => e.stopPropagation()}>
            <div className="home-warning">
              ⚠ Utilisez le même pseudo que sur le site pour le système de vote et boutique
            </div>

            <div
              className={`profile-selector ${showDropdown ? 'open' : ''}`}
              onClick={() => !launching && setShowDropdown(v => !v)}
            >
              <span className="profile-icon">👤</span>
              <span className="profile-name">{selected || 'Sélectionner un profil...'}</span>
              <span className="profile-arrow">{showDropdown ? '▲' : '▼'}</span>
            </div>

            {showDropdown && (
              <div className="profile-dropdown">
                {profiles.length === 0 ? (
                  <div className="profile-empty">Aucun profil — créez-en un dans Paramètres</div>
                ) : (
                  profiles.map(p => (
                    <div
                      key={p.name}
                      className={`profile-option ${selected === p.name ? 'active' : ''}`}
                      onClick={() => handleSelectProfile(p.name)}
                    >
                      {p.name}
                    </div>
                  ))
                )}
              </div>
            )}

            {!selected && !error && (
              <p className="home-notice">Aucun profil sélectionné — créez-en un dans Paramètres</p>
            )}
            {error && <p className="home-error">{error}</p>}

            {launching && (
              <div className="home-progress-wrap">
                <div className="home-progress-bar">
                  <div className="home-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <div className="home-progress-row">
                  <p className="home-progress-text">{status}</p>
                  <span className="home-progress-pct">{progress}%</span>
                </div>
              </div>
            )}

            <button
              className={`home-play ${launching ? 'loading' : ''}`}
              onClick={handleLaunch}
              disabled={launching || !selected.trim()}
            >
              {launching
                ? <span className="dots"><span /><span /><span /></span>
                : 'JOUER'}
            </button>
          </div>
          </div>{/* end home-play-area */}

          <div className="home-footer">
            Forge 1.20.1 — 47.4.13 &nbsp;·&nbsp; {ram} Go RAM
            {playtime && formatPlaytime(playtime.totalSeconds) && (
              <> &nbsp;·&nbsp; {formatPlaytime(playtime.totalSeconds)} joués</>
            )}
          </div>
        </div>
      </div>

    </div>

    {/* RAM warning modal */}
    {ramWarning && (
      <div style={{
        position:'fixed', inset:0, zIndex:9999,
        background:'rgba(6,4,1,0.88)', backdropFilter:'blur(8px)',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <div style={{
          background:'#0f0e14', border:'1px solid rgba(248,113,113,0.35)',
          borderRadius:'12px', padding:'2rem 2.2rem', maxWidth:'400px', width:'90%',
          textAlign:'center', color:'#ddd5c4', fontFamily:'Inter, sans-serif',
          boxShadow:'0 0 40px rgba(248,113,113,0.12)',
        }}>
          <div style={{ fontSize:'2rem', marginBottom:'0.75rem' }}>⚠️</div>
          <div style={{ fontSize:'1.1rem', fontWeight:700, color:'#f87171', marginBottom:'0.6rem', fontFamily:'Cinzel, serif' }}>
            RAM insuffisante
          </div>
          <div style={{ fontSize:'0.82rem', lineHeight:1.65, opacity:0.85, marginBottom:'0.5rem' }}>
            Votre PC dispose de <strong style={{color:'#f87171'}}>{ramWarning.totalGb} Go</strong> de RAM au total.
          </div>
          <div style={{ fontSize:'0.78rem', lineHeight:1.65, opacity:0.7, marginBottom:'1.4rem',
            background:'rgba(248,113,113,0.06)', border:'1px solid rgba(248,113,113,0.15)',
            borderRadius:'8px', padding:'0.75rem 1rem', textAlign:'left',
          }}>
            Le jeu nécessite <strong>4 Go</strong> rien que pour Minecraft.<br/>
            Windows et les processus système consomment également de la mémoire en permanence.<br/><br/>
            Avec {ramWarning.totalGb} Go au total, il ne reste pas assez de RAM pour faire tourner le jeu correctement — vous risquez des <strong style={{color:'#fbbf24'}}>crashs</strong> et des <strong style={{color:'#fbbf24'}}>freezes</strong>.
          </div>
          <div style={{ display:'flex', gap:'0.75rem', justifyContent:'center' }}>
            <button onClick={() => setRamWarning(null)} style={{
              background:'rgba(248,113,113,0.12)', border:'1px solid rgba(248,113,113,0.3)',
              borderRadius:'7px', color:'#f87171', fontFamily:'Cinzel, serif',
              fontWeight:700, padding:'0.55rem 1.4rem', cursor:'pointer', fontSize:'0.8rem',
            }}>
              Continuer quand même
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}