import './CrashReport.css';

function isCorruptionError(content) {
  if (!content) return false;
  const lower = content.toLowerCase();
  return (
    lower.includes('corrupt') ||
    lower.includes('invalid or corrupt') ||
    lower.includes('vartacraftgame') ||
    lower.includes('zip file is empty') ||
    lower.includes('zip end header not found')
  );
}

export default function CrashReport({ data, onBack }) {
  const handleCopy = () => {
    navigator.clipboard?.writeText(data?.content || '');
  };

  const corrupted = isCorruptionError(data?.content);

  return (
    <div className="crash">
      <div className="titlebar">
        <div style={{ flex: 1 }} />
        <span className="titlebar-title">VARTACRAFT LAUNCHER</span>
        <div className="titlebar-controls">
          <button className="tb-btn"          onClick={() => window.launcher?.minimize()}><svg width="10" height="2" viewBox="0 0 10 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="0" y1="1" x2="10" y2="1"/></svg></button>
          <button className="tb-btn tb-close" onClick={() => window.launcher?.close()}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg></button>
        </div>
      </div>

      <div className="crash-header">
        <span className="crash-icon">⚠</span>
        <div>
          <h2 className="crash-title">Minecraft a planté</h2>
          <p className="crash-file">{data?.file || 'crash-report.txt'}</p>
        </div>
      </div>

      {corrupted && (
        <div className="crash-corruption">
          <strong>Fichiers corrompus détectés</strong>
          <p>
            Supprimez le dossier <code>.VartacraftGame</code> dans{' '}
            <code>%APPDATA%</code>, puis relancez le launcher pour réinstaller le jeu proprement.
          </p>
        </div>
      )}

      <div className="crash-content">
        <pre className="crash-pre">{data?.content || 'Aucun rapport disponible.'}</pre>
      </div>

      <div className="crash-actions">
        <button className="crash-btn secondary" onClick={handleCopy}>
          Copier le rapport
        </button>
        <button className="crash-btn secondary" onClick={() => window.launcher?.openGameDir()}>
          Ouvrir le dossier
        </button>
        <button className="crash-btn primary" onClick={onBack}>
          Retour au launcher
        </button>
      </div>
    </div>
  );
}