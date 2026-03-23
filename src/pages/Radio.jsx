import backgroundImg from '../assets/background.png';
import bannerImg from '../assets/banner.png';
import './Radio.css';

export const STATIONS = [
  { id: 'nrj',          name: 'NRJ',           genre: 'Pop / Hits',      color: '#ff4444', url: 'https://streaming.nrjaudio.fm/oumvmk8fnozc?origine=fluxradios' },
  { id: 'funradio',     name: 'Fun Radio',      genre: 'Dance / Électro', color: '#ff8800', url: 'http://icecast.funradio.fr/fun-1-44-128?listen=webCwsBCggNCQgLDQUGBAcGBg' },
  { id: 'skyrock',      name: 'Skyrock',        genre: 'Hip-Hop / R&B',   color: '#00aaff', url: 'https://icecast.skyrock.net/s/natio_mp3_128k' },
  { id: 'rtl',          name: 'RTL',            genre: 'Généraliste',     color: '#e8000d', url: 'http://icecast.rtl.fr/rtl-1-44-128?listen=webCwsBCggNCQgLDQUGBAcGBg' },
  { id: 'tomorrowland', name: 'Tomorrowland',   genre: 'EDM / Festival',  color: '#9b59b6', url: 'https://25683.live.streamtheworld.com/OWR_INTERNATIONAL.mp3' },
  { id: 'qdance',       name: 'Q-dance',        genre: 'Hardstyle',       color: '#FFD700', url: 'https://25343.live.streamtheworld.com/Q_DANCE.mp3' },
];

export default function Radio({ onBack, currentStation, isPlaying, onSelect, volume, onVolume }) {
  return (
    <div className="radio-page">
      <img className="radio-bg" src={backgroundImg} alt="" />
      <div className="radio-overlay" />

      {/* Titlebar */}
      <div className="titlebar">
        <div style={{ flex: 1 }} />
        <span className="titlebar-title">VARTACRAFT LAUNCHER</span>
        <div className="titlebar-controls">
          <button className="tb-btn" onClick={() => window.launcher?.minimize()}>
            <svg width="10" height="2" viewBox="0 0 10 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="0" y1="1" x2="10" y2="1"/></svg>
          </button>
          <button className="tb-btn tb-close" onClick={() => window.launcher?.close()}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>
          </button>
        </div>
      </div>

      <div className="radio-content">
        <button className="radio-back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Retour
        </button>

        <img className="radio-banner" src={bannerImg} alt="Vartacraft" />
        <h2 className="radio-title">Radio</h2>
        <p className="radio-sub">Écoute de la musique pendant que tu joues</p>

        <div className="radio-grid">
          {STATIONS.map(s => {
            const active = currentStation?.id === s.id;
            const playing = active && isPlaying;
            return (
              <button
                key={s.id}
                className={`radio-card${active ? ' active' : ''}`}
                style={{ '--station-color': s.color }}
                onClick={() => onSelect(s)}
              >
                <div className="radio-card-glow" />
                <div className="radio-card-icon">
                  {playing ? (
                    <span className="radio-bars">
                      <span /><span /><span /><span />
                    </span>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
                    </svg>
                  )}
                </div>
                <div className="radio-card-info">
                  <span className="radio-card-name">{s.name}</span>
                  <span className="radio-card-genre">{s.genre}</span>
                </div>
                <div className="radio-card-action">
                  {playing ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Volume */}
        <div className="radio-volume">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
          <input
            type="range" min="0" max="1" step="0.01"
            value={volume}
            onChange={e => onVolume(parseFloat(e.target.value))}
            className="radio-volume-slider"
          />
          <span className="radio-volume-val">{Math.round(volume * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
