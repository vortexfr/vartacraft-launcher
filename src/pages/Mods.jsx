import { useState, useEffect } from 'react';
import './Mods.css';

export default function Mods({ onBack }) {
  const [tab, setTab] = useState('resourcepack');
  const [packs, setPacks] = useState(null); // null = loading
  const [toggling, setToggling] = useState({}); // filename -> bool
  const [error, setError] = useState('');

  const load = async (type) => {
    setPacks(null);
    setError('');
    try {
      const res = await window.launcher?.getPacks({ type }) || { official: [], userFiles: [] };
      setPacks(res);
    } catch (e) {
      setError(e.message);
      setPacks({ official: [], userFiles: [] });
    }
  };

  useEffect(() => { load(tab); }, [tab]);

  const handleToggle = async (pack) => {
    if (toggling[pack.filename]) return;
    setToggling(t => ({ ...t, [pack.filename]: true }));
    const res = await window.launcher?.togglePack({ type: tab, pack });
    if (res?.error) {
      setError(res.error);
    } else {
      setPacks(p => ({
        ...p,
        official: p.official.map(o =>
          o.filename === pack.filename ? { ...o, installed: res.installed } : o
        ),
      }));
    }
    setToggling(t => ({ ...t, [pack.filename]: false }));
  };

  const handleDelete = async (filename) => {
    await window.launcher?.deletePack({ type: tab, filename });
    setPacks(p => ({ ...p, userFiles: p.userFiles.filter(f => f !== filename) }));
  };

  const handleImport = async () => {
    const res = await window.launcher?.importPack({ type: tab });
    if (res?.success) load(tab);
  };

  const typeLabel = tab === 'shader' ? 'shader' : 'resource pack';

  return (
    <div className="mods">
      <div className="titlebar">
        <button className="tb-back" onClick={onBack}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Retour</button>
        <span className="titlebar-title">VARTACRAFT LAUNCHER</span>
        <div className="titlebar-controls">
          <button className="tb-btn"          onClick={() => window.launcher?.minimize()}><svg width="10" height="2" viewBox="0 0 10 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="0" y1="1" x2="10" y2="1"/></svg></button>
          <button className="tb-btn tb-close" onClick={() => window.launcher?.close()}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg></button>
        </div>
      </div>

      <div className="mods-body">
        <div className="mods-header">
          <h1 className="mods-title">Ressources</h1>
          <div className="mods-tabs">
            <button
              className={`mods-tab ${tab === 'resourcepack' ? 'active' : ''}`}
              onClick={() => setTab('resourcepack')}
            >
              🎨 Resource Packs
            </button>
            <button
              className={`mods-tab ${tab === 'shader' ? 'active' : ''}`}
              onClick={() => setTab('shader')}
            >
              ✨ Shaders
            </button>
          </div>
        </div>

        {error && <div className="mods-error">{error}</div>}

        {packs === null ? (
          <div className="mods-loading">Chargement...</div>
        ) : (
          <>
            {/* Official packs */}
            {packs.official.length > 0 && (
              <div className="mods-section">
                <div className="mods-section-label">Packs officiels</div>
                {packs.official.map(pack => (
                  <div key={pack.filename} className={`pack-row ${pack.installed ? 'installed' : ''}`}>
                    <div className="pack-info">
                      <div className="pack-name">{pack.name || pack.filename}</div>
                      {pack.description && <div className="pack-desc">{pack.description}</div>}
                    </div>
                    <button
                      className={`pack-toggle-btn ${pack.installed ? 'on' : ''}`}
                      onClick={() => handleToggle(pack)}
                      disabled={!!toggling[pack.filename]}
                    >
                      {toggling[pack.filename]
                        ? <span className="pack-spinner" />
                        : pack.installed ? 'Actif' : 'Inactif'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* User packs */}
            {packs.userFiles.length > 0 && (
              <div className="mods-section">
                <div className="mods-section-label">Vos packs</div>
                {packs.userFiles.map(f => (
                  <div key={f} className="pack-row installed">
                    <div className="pack-info">
                      <div className="pack-name">{f}</div>
                    </div>
                    <button className="pack-delete-btn" onClick={() => handleDelete(f)} title="Supprimer">🗑</button>
                  </div>
                ))}
              </div>
            )}

            {packs.official.length === 0 && packs.userFiles.length === 0 && (
              <div className="mods-empty">
                Aucun {typeLabel} disponible — importez le vôtre ci-dessous.
              </div>
            )}

            <div className="mods-actions">
              <button className="mods-import-btn" onClick={handleImport}>
                + Importer un {typeLabel}
              </button>
              <button className="mods-folder-btn" onClick={() => window.launcher?.openPackFolder({ type: tab })}>
                Ouvrir le dossier
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}