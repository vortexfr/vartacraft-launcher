import './Mentions.css';

export default function Mentions({ onBack }) {
  const openSupport = () =>
    window.launcher?.openUrl('https://vartacraft.fr/support/tickets/create');

  return (
    <div className="mentions">
      <div className="titlebar">
        <button className="tb-back" onClick={onBack}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Retour</button>
        <span className="titlebar-title">VARTACRAFT LAUNCHER</span>
        <div className="titlebar-controls">
          <button className="tb-btn" onClick={() => window.launcher?.minimize()}><svg width="10" height="2" viewBox="0 0 10 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="0" y1="1" x2="10" y2="1"/></svg></button>
          <button className="tb-btn tb-close" onClick={() => window.launcher?.close()}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg></button>
        </div>
      </div>

      <div className="mentions-body">
        <div className="mentions-header">
          <h1 className="mentions-title">Mentions Légales & CGU</h1>
          <p className="mentions-date">En vigueur au 1er janvier 2025</p>
        </div>

        <div className="mentions-section">
          <h2>1. Éditeur</h2>
          <p>
            Ce launcher est un logiciel privé développé et édité par l'équipe{' '}
            <strong>Vartacraft</strong> pour les besoins exclusifs du serveur Minecraft Vartacraft.
          </p>
        </div>

        <div className="mentions-section">
          <h2>2. Propriété intellectuelle</h2>
          <p>
            Minecraft® est une marque déposée de{' '}
            <strong>Mojang Studios / Microsoft Corporation</strong>. Ce launcher n'est pas
            affilié à Mojang Studios ou Microsoft.
          </p>
          <p>
            Le code source, les assets graphiques et l'ensemble du contenu de ce launcher sont
            la propriété de l'équipe Vartacraft. Toute reproduction ou redistribution non
            autorisée est strictement interdite.
          </p>
        </div>

        <div className="mentions-section">
          <h2>3. Conditions d'utilisation</h2>
          <p>
            Ce launcher est destiné exclusivement aux joueurs du serveur Vartacraft.
            Son utilisation implique l'acceptation des présentes conditions.
          </p>
          <p>
            Vous vous engagez à utiliser votre pseudo Minecraft officiel et à ne pas tenter
            de contourner les systèmes d'authentification ou de protection du serveur.
          </p>
        </div>

        <div className="mentions-section">
          <h2>4. Données personnelles</h2>
          <p>
            Ce launcher stocke <strong>localement</strong> votre pseudo et vos paramètres
            (RAM allouée, profils). Aucune donnée personnelle n'est transmise à des tiers
            sans votre consentement explicite.
          </p>
        </div>

        <div className="mentions-section">
          <h2>5. Limitation de responsabilité</h2>
          <p>
            L'équipe Vartacraft ne saurait être tenue responsable de tout dommage direct ou
            indirect résultant de l'utilisation de ce launcher. L'utilisation se fait sous
            l'entière responsabilité de l'utilisateur.
          </p>
        </div>

        <div className="mentions-section">
          <h2>6. Contact & Support</h2>
          <p>
            Pour toute question ou problème, ouvrez un ticket sur{' '}
            <span className="mentions-link" onClick={openSupport}>
              vartacraft.fr/support
            </span>.
          </p>
        </div>
      </div>
    </div>
  );
}