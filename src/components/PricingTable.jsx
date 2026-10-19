import Link from 'next/link';
import { Check } from './Icons';
import { plans } from '@/lib/content';

export default function PricingTable() {
  return (
    <div className="price-grid">
      {plans.map((p) => (
        <div key={p.name} className={`price${p.hot ? ' price--hot' : ''}`}>
          <div className="price__name">
            <span>{p.name}</span>
            {p.hot ? <span className="price__tag">最受欢迎</span> : <span>{p.cn}</span>}
          </div>
          <div className="price__amount">
            ¥{p.price}
            <small>{p.unit.replace('元 / ', '/ ')}</small>
          </div>
          <p className="price__note">{p.note}</p>
          <ul>
            {p.features.map((f) => (
              <li key={f}>
                <Check /> {f}
              </li>
            ))}
          </ul>
          <Link href={p.href} className={`btn ${p.hot ? 'btn--primary' : 'btn--ghost'}`}>
            {p.cta}
          </Link>
        </div>
      ))}
    </div>
  );
}
