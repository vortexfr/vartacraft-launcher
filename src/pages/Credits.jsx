import './Credits.css';

const CREDITS = [
  {
    section: 'Équipe Vartacraft',
    items: [
      { role: 'Fondateur & Administrateur', name: 'Vartax / ZubergAdmin' },
    ],
  },
  {
    section: 'Développement',
    items: [
      { role: 'Launcher (Electron + React)', name: 'Vartacraft Team' },
      { role: 'Modpack & Configuration serveur', name: 'Vartacraft Team' },
    ],
  },
  {
    section: 'Technologies utilisées',
    items: [
      { role: 'Moteur de jeu', name: 'Minecraft Java Edition' },
      { role: 'Mod loader', name: 'Minecraft Forge 47.4.13' },
      { role: 'Framework launcher', name: 'Electron v29 + React 18' },
      { role: 'Interface', name: 'Vite + CSS (Cinzel / Inter)' },
    ],
  },
];

export default function Credits({ onBack }) {
  return (
    <div className="credits">
      <div className="titlebar">
        <button className="tb-back" onClick={onBack}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Retour</button>
        <span className="titlebar-title">VARTACRAFT LAUNCHER</span>
        <div className="titlebar-controls">
          <button className="tb-btn" onClick={() => window.launcher?.minimize()}><svg width="10" height="2" viewBox="0 0 10 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="0" y1="1" x2="10" y2="1"/></svg></button>
          <button className="tb-btn tb-close" onClick={() => window.launcher?.close()}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg></button>
        </div>
      </div>

      <div className="credits-body">
        <div className="credits-header">
          <h1 className="credits-title">Crédits</h1>
          <p className="credits-sub">L'équipe derrière Vartacraft</p>
        </div>

        <div className="credits-divider" />

        {CREDITS.map(({ section, items }) => (
          <div className="credits-section" key={section}>
            <h2 className="credits-section-title">{section}</h2>
            <div className="credits-list">
              {items.map(({ role, name }) => (
                <div className="credit-card" key={name}>
                  <span className="credit-role">{role}</span>
                  <span className="credit-name">{name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="credits-divider" />

        <p className="credits-thanks">
          Merci à tous les joueurs de la communauté Vartacraft !
        </p>
      </div>
    </div>
  );
}