import {
   useState,
   useEffect,
   useRef 
} from 'react';
import './Settings.css';

export default function Settings({ onBack }) {
  const [profiles, setProfiles] = useState([]);
  const [selected, setSelected] = useState('');
  const [ram, setRam] = useState(4);
  const [newName, setNewName] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [devConsole, setDevConsole] = useState(() => localStorage.getItem('vc_devconsole') === '1');
  const [autoMinimize, setAutoMinimize] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [jdkInfo, setJdkInfo] = useState(null);
  const [jdkWarning, setJdkWarning] = useState(false);
  const [jdkResetting, setJdkResetting] = useState(false);
  const [jdkChoosing, setJdkChoosing]  = useState(false);
  const [jdkError, setJdkError] = useState('');
  const [repairWarning, setRepairWarning] = useState(false);
  const [repairing, setRepairing] = useState(false);
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
    window.launcher?.getJdkInfo()
      .then(setJdkInfo)
      .catch(() => setJdkInfo({ installed: false }));

    window.launcher?.getLauncherConfig()
      .then(cfg => {
        setAutoMinimize(cfg?.autoMinimize !== false);
        setFullscreen(cfg?.fullscreen === true);
      })
      .catch(() => {});
  }, []);

  const persist = async (updatedProfiles, updatedSelected, updatedRam) => {
    const pList = updatedProfiles ?? profiles;
    const sel = updatedSelected ?? selected;
    const r = updatedRam ?? ram;
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

  const handleRamUp = (value) => { persist(null, null, value); };

  const toggleDevConsole = () => {
    const next = !devConsole;
    setDevConsole(next);
    localStorage.setItem('vc_devconsole', next ? '1' : '0');
  };

  const toggleAutoMinimize = async () => {
    const next = !autoMinimize;
    setAutoMinimize(next);
    await window.launcher?.updateLauncherConfig({ autoMinimize: next }).catch(() => {});
  };

  const toggleFullscreen = async () => {
    const next = !fullscreen;
    setFullscreen(next);
    await window.launcher?.updateLauncherConfig({ fullscreen: next }).catch(() => {});
  };

  const handleResetJdk = async () => {
    setJdkWarning(false);
    setJdkResetting(true);
    const result = await window.launcher?.resetJdk().catch(() => ({ success: false }));
    setJdkResetting(false);
    if (result?.success) {
      setJdkInfo({ installed: false });
      setSaveMsg('JDK réinitialisé — Java 17 sera retéléchargé au prochain lancement');
    } else {
      setSaveMsg('Erreur lors de la réinitialisation');
    }
    setTimeout(() => setSaveMsg(''), 3500);
  };

  const handleChooseJdk = async () => {
    setJdkError('');
    setJdkChoosing(true);
    const result = await window.launcher?.chooseJdk().catch(() => ({ error: 'Erreur inconnue' }));
    setJdkChoosing(false);
    if (result?.canceled) return;
    if (result?.error) {
       setJdkError(result.error); 
       return; 
    }
    const info = await window.launcher?.getJdkInfo().catch(() => null);
    if (info) setJdkInfo(info);
    setSaveMsg('JDK personnalisé appliqué');
    setTimeout(() => setSaveMsg(''), 2500);
  };

  const handleRepair = async () => {
    setRepairWarning(false);
    setRepairing(true);
    const result = await window.launcher?.repairInstall().catch(() => ({ success: false, error: 'Erreur inconnue' }));
    setRepairing(false);
    if (result?.success) {
      setSaveMsg('✔ Installation réparée — les fichiers seront retéléchargés au prochain lancement');
    } else {
      setSaveMsg('⚠ Erreur : ' + (result?.error || 'Échec de la réparation'));
    }
    setTimeout(() => setSaveMsg(''), 4000);
  };

  const handleClearJdkPath = async () => {
    await window.launcher?.clearJdkPath().catch(() => {});
    const info = await window.launcher?.getJdkInfo().catch(() => null);
    if (info) setJdkInfo(info);
    setSaveMsg('JDK intégré rétabli');
    setTimeout(() => setSaveMsg(''), 2500);
  };

  return (
    <div className="settings">
      <div className="titlebar">
        <button className="tb-back" onClick={onBack}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Retour</button>
        <span className="titlebar-title">VARTACRAFT LAUNCHER</span>
        <div className="titlebar-controls">
          <button className="tb-btn"onClick={() => window.launcher?.minimize()}><svg width="10" height="2" viewBox="0 0 10 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="0" y1="1" x2="10" y2="1"/></svg></button>
          <button className="tb-btn tb-close" onClick={() => window.launcher?.close()}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg></button>
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

        {/* Developer */}
        <section className="settings-section">
          <h2 className="settings-section-title">Développeur</h2>
          <p className="settings-desc">Outils de débogage</p>
          <div className="toggle-row">
            <div>
              <div className="toggle-label">Plein écran</div>
              <div className="toggle-hint">Lance Minecraft en plein écran</div>
            </div>
            <button className={`toggle-btn ${fullscreen ? 'on' : ''}`} onClick={toggleFullscreen}>
              <span className="toggle-thumb" />
            </button>
          </div>
          <div className="toggle-row">
            <div>
              <div className="toggle-label">Minimiser au lancement</div>
              <div className="toggle-hint">Cache le launcher quand le jeu démarre</div>
            </div>
            <button className={`toggle-btn ${autoMinimize ? 'on' : ''}`} onClick={toggleAutoMinimize}>
              <span className="toggle-thumb" />
            </button>
          </div>
          <div className="toggle-row">
            <div>
              <div className="toggle-label">Console de développement</div>
              <div className="toggle-hint">Affiche les logs du jeux en page externe</div>
            </div>
            <button className={`toggle-btn ${devConsole ? 'on' : ''}`} onClick={toggleDevConsole}>
              <span className="toggle-thumb" />
            </button>
          </div>
        </section>

        {/* JDK */}
        <section className="settings-section">
          <h2 className="settings-section-title">Java (JDK 17)</h2>
          <p className="settings-desc">Version de Java utilisée pour lancer Minecraft</p>

          {jdkInfo === null ? (
            <p className="settings-desc">Chargement...</p>
          ) : jdkInfo.installed ? (
            <div className="jdk-info">
              <div className="jdk-info-row">
                <span className={`jdk-badge ${jdkInfo.custom ? 'custom' : ''}`}>
                  {jdkInfo.custom ? 'Personnalisé' : 'Intégré'}
                </span>
                <span className="jdk-version">{jdkInfo.version}</span>
              </div>
              <span className="jdk-path">{jdkInfo.path}</span>
            </div>
          ) : (
            <p className="settings-desc jdk-absent">Aucun JDK installé — sera téléchargé automatiquement au prochain lancement</p>
          )}

          {jdkError && <p className="jdk-error">{jdkError}</p>}

          <div className="jdk-actions">
            <button className="jdk-choose-btn" onClick={handleChooseJdk} disabled={jdkChoosing}>
              {jdkChoosing ? 'Sélection...' : '📂 Choisir un dossier JDK'}
            </button>
            {jdkInfo?.custom && (
              <button className="jdk-cancel-btn" onClick={handleClearJdkPath}>
                Utiliser le JDK intégré
              </button>
            )}
          </div>

          {!jdkInfo?.custom && (
            !jdkWarning ? (
              <button className="jdk-reset-btn" onClick={() => setJdkWarning(true)} disabled={jdkResetting}>
                {jdkResetting ? 'Réinitialisation...' : 'Réinitialiser le JDK intégré'}
              </button>
            ) : (
              <div className="jdk-warning-box">
                <p className="jdk-warning-text">
                  ⚠ Cette action va supprimer le dossier runtime. Java 17 sera retéléchargé automatiquement au prochain lancement du jeu.
                </p>
                <div className="jdk-warning-actions">
                  <button className="jdk-confirm-btn" onClick={handleResetJdk}>Confirmer</button>
                  <button className="jdk-cancel-btn" onClick={() => setJdkWarning(false)}>Annuler</button>
                </div>
              </div>
            )
          )}
        </section>
        {/* Repair */}
        <section className="settings-section">
          <h2 className="settings-section-title">Réparation</h2>
          <p className="settings-desc">Supprime et retélécharge les fichiers du jeu corrompus ou manquants.</p>
          <p className="settings-desc" style={{ color: 'rgba(201,151,42,0.5)', fontSize: '0.66rem' }}>
            Conservés : profils, JDK, captures d'écran, resource packs, shaders.
          </p>
          {!repairWarning ? (
            <button className="jdk-reset-btn" onClick={() => setRepairWarning(true)} disabled={repairing}>
              {repairing ? 'Réparation en cours...' : '🔧 Réparer l\'installation'}
            </button>
          ) : (
            <div className="jdk-warning-box">
              <p className="jdk-warning-text">
                ⚠ Tous les fichiers du jeu seront supprimés. Vos profils, JDK et packs sont conservés. Les fichiers seront retéléchargés au prochain lancement.
              </p>
              <div className="jdk-warning-actions">
                <button className="jdk-confirm-btn" onClick={handleRepair}>Confirmer</button>
                <button className="jdk-cancel-btn" onClick={() => setRepairWarning(false)}>Annuler</button>
              </div>
            </div>
          )}
        </section>

        {/* Game folder */}
        <section className="settings-section">
          <h2 className="settings-section-title">Dossier du jeu</h2>
          <p className="settings-desc">Accédez aux fichiers de l'installation Vartacraft</p>
          <button className="jdk-choose-btn" onClick={() => window.launcher?.openGameDir()}>
            📂 Ouvrir le dossier du jeu
          </button>
        </section>

        {saveMsg && <div className="settings-saved">{saveMsg}</div>}
      </div>
    </div>
  );
}