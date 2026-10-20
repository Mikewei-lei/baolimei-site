'use client';

import { useEffect, useRef, useState } from 'react';
import MediaDialog from './MediaDialog';
import { Play, Arrow } from './Icons';
import { works } from '@/lib/works';

export default function HeroStage() {
  const [active, setActive] = useState(null);
  const film = works[0];
  const stills = works.slice(1, 4);
  const stageRef = useRef(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const onMove = (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--tilt-x', `${(-y * 2.2).toFixed(2)}deg`);
        el.style.setProperty('--tilt-y', `${(x * 2.6).toFixed(2)}deg`);
        el.style.setProperty('--shift-x', `${(x * 8).toFixed(1)}px`);
        el.style.setProperty('--shift-y', `${(y * 6).toFixed(1)}px`);
      });
    };
    const reset = () => {
      el.style.setProperty('--tilt-x', '0deg');
      el.style.setProperty('--tilt-y', '0deg');
      el.style.setProperty('--shift-x', '0px');
      el.style.setProperty('--shift-y', '0px');
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', reset);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', reset);
    };
  }, []);

  return (
    <div className="hero__stage" ref={stageRef}>
      <div className="film-card">
        <button
          type="button"
          className="film-card__frame"
          onClick={() => setActive(film)}
          aria-label={`播放品牌样片《${film.title}》`}
        >
          <img
            src={film.poster}
            alt={`葆历莓原创样片《${film.title}》画面`}
            width="1920"
            height="1080"
            fetchPriority="high"
          />
          <span className="film-card__shade" aria-hidden="true" />
          <span className="film-card__bar film-card__bar--top" aria-hidden="true" />
          <span className="film-card__bar film-card__bar--bottom" aria-hidden="true" />
          <span className="film-card__hud">
            <span>
              <i /> REC · 00:14
            </span>
            <span>BAOLIMEI / 01</span>
          </span>
          <span className="film-card__play" aria-hidden="true">
            <Play width="18" height="18" />
          </span>
          <span className="film-card__title">
            <span className="film-card__cn">《{film.title}》</span>
            <span className="film-card__en">{film.en}</span>
          </span>
          <span className="film-card__credit">BAOLIMEI ORIGINAL · SHOT ON CINEMA 1</span>
        </button>

        <div className="film-card__meta">
          <div>
            <span className="mono">LATEST REEL</span>
            <strong>{film.headline}</strong>
          </div>
          <button type="button" className="film-card__watch" onClick={() => setActive(film)}>
            观看 <Arrow width="13" height="13" />
          </button>
        </div>
      </div>

      <div className="hero__rail">
        <div className="hero__rail-head">
          <span className="mono">FRAME STUDIES</span>
          <span className="mono">03 / 07</span>
        </div>
        <div className="hero__rail-items">
          {stills.map((s, i) => (
            <button
              type="button"
              key={s.id}
              className="hero__rail-item"
              onClick={() => setActive(s)}
              aria-label={`预览 ${s.title}`}
            >
              <img src={s.poster} alt="" loading="lazy" />
              <span className="mono">{String(i + 2).padStart(2, '0')}</span>
            </button>
          ))}
        </div>
      </div>

      <MediaDialog item={active} onClose={() => setActive(null)} />
    </div>
  );
}
