import { useState } from 'react';
import backgroundImg from '../assets/background.png';
import bannerImg from '../assets/banner.png';
import './Welcome.css';

export default function Welcome({ onDone }) {
  const [name, setName]  = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const n = name.trim();
    if (!n) { 
      setError('Entre un pseudo valide');
      return; 
  }
    if (n.length > 16) { setError('16 caractères maximum'); return; }
    setSaving(true);
    const data = await window.launcher?.getProfiles().catch(() => null);
    const profiles = [...(data?.profiles || []), {
       name: n 
  }];
    await window.launcher?.saveProfiles({ profiles, selected: n });
    onDone();
  };

  return (
    <div className="welcome">
      <img className="welcome-bg-img" src={backgroundImg} alt="" />
      <div className="welcome-overlay" />

      <div className="titlebar">
        <div style={{ flex: 1 }} />
        <span className="titlebar-title">VARTACRAFT LAUNCHER</span>
        <div className="titlebar-controls">
          <button className="tb-btn"          onClick={() => window.launcher?.minimize()}><svg width="10" height="2" viewBox="0 0 10 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="0" y1="1" x2="10" y2="1"/></svg></button>
          <button className="tb-btn tb-close" onClick={() => window.launcher?.close()}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg></button>
        </div>
      </div>

      <div className="welcome-body">
        <img className="welcome-banner" src={bannerImg} alt="Vartacraft" />

        <div className="welcome-card">
          <h1 className="welcome-title">Bienvenue !</h1>
          <p className="welcome-desc">Entre ton pseudo Minecraft pour commencer à jouer.</p>

          <input
            className="welcome-input"
            type="text"
            placeholder="Ton pseudo Minecraft..."
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            maxLength={16}
            autoFocus
          />

          {error && <p className="welcome-error">{error}</p>}

          <button className="welcome-btn" onClick={handleSubmit} disabled={!name.trim() || saving}>
            {saving ? 'Sauvegarde...' : 'Commencer à jouer'}
          </button>

          <div className="welcome-tip">
            💡 Tu peux ajouter d'autres pseudos et les gérer à tout moment dans les <strong>Paramètres</strong>
          </div>
        </div>
      </div>
    </div>
  );
}