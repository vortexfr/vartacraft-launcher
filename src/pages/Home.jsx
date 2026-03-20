import { useState, useEffect } from 'react';
import backgroundImg from '../assets/background.png';
import bannerImg from '../assets/banner.png';
import './Home.css';

export default function Home({ onNav }) {
  const [profiles,     setProfiles]     = useState([]);
  const [selected,     setSelected]     = useState('');
  const [ram,          setRam]          = useState(4);
  const [status,       setStatus]       = useState('');
  const [progress,     setProgress]     = useState(0);
  const [launching,    setLaunching]    = useState(false);
  const [error,        setError]        = useState('');
  const [server,       setServer]       = useState(undefined); // undefined=loading, null=error, object=result
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    // Load profiles
    window.launcher?.getProfiles()
      .then(data => {
        setProfiles(data?.profiles || []);
        setSelected(data?.selected || '');
      })
      .catch(() => {});

    // Load RAM
    const savedRam = Number(localStorage.getItem('vc_ram')) || 4;
    setRam(Math.max(4, savedRam));

    // Ping server
    window.launcher?.pingServer()
      .then(res => setServer(res ?? null))
      .catch(() => setServer(null));

    // Game events
    window.launcher?.onGameClosed(() => {
      setLaunching(false);
      setStatus('');
      setProgress(0);
    });
    window.launcher?.onInstallStatus(({ text, pct }) => {
      setStatus(text);
      setProgress(pct ?? 0);
    });
  }, []);

  const handleLaunch = async () => {
    if (!selected.trim() || launching) return;
    setError('');
    setLaunching(true);
    setProgress(0);
    setStatus('Lancement...');
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

  return (
    <div className="home" onClick={() => setShowDropdown(false)}>
      <img className="home-bg" src={backgroundImg} alt="" />
      <div className="home-overlay" />

      {/* Titlebar */}
      <div className="titlebar">
        <div style={{ flex: 1 }} />
        <span className="titlebar-title">VARTACRAFT LAUNCHER</span>
        <div className="titlebar-controls">
          <button className="tb-btn"          onClick={() => window.launcher?.minimize()}>─</button>
          <button className="tb-btn tb-close" onClick={() => window.launcher?.close()}>✕</button>
        </div>
      </div>

      {/* Body */}
      <div className="home-body">
        {/* Banner */}
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

        {/* Panel */}
        <div className="home-panel" onClick={e => e.stopPropagation()}>
          {/* Warning */}
          <div className="home-warning">
            ⚠ Utilisez le même pseudo que sur le site pour le système de vote et boutique
          </div>

          {/* Profile selector */}
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

          {/* Errors */}
          {!selected && !error && (
            <p className="home-notice">Aucun profil sélectionné — créez-en un dans Paramètres</p>
          )}
          {error && <p className="home-error">{error}</p>}

          {/* Progress */}
          {launching && (
            <div className="home-progress-wrap">
              <div className="home-progress-bar">
                <div className="home-progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <p className="home-progress-text">{status}</p>
            </div>
          )}

          {/* Play */}
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

        {/* Nav */}
        <div className="home-nav">
          <button className="nav-btn" onClick={() => onNav('settings')}>
            <span className="nav-icon">⚙</span>Paramètres
          </button>
          <button className="nav-btn" onClick={() => onNav('credits')}>
            <span className="nav-icon">★</span>Crédits
          </button>
          <button className="nav-btn" onClick={() => onNav('mentions')}>
            <span className="nav-icon">§</span>Mentions
          </button>
          <button className="nav-btn" onClick={() => window.launcher?.openGameDir()}>
            <span className="nav-icon">▤</span>Dossier
          </button>
        </div>

        <div className="home-footer">Forge 1.20.1 — 47.4.13 &nbsp;·&nbsp; {ram} Go RAM</div>
      </div>
    </div>
  );
}