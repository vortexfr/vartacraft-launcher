import { useState, useEffect } from 'react';
import './Splash.css';

export default function Splash({ onDone }) {
  const [status, setStatus] = useState('Initialisation...');
  const [pct, setPct]       = useState(0);
  const [error, setError]   = useState('');
  const [ready, setReady]   = useState(false);

  useEffect(() => {
    if (!window.launcher) return;

    window.launcher.onInstallStatus(({ text, pct: p }) => {
      setStatus(text);
      setPct(p ?? 0);
    });

    window.launcher.startInstall().then(result => {
      if (result.success) {
        setReady(true);
        setTimeout(onDone, 900);
      } else {
        setError(result.error);
      }
    });
  }, [onDone]);

  return (
    <div className="splash">
      <div className="splash-bg" />

      <div className="splash-center">
        <div className="splash-logo">
          VARTA<span className="splash-accent">CRAFT</span>
        </div>
        <div className="splash-sub">E M P I R E &nbsp; F A C T I O N </div>

        <div className="splash-progress-wrap">
          <div className="splash-bar">
            <div
              className={`splash-fill ${ready ? 'done' : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className={`splash-status ${error ? 'err' : ''}`}>
            {error || status}
          </p>
          {error && (
            <p className="splash-support">
              Problème de connexion ?{' '}
              <span
                className="splash-link"
                onClick={() => window.launcher?.openUrl('https://vartacraft.fr/support/tickets/create')}
              >
                Ouvrir un ticket de support
              </span>
            </p>
          )}
        </div>
      </div>

      <p className="splash-version">Forge 1.20.1 — 47.4.13</p>
    </div>
  );
}