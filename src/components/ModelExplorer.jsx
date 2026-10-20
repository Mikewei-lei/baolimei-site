'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { models } from '@/lib/models';
import { modelFilters } from '@/lib/works';
import { Arrow, Spark } from './Icons';

export default function ModelExplorer() {
  const [filter, setFilter] = useState('all');

  const list = useMemo(() => {
    if (filter === 'all') return models;
    if (filter === 'own') return models.filter((m) => m.vendor === '葆历莓');
    return models.filter((m) => m.kind === filter);
  }, [filter]);

  return (
    <div>
      <div className="model-toolbar">
        <div className="model-filters" role="tablist" aria-label="模型筛选">
          {modelFilters.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={`chip${filter === f.id ? ' is-on' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="mono model-count">{list.length} MODELS AVAILABLE</span>
      </div>

      <div className="model-grid">
        {list.map((m) => (
          <article className="model-card" key={m.id}>
            <div className="model-card__top">
              <span className="model-card__glyph" aria-hidden="true">
                {m.kind === 'video' ? 'VID' : 'IMG'}
              </span>
              <span className="model-card__vendor">{m.vendor}</span>
              {m.badge ? <span className="model-card__badge">{m.badge}</span> : null}
            </div>
            <h3>{m.name}</h3>
            <p>{m.desc}</p>
            <div className="model-card__specs">
              <div>
                <span>类型</span>
                <b>{m.kind === 'video' ? '视频生成' : '图像生成'}</b>
              </div>
              <div>
                <span>时长 / 尺寸</span>
                <b>{m.kind === 'video' ? `最长 ${m.maxDuration}s` : m.resolutions.join(' / ')}</b>
              </div>
              <div>
                <span>画幅</span>
                <b>{m.ratios.slice(0, 3).join(' · ')}{m.ratios.length > 3 ? ' …' : ''}</b>
              </div>
              <div>
                <span>消耗</span>
                <b>{m.credits} 积分 / 次</b>
              </div>
            </div>
            <div className="model-card__foot">
              <Link href={`/studio?model=${m.id}`} className="btn btn--ghost btn--sm">
                <Spark width="14" height="14" /> 在创作台使用
              </Link>
              <span className="mono">{m.kind === 'video' ? 'VIDEO' : 'IMAGE'}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="model-compare">
        <div className="model-compare__head">
          <div>
            <span className="eyebrow">Compare</span>
            <h2 className="h2">一张表选对模型</h2>
          </div>
          <Link href="/pricing" className="btn btn--ghost btn--sm">
            查看积分表 <Arrow width="14" height="14" />
          </Link>
        </div>
        <div className="table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>模型</th>
                <th>厂商</th>
                <th>类型</th>
                <th>最长时长</th>
                <th>最高分辨率</th>
                <th>积分 / 次</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{m.vendor}</td>
                  <td>{m.kind === 'video' ? '视频' : '图像'}</td>
                  <td>{m.kind === 'video' ? `${m.maxDuration}s` : '—'}</td>
                  <td>{m.resolutions[m.resolutions.length - 1]}</td>
                  <td>{m.credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
