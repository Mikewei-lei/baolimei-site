'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { site, nav } from '@/lib/site';
import { useAuth } from '@/components/auth/AuthProvider';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, ready, openAuth, signOut } = useAuth();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const userRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    setUserMenu(false);
  }, [pathname]);

  useEffect(() => {
    if (!userMenu) return;
    const onDown = (e) => {
      if (userRef.current && !userRef.current.contains(e.target)) setUserMenu(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setUserMenu(false);
    };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [userMenu]);

  const isActive = (href) => pathname === href || pathname.startsWith(`${href}/`);

  const start = () => {
    setOpen(false);
    openAuth('login');
  };

  return (
    <>
      <header className={`header${solid || open ? ' header--solid' : ''}`}>
        <div className="container header__inner">
          <Link href="/" className="brand" aria-label={`${site.name} ${site.nameEn} 首页`}>
            <img
              className="brand__mark"
              src="/icon.png"
              alt={`${site.name} logo`}
              width="32"
              height="32"
            />
            <span className="brand__text">
              <span className="brand__cn">{site.name}</span>
              <span className="brand__en">{site.nameEn}</span>
            </span>
          </Link>

          <nav className="nav" aria-label="主导航">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={isActive(item.href) ? 'is-active' : ''}
                aria-current={isActive(item.href) ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="header__actions">
            <span className="status-dot">
              <i />
              内测
            </span>

            {!ready ? (
              <span className="header__auth-skeleton" aria-hidden="true" />
            ) : user ? (
              <div className="user-menu" ref={userRef}>
                <button
                  type="button"
                  className={`user-menu__trigger${userMenu ? ' is-open' : ''}`}
                  aria-expanded={userMenu}
                  aria-haspopup="menu"
                  onClick={() => setUserMenu((v) => !v)}
                >
                  <span className="user-menu__avatar" aria-hidden="true">
                    {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user.name?.slice(0, 1) || 'B'}
                  </span>
                  <span className="user-menu__name">{user.name}</span>
                  <span className="user-menu__chev" aria-hidden="true" />
                </button>
                {userMenu ? (
                  <div className="user-menu__panel" role="menu">
                    <div className="user-menu__head">
                      <strong>{user.name || '创作者'}</strong>
                      <span>{user.phone}</span>
                      <div className="user-menu__plan">
                        <span>云端账户</span>
                        <span>已同步</span>
                      </div>
                    </div>
                    <Link href="/library" role="menuitem" onClick={() => setUserMenu(false)}>
                      我的作品库
                    </Link>
                    <Link href="/canvas" role="menuitem" onClick={() => setUserMenu(false)}>
                      继续编辑画布
                    </Link>
                    <Link href="/account" role="menuitem" onClick={() => setUserMenu(false)}>
                      账户与安全
                    </Link>
                    <Link href="/pricing" role="menuitem" onClick={() => setUserMenu(false)}>
                      套餐与积分
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={async () => {
                        setUserMenu(false);
                        await signOut();
                        router.push('/');
                      }}
                    >
                      退出登录
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <button type="button" className="header__signin" onClick={() => openAuth('login')}>
                登录 / 注册
              </button>
            )}

            <Link href="/studio" className="btn btn--primary btn--sm header__cta">
              开始创作
            </Link>
            <button
              className="menu-btn"
              aria-label={open ? '关闭菜单' : '打开菜单'}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <span />
            </button>
          </div>
        </div>
      </header>

      {open ? (
        <nav className="mobile-nav" aria-label="移动导航">
          <div className="mobile-nav__links">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={isActive(item.href) ? 'is-active' : ''}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            {ready && user ? (
              <Link
                href="/account"
                className={isActive('/account') ? 'is-active' : ''}
                onClick={() => setOpen(false)}
              >
                账户与安全
              </Link>
            ) : null}
          </div>

          {ready && user ? (
            <div className="mobile-nav__account">
              <div>
                <strong>{user.name || '创作者'}</strong>
                <span>{user.phone} · 云端已同步</span>
              </div>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={async () => {
                  setOpen(false);
                  await signOut();
                  router.push('/');
                }}
              >
                退出
              </button>
            </div>
          ) : (
            <div className="mobile-nav__account">
              <div>
                <strong>内测账户</strong>
                <span>仅保存在当前浏览器</span>
              </div>
              <button type="button" className="btn btn--ghost btn--sm" onClick={start}>
                登录 / 注册
              </button>
            </div>
          )}

          <Link href="/studio" className="btn btn--primary mobile-nav__cta" onClick={() => setOpen(false)}>
            开始创作
          </Link>
        </nav>
      ) : null}
    </>
  );
}
