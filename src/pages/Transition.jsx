import { useState, useEffect } from 'react';
import backgroundImg from '../assets/background.png';
import bannerImg from '../assets/banner.png';
import './Transition.css';

export default function Transition({ onDone }) {
  const [username, setUsername] = useState('');
  const [phase, setPhase] = useState('loading'); 

  useEffect(() => {
    window.launcher?.getAuth()
      .then(auth => setUsername(auth?.pseudo || ''))
      .catch(() => {});

    const t1 = setTimeout(() => setPhase('welcome'), 1400);
    const t2 = setTimeout(onDone, 4200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div className="transition-page">
      <img className="transition-bg" src={backgroundImg} alt="" />
      <div className="transition-overlay" />

      <div className="transition-center">
        {phase === 'loading' ? (
          <div className="transition-loading" key="loading">
            <span>Chargement</span>
            <span className="tr-dots"><span /><span /><span /></span>
          </div>
        ) : (
          <div className="transition-welcome" key="welcome">
            <img className="transition-banner" src={bannerImg} alt="Vartacraft" />
            <div className="transition-greeting">Bienvenue</div>
            {username && (
              <div className="transition-username">{username}</div>
            )}
            <div className="transition-sub">sur Vartacraft</div>
          </div>
        )}
      </div>
    </div>
  );
}