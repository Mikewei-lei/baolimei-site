'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { site, nav } from '@/lib/site';

export default function Header() {
  const pathname = usePathname();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href) => pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      <header className={`header${solid ? ' header--solid' : ''}`}>
        <div className="container header__inner">
          <Link href="/" className="brand" aria-label={site.name}>
            <img className="brand__mark" src="/brand/logo.png" alt={`${site.name} logo`} width="32" height="32" />
            <span className="brand__text">
              <span className="brand__cn">{site.name}</span>
              <span className="brand__en">{site.nameEn}</span>
            </span>
          </Link>

          <nav className="nav" aria-label="主导航">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className={isActive(item.href) ? 'is-active' : ''}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="header__actions">
            <span className="status-dot">
              <i />
              内测中
            </span>
            <Link href="/studio" className="btn btn--primary btn--sm">
              开始创作
            </Link>
            <button
              className="menu-btn"
              aria-label="打开菜单"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <span />
            </button>
          </div>
        </div>
      </header>

      {open && (
        <nav className="mobile-nav" aria-label="移动导航">
          {nav.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
          <Link href="/studio" className="btn btn--primary">
            开始创作
          </Link>
        </nav>
      )}
    </>
  );
}
