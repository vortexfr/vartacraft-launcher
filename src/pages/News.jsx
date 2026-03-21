import { useState, useEffect } from 'react';
import './News.css';

export default function News({ onBack }) {
  const [news, setNews] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    window.launcher?.getNews()
      .then(result => setNews(result?.success ? result.data : []))
      .catch(() => setNews([]));
  }, []);

  const filtered = (news || []).filter(n => filter === 'all' || n.type === filter);

  return (
    <div className="news">
      <div className="titlebar">
        <button className="tb-back" onClick={onBack}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Retour</button>
        <span className="titlebar-title">VARTACRAFT LAUNCHER</span>
        <div className="titlebar-controls">
          <button className="tb-btn" onClick={() => window.launcher?.minimize()}><svg width="10" height="2" viewBox="0 0 10 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="0" y1="1" x2="10" y2="1"/></svg></button>
          <button className="tb-btn tb-close" onClick={() => window.launcher?.close()}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg></button>
        </div>
      </div>

      <div className="news-body">
        <div className="news-header">
          <h1 className="news-title">Actualités</h1>
          <div className="news-filters">
            <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Tout</button>
            <button className={`filter-btn ${filter === 'server' ? 'active' : ''}`} onClick={() => setFilter('server')}>Serveur</button>
            <button className={`filter-btn ${filter === 'launcher' ? 'active' : ''}`} onClick={() => setFilter('launcher')}>Launcher</button>
          </div>
        </div>

        {news === null ? (
          <div className="news-loading">Chargement des actualités...</div>
        ) : filtered.length === 0 ? (
          <div className="news-empty">Aucune actualité disponible pour le moment.</div>
        ) : (
          <div className="news-list">
            {filtered.map((item, i) => (
              <div key={i} className={`news-card type-${item.type || 'server'}`}>
                <div className="news-card-header">
                  <span className={`news-tag type-${item.type || 'server'}`}>
                    {item.type === 'launcher' ? 'Launcher' : 'Serveur'}
                  </span>
                  <span className="news-date">{item.date}</span>
                </div>
                <h2 className="news-card-title">{item.title}</h2>
                <p className="news-card-body">{item.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}