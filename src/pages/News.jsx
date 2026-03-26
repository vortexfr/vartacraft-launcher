import { useState, useEffect } from 'react';
import './News.css';

function renderText(text) {
  if (!text) return null;
  // Parse **bold** et *italic*
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**'))
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('*') && p.endsWith('*'))
      return <em key={i}>{p.slice(1, -1)}</em>;
    return p;
  });
}

export default function News({ onBack }) {
  const [news, setNews]       = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    window.launcher?.getNews()
      .then(result => setNews(result?.success ? result.data : []))
      .catch(() => setNews([]));
  }, []);

  const filtered = news || [];

  return (
    <div className="news">
      <div className="titlebar">
        <button className="tb-back" onClick={selected ? () => setSelected(null) : onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          {selected ? 'Retour aux news' : 'Retour'}
        </button>
        <span className="titlebar-title">VARTACRAFT LAUNCHER</span>
        <div className="titlebar-controls">
          <button className="tb-btn" onClick={() => window.launcher?.minimize()}><svg width="10" height="2" viewBox="0 0 10 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="0" y1="1" x2="10" y2="1"/></svg></button>
          <button className="tb-btn tb-close" onClick={() => window.launcher?.close()}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg></button>
        </div>
      </div>

      {/* Vue détail */}
      {selected ? (
        <div className="news-detail">
          <div className="news-detail-meta">
            {selected.author && <span className="news-author">par {selected.author}</span>}
            <span className="news-date">{selected.date}</span>
          </div>
          <h2 className="news-detail-title">{selected.title}</h2>
          <div className="news-detail-body">
            {(selected.body || '').split('\n').map((line, i) => (
              <p key={i} style={{ margin: line.trim() === '' ? '0.4rem 0' : '0 0 0.5rem' }}>
                {renderText(line)}
              </p>
            ))}
          </div>
        </div>
      ) : (
        /* Vue liste */
        <div className="news-body">
          <div className="news-header">
            <h1 className="news-title">Actualités</h1>
          </div>

          {news === null ? (
            <div className="news-loading">Chargement des actualités...</div>
          ) : filtered.length === 0 ? (
            <div className="news-empty">Aucune actualité disponible pour le moment.</div>
          ) : (
            <div className="news-list">
              {filtered.map((item, i) => (
                <div key={i} className="news-card" onClick={() => setSelected(item)}>
                  <div className="news-card-header">
                    <div className="news-card-meta">
                      {item.author && <span className="news-author">par {item.author}</span>}
                    </div>
                    <span className="news-date">{item.date}</span>
                  </div>
                  <h2 className="news-card-title">{item.title}</h2>
                  <p className="news-card-body">{renderText(item.preview || item.body)}</p>
                  <span className="news-card-readmore">Lire la suite →</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
