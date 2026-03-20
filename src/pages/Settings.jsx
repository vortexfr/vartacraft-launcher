import { useState, useEffect, useRef } from 'react';
import './Settings.css';

export default function Settings({ onBack }) {
  const [profiles, setProfiles] = useState([]);
  const [selected, setSelected] = useState('');
  const [ram,      setRam]      = useState(4);
  const [newName,  setNewName]  = useState('');
  const [saveMsg,  setSaveMsg]  = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    window.launcher?.getProfiles()
      .then(data => {
        setProfiles(data?.profiles || []);
        setSelected(data?.selected || '');
      })
      .catch(() => {});
    const savedRam = Number(localStorage.getItem('vc_ram')) || 4;
    setRam(Math.max(4, savedRam));
  }, []);

  const persist = async (updatedProfiles, updatedSelected, updatedRam) => {
    const pList = updatedProfiles ?? profiles;
    const sel   = updatedSelected ?? selected;
    const r     = updatedRam ?? ram;
    localStorage.setItem('vc_ram', r);
    await window.launcher?.saveProfiles({ profiles: pList, selected: sel });
    setSaveMsg('Sauvegardé !');
    setTimeout(() => setSaveMsg(''), 2000);
  };

  const addProfile = async () => {
    const name = newName.trim();
    if (!name || profiles.find(p => p.name === name)) return;
    const updated = [...profiles, { name }];
    const newSel  = selected || name;
    setProfiles(updated);
    setSelected(newSel);
    setNewName('');
    await persist(updated, newSel, null);
  };

  const deleteProfile = async (name) => {
    const updated = profiles.filter(p => p.name !== name);
    const newSel  = selected === name ? (updated[0]?.name || '') : selected;
    setProfiles(updated);
    setSelected(newSel);
    await persist(updated, newSel, null);
  };

  const selectProfile = async (name) => {
    setSelected(name);
    await persist(null, name, null);
  };

  const handleRamUp = (value) => {
    persist(null, null, value);
  };

  return (
    <div className="settings">
      <div className="titlebar">
        <button className="tb-back" onClick={onBack}>← Retour</button>
        <span className="titlebar-title">VARTACRAFT LAUNCHER</span>
        <div className="titlebar-controls">
          <button className="tb-btn"          onClick={() => window.launcher?.minimize()}>─</button>
          <button className="tb-btn tb-close" onClick={() => window.launcher?.close()}>✕</button>
        </div>
      </div>

      <div className="settings-body">
        <h1 className="settings-title">Paramètres</h1>

        {/* RAM */}
        <section className="settings-section">
          <h2 className="settings-section-title">Mémoire RAM</h2>
          <p className="settings-desc">RAM allouée à Minecraft (minimum 4 Go)</p>
          <div className="ram-row">
            <input
              type="range"
              className="ram-slider"
              min={4} max={16} step={1}
              value={ram}
              onChange={e => setRam(Number(e.target.value))}
              onMouseUp={e => handleRamUp(Number(e.target.value))}
              onTouchEnd={e => handleRamUp(Number(e.target.value))}
            />
            <span className="ram-value">{ram} Go</span>
          </div>
          <p className="ram-hint">4 Go minimum recommandé pour Forge 1.20.1</p>
        </section>

        {/* Profiles */}
        <section className="settings-section">
          <h2 className="settings-section-title">Profils</h2>
          <p className="settings-desc">Gérez vos pseudos Minecraft</p>

          <div className="profile-list">
            {profiles.length === 0 && (
              <div className="profile-empty-msg">Aucun profil créé</div>
            )}
            {profiles.map(p => (
              <div key={p.name} className={`profile-item ${selected === p.name ? 'active' : ''}`}>
                <button className="profile-select-btn" onClick={() => selectProfile(p.name)}>
                  <span className="profile-radio">{selected === p.name ? '◉' : '○'}</span>
                  <span className="profile-item-name">{p.name}</span>
                </button>
                <button className="profile-delete" onClick={() => deleteProfile(p.name)} title="Supprimer">✕</button>
              </div>
            ))}
          </div>

          <div className="profile-add">
            <input
              ref={inputRef}
              className="profile-input"
              type="text"
              placeholder="Nouveau pseudo..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addProfile()}
              maxLength={16}
            />
            <button className="profile-add-btn" onClick={addProfile}>Ajouter</button>
          </div>
        </section>

        {saveMsg && <div className="settings-saved">{saveMsg}</div>}
      </div>
    </div>
  );
}