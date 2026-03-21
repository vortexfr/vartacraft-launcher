import { useState, useEffect } from 'react';
import './Screenshots.css';

export default function Screenshots({ onBack }) {
  const [images, setImages] = useState(null); // null = loading
  const [lightbox, setLightbox] = useState(null); // { src, name }
  const [loadedB64, setLoadedB64] = useState({}); // path -> b64

  useEffect(() => {
    window.launcher?.getScreenshots()
      .then(list => setImages(list || []))
      .catch(() => setImages([]));
  }, []);

  // Load thumbnails progressively
  useEffect(() => {
    if (!images?.length) return;
    images.forEach(async (img) => {
      if (loadedB64[img.path]) return;
      const b64 = await window.launcher?.readImageB64({ filePath: img.path });
      if (b64) setLoadedB64(prev => ({ ...prev, [img.path]: b64 }));
    });
  }, [images]);

  const openLightbox = (img) => {
    if (loadedB64[img.path]) setLightbox({ src: loadedB64[img.path], name: img.name, path: img.path });
    else window.launcher?.openScreenshot(img.path);
  };

  return (
    <div className="screenshots">
      <div className="titlebar">
        <button className="tb-back" onClick={onBack}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Retour</button>
        <span className="titlebar-title">VARTACRAFT LAUNCHER</span>
        <div className="titlebar-controls">
          <button className="tb-btn"          onClick={() => window.launcher?.minimize()}><svg width="10" height="2" viewBox="0 0 10 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="0" y1="1" x2="10" y2="1"/></svg></button>
          <button className="tb-btn tb-close" onClick={() => window.launcher?.close()}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg></button>
        </div>
      </div>

      <div className="sc-body">
        <div className="sc-header">
          <h1 className="sc-title">Captures d'écran</h1>
          <div className="sc-header-actions">
            {images !== null && <span className="sc-count">{images.length} capture{images.length !== 1 ? 's' : ''}</span>}
            <button className="sc-folder-btn" onClick={() => window.launcher?.openScreenshotsFolder()}>
              Ouvrir le dossier
            </button>
          </div>
        </div>

        {images === null ? (
          <div className="sc-empty">Chargement...</div>
        ) : images.length === 0 ? (
          <div className="sc-empty">
            Aucune capture trouvée.<br />
            <span>Appuyez sur F2 en jeu pour prendre une capture.</span>
          </div>
        ) : (
          <div className="sc-grid">
            {images.map(img => (
              <div
                key={img.path}
                className="sc-card"
                onClick={() => openLightbox(img)}
                title={img.name}
              >
                {loadedB64[img.path] ? (
                  <img className="sc-thumb" src={loadedB64[img.path]} alt={img.name} />
                ) : (
                  <div className="sc-thumb-placeholder" />
                )}
                <div className="sc-name">{img.name.replace(/\.(png|jpg|jpeg)$/i, '')}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="sc-lightbox" onClick={() => setLightbox(null)}>
          <div className="sc-lightbox-inner" onClick={e => e.stopPropagation()}>
            <img src={lightbox.src} alt={lightbox.name} className="sc-lightbox-img" />
            <div className="sc-lightbox-bar">
              <span className="sc-lightbox-name">{lightbox.name}</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="sc-lightbox-btn" onClick={() => window.launcher?.openScreenshot(lightbox.path)}>
                  Ouvrir
                </button>
                <button className="sc-lightbox-btn sc-lightbox-close" onClick={() => setLightbox(null)}>✕</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}