import { useState } from 'react';
import backgroundImg from '../assets/background.png';
import bannerImg from '../assets/banner.png';
import './Welcome.css';

export default function Login({ onDone }) {
  const [pseudo,   setPseudo]   = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async () => {
    const p = pseudo.trim();
    if (!p || !password) { setError('Remplis tous les champs.'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await window.launcher?.login(p, password);
      if (result?.success) {
        onDone();
      } else {
        setError(result?.error || 'Identifiants incorrects.');
      }
    } catch (_) {
      setError('Impossible de contacter le serveur.');
    }
    setLoading(false);
  };

  return (
    <div className="welcome">
      <img className="welcome-bg-img" src={backgroundImg} alt="" />
      <div className="welcome-overlay" />

      <div className="titlebar">
        <div style={{ flex: 1 }} />
        <span className="titlebar-title">VARTACRAFT LAUNCHER</span>
        <div className="titlebar-controls">
          <button className="tb-btn" onClick={() => window.launcher?.minimize()}><svg width="10" height="2" viewBox="0 0 10 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="0" y1="1" x2="10" y2="1"/></svg></button>
          <button className="tb-btn tb-close" onClick={() => window.launcher?.close()}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg></button>
        </div>
      </div>

      <div className="welcome-body">
        <img className="welcome-banner" src={bannerImg} alt="Vartacraft" />

        <div className="welcome-card">
          <h1 className="welcome-title">Connexion</h1>
          <p className="welcome-desc">Connecte-toi avec ton compte <strong>vartacraft.fr</strong></p>

          <input
            className="welcome-input"
            type="text"
            placeholder="Pseudo..."
            value={pseudo}
            onChange={e => { setPseudo(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            maxLength={30}
            autoFocus
          />

          <div style={{ position: 'relative', width: '100%' }}>
            <input
              className="welcome-input"
              type={showPass ? 'text' : 'password'}
              placeholder="Mot de passe..."
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{ paddingRight: '2.8rem' }}
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              style={{
                position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(221,213,196,0.45)', fontSize: '1rem', lineHeight: 1, padding: 0,
              }}
              tabIndex={-1}
            >
              {showPass ? '🙈' : '👁'}
            </button>
          </div>

          {error && <p className="welcome-error">{error}</p>}

          <button
            className="welcome-btn"
            onClick={handleLogin}
            disabled={loading || !pseudo.trim() || !password}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>

          <div className="welcome-tip">
            💡 Pas encore de compte ? Crée-en un sur{' '}
            <span
              style={{ color: '#c9972a', cursor: 'pointer' }}
              onClick={() => window.launcher?.openUrl('https://vartacraft.fr/register')}
            >
              vartacraft.fr
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
