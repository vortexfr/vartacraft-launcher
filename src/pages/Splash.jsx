import { useEffect, useState } from 'react';
import backgroundImg from '../assets/background.png';
import bannerImg from '../assets/banner.png';
import argentSaleImg from '../assets/argent_sale.png';
import cannabisImg from '../assets/cannabis.png';
import silithiumImg from '../assets/silithium.png';
import './Splash.css';

const ICON_MOON     = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
const ICON_CITY     = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const ICON_COLUMNS  = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="3" x2="3" y2="21"/><line x1="21" y1="3" x2="21" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>;
const ICON_USERS    = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const ICON_TRENDING = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
const ICON_SWORDS   = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/></svg>;
const ICON_VOTE     = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
const ICON_ZAP      = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
const ICON_CROWN    = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><line x1="5" y1="20" x2="19" y2="20"/></svg>;
const ICON_CALENDAR = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const ICON_PICKAXE  = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>;
const ICON_SHIELD   = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;

const TIPS = [
  { img: argentSaleImg,  text: 'Le marché noir vous permet de faire des deals discrets avec d\'autres joueurs — risqué, mais très lucratif.' },
  { img: cannabisImg,    text: 'Cultivez du cannabis dans votre empire et revendez-le pour générer des revenus rapides dès le début.' },
  { img: silithiumImg,   text: 'Le Silithium est le minerai légendaire de Vartacraft — seuls les artisans expérimentés peuvent l\'exploiter.' },
  { icon: ICON_MOON,     text: 'Accédez à la lune avec /warp moon — une combinaison spatiale est obligatoire pour survivre dans le vide.' },
  { icon: ICON_CITY,     text: 'Construisez votre ville et développez son économie pour attirer des habitants et des marchands.' },
  { icon: ICON_COLUMNS,  text: 'Plus votre ville est développée, plus vous débloquez de fonctionnalités et de bâtiments spéciaux.' },
  { icon: ICON_USERS,    text: 'Formez des alliances commerciales avec d\'autres joueurs pour dominer l\'économie du serveur.' },
  { icon: ICON_TRENDING, text: 'Surveillez les prix du marché et achetez au bon moment pour maximiser vos profits.' },
  { icon: ICON_SWORDS,   text: 'Protégez vos ressources et vos territoires — d\'autres empires pourraient convoiter votre richesse.' },
  { icon: ICON_VOTE,     text: 'Votez chaque jour sur le site pour gagner des récompenses exclusives et soutenir le serveur.' },
  { icon: ICON_ZAP,      text: 'Utilisez le même pseudo que sur le site pour accéder au système de vote et à la boutique.' },
  { icon: ICON_CROWN,    text: 'N\'oubliez pas de créer votre empire dès votre arrivée — tapez /empire create pour commencer votre conquête.' },
  { icon: ICON_CALENDAR, text: 'Des événements ont lieu chaque jour sur le serveur — consultez l\'agenda pour ne rien manquer.' },
  { icon: ICON_PICKAXE,  text: 'Progressez dans les métiers Mineur, Fermier, Forgeron, Bucheron et Chasseur — maîtrisez-les tous pour débloquer le légendaire Silithium.' },
  { icon: ICON_SHIELD,   text: 'Vartacraft utilise ArianeGuard, notre anticheat maison — votre confort de jeu est notre priorité.' },
];

const DURATION = 15000;
const TIP_INTERVAL = 4500;

function randomOther(current, max) {
  let next;
  do { next = Math.floor(Math.random() * max); } while (next === current);
  return next;
}

export default function Splash({ onDone }) {
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * TIPS.length));
  const [tipVisible, setTipVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let nav, pFrame;

    const tipTimer = setInterval(() => {
      setTipVisible(false);
      setTimeout(() => {
        setTipIndex(i => randomOther(i, TIPS.length));
        setTipVisible(true);
      }, 400);
    }, TIP_INTERVAL);

    const start = Date.now();
    pFrame = setInterval(() => {
      const p = Math.min(100, ((Date.now() - start) / DURATION) * 100);
      setProgress(p);
      if (p >= 100) clearInterval(pFrame);
    }, 50);
    nav = setTimeout(onDone, DURATION);

    return () => {
      clearTimeout(nav);
      clearInterval(pFrame);
      clearInterval(tipTimer);
    };
  }, [onDone]);

  const tip = TIPS[tipIndex];

  return (
    <div className="splash">
      <img className="splash-bg-img" src={backgroundImg} alt="" />
      <div className="splash-overlay" />

      {/* Center */}
      <div className="splash-center">
        <img className="splash-banner" src={bannerImg} alt="Vartacraft" />

        <div className="splash-dots">
          <span /><span /><span />
        </div>
      </div>

      {/* Tip */}
      <div className={`splash-tip-wrap ${tipVisible ? 'visible' : ''}`}>
        {tip.img
          ? <img src={tip.img} className="splash-tip-img" alt="" />
          : <span className="splash-tip-icon">{tip.icon}</span>
        }
        <p className="splash-tip-text">{tip.text}</p>
      </div>

      {/* Bottom */}
      <div className="splash-bottom">
        <div className="splash-progress-track">
          <div className="splash-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="splash-loading-text">Chargement en cours, veuillez patienter…</p>
        <p className="splash-version">Forge 1.20.1 — 47.4.13</p>
      </div>
    </div>
  );
}