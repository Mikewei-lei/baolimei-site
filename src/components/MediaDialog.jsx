'use client';

import { useEffect, useRef } from 'react';

export default function MediaDialog({ item, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!item) return;
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div className="media-mask" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="media-dialog" role="dialog" aria-modal="true" aria-label={`${item.title} 预览`}>
        <div className="media-dialog__head">
          <div>
            <span className="eyebrow">{item.kind === 'video' ? 'Film Preview' : 'Still Preview'}</span>
            <h2>
              {item.title}
              <span>{item.en}</span>
            </h2>
          </div>
          <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="关闭预览">
            ×
          </button>
        </div>

        <div className="media-dialog__stage">
          {item.kind === 'video' && (item.video || item.poster) ? (
            <video
              key={item.video || item.poster}
              src={item.video || item.poster}
              poster={item.poster}
              controls
              autoPlay
              playsInline
              preload="metadata"
            />
          ) : item.kind === 'audio' ? (
            <div className="media-dialog__audio">
              <span className="media-dialog__audio-icon" aria-hidden="true">AUDIO</span>
              <audio src={item.audio || item.poster} controls autoPlay preload="metadata" />
            </div>
          ) : (
            <img src={item.poster} alt={item.title} />
          )}
        </div>

        <div className="media-dialog__foot">
          <p>{item.headline || item.meta}</p>
          <span className="mono">{item.meta}</span>
        </div>
      </div>
    </div>
  );
}
