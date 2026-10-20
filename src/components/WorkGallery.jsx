'use client';

import { useState } from 'react';
import { Play } from './Icons';
import MediaDialog from './MediaDialog';
import { works } from '@/lib/works';

export default function WorkGallery({ all = false }) {
  const [active, setActive] = useState(null);
  const list = all ? works : works.slice(0, 6);

  return (
    <>
      <div className={`work-grid${all ? ' work-grid--all' : ''}`}>
        {list.map((item, i) => (
          <button
            type="button"
            key={item.id}
            className={`work-card${i === 0 ? ' work-card--feature' : ''}${
              item.portrait ? ' work-card--portrait' : ''
            }`}
            onClick={() => setActive(item)}
            aria-label={`预览 ${item.title}`}
          >
            <img src={item.poster} alt={`${item.title} 画面`} loading={i === 0 ? 'eager' : 'lazy'} />
            <span className="work-card__scrim" aria-hidden="true" />
            <span className="work-card__top">
              {item.badge ? <span className="work-card__badge">{item.badge}</span> : null}
              <span className="mono">{item.meta}</span>
            </span>
            <span className="work-card__bottom">
              <span className="work-card__name">
                <b>{item.title}</b>
                <span>{item.en}</span>
              </span>
              <span className="work-card__play" aria-hidden="true">
                <Play width="15" height="15" />
              </span>
            </span>
          </button>
        ))}
      </div>
      <MediaDialog item={active} onClose={() => setActive(null)} />
    </>
  );
}
