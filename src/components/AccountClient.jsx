'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { apiFetch, uploadAssetFile } from '@/lib/api';
import { Arrow, Shield, Upload, Trash, Refresh, Check } from '@/components/Icons';

function deviceLabel(ua = '') {
  if (!ua) return '未知设备';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Safari\//.test(ua)
        ? 'Safari'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : '浏览器';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Mac OS X/.test(ua)
      ? 'macOS'
      : /Android/.test(ua)
        ? 'Android'
        : /iPhone|iPad/.test(ua)
          ? 'iOS'
          : '未知系统';
  return `${browser} · ${os}`;
}

export default function AccountClient() {
  const router = useRouter();
  const { user, ready, openAuth, signOut, refreshUser } = useAuth();
  const [tab, setTab] = useState('profile');
  const [sessions, setSessions] = useState([]);
  const [projectCount, setProjectCount] = useState(null);
  const [assetCount, setAssetCount] = useState(null);
  const [name, setName] = useState('');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [deleteForm, setDeleteForm] = useState({ password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const loadCounts = async () => {
    try {
      const [projects, assets] = await Promise.all([
        apiFetch('/api/projects'),
        apiFetch('/api/assets?limit=100'),
      ]);
      setProjectCount((projects.projects || []).length);
      setAssetCount((assets.assets || []).length);
    } catch {
      setProjectCount(null);
      setAssetCount(null);
    }
  };

  const loadSessions = async () => {
    try {
      const data = await apiFetch('/api/auth/sessions');
      setSessions(data.sessions || []);
    } catch (err) {
      setError(err.message || '会话加载失败');
    }
  };

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    loadSessions();
    loadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const flash = (msg) => {
    setNotice(msg);
    setError('');
    setTimeout(() => setNotice(''), 3000);
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('称呼不能为空');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PATCH',
        body: { name: name.trim() },
      });
      await refreshUser();
      flash('个人资料已保存到云端');
    } catch (err) {
      setError(err.message || '保存失败');
    } finally {
      setBusy(false);
    }
  };

  const onAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('头像必须是图片');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const asset = await uploadAssetFile(file);
      await apiFetch('/api/auth/profile', {
        method: 'PATCH',
        body: { avatarAssetId: asset.id },
      });
      await refreshUser();
      flash('头像已更新');
    } catch (err) {
      setError(err.message || '头像上传失败');
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword.length < 8) {
      setError('新密码至少 8 位');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirm) {
      setError('两次输入的新密码不一致');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiFetch('/api/auth/password', {
        method: 'POST',
        body: {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        },
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirm: '' });
      flash('密码已更新，其他设备的会话已撤销');
      await loadSessions();
    } catch (err) {
      setError(err.message || '密码修改失败');
    } finally {
      setBusy(false);
    }
  };

  const revokeSession = async (session) => {
    if (!window.confirm(`退出「${deviceLabel(session.userAgent)}」这个会话？`)) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/api/auth/sessions/${session.id}`, { method: 'DELETE' });
      if (session.current) {
        await signOut();
        router.push('/');
        return;
      }
      await loadSessions();
      flash('会话已撤销');
    } catch (err) {
      setError(err.message || '撤销失败');
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async (e) => {
    e.preventDefault();
    if (deleteForm.confirm !== 'DELETE') {
      setError('请输入 DELETE 确认注销');
      return;
    }
    if (!window.confirm('确定注销账户？账户将立即停用，项目、画布与素材将进入删除流程。')) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch('/api/auth/account', {
        method: 'DELETE',
        body: { password: deleteForm.password || undefined, confirm: 'DELETE' },
      });
      await signOut();
      router.push('/');
    } catch (err) {
      setError(err.message || '注销失败');
    } finally {
      setBusy(false);
    }
  };

  const stats = useMemo(
    () => [
      ['云端项目', projectCount ?? '—'],
      ['云端素材', assetCount ?? '—'],
      ['有效会话', sessions.length || '—'],
    ],
    [projectCount, assetCount, sessions.length]
  );

  if (!ready) {
    return <div className="empty"><b>正在读取云端账户…</b></div>;
  }

  if (!user) {
    return (
      <div className="empty">
        <b>请先登录账户中心</b>
        登录后可管理个人资料、头像、密码、设备会话与账户注销。
        <div style={{ marginTop: 18 }}>
          <button type="button" className="btn btn--primary" onClick={() => openAuth('login')}>
            登录 / 注册 <Arrow width="14" height="14" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="account-shell">
      <div className="account-hero">
        <div className="account-avatar">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : (user.name || 'B').slice(0, 1)}
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} aria-label="更换头像">
            <Upload width="12" height="12" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatar} />
        </div>
        <div className="account-hero__main">
          <span className="eyebrow">Cloud Account</span>
          <h2>{user.name || '流花创作者'}</h2>
          <p>
            {user.phone} · 云端账户 · 上次登录会话已加密保存
          </p>
          <div className="account-hero__links">
            <Link href="/canvas" className="btn btn--primary btn--sm">
              打开画布 <Arrow width="13" height="13" />
            </Link>
            <Link href="/library" className="btn btn--ghost btn--sm">
              云端素材库
            </Link>
          </div>
        </div>
      </div>

      <div className="account-stats">
        {stats.map(([label, value]) => (
          <div key={label}>
            <b>{value}</b>
            <span>{label}</span>
          </div>
        ))}
        <div>
          <b>{new Date(user.createdAt).toLocaleDateString('zh-CN')}</b>
          <span>注册日期</span>
        </div>
      </div>

      {notice ? <p className="account-notice"><Check width="13" height="13" /> {notice}</p> : null}
      {error ? <p className="auth-error">{error}</p> : null}

      <div className="account-tabs" role="tablist">
        {[
          ['profile', '个人资料'],
          ['security', '安全与会话'],
          ['danger', '账户注销'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'is-on' : ''}
            onClick={() => {
              setTab(key);
              setError('');
              setNotice('');
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'profile' ? (
        <div className="account-grid">
          <form className="account-card" onSubmit={saveProfile}>
            <div className="account-card__head">
              <span className="mono">PROFILE</span>
              <Shield width="16" height="16" />
            </div>
            <h3>个人资料</h3>
            <label className="auth-field">
              <span>称呼</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </label>
            <label className="auth-field">
              <span>手机号</span>
              <input className="input" value={user.phone} disabled />
            </label>
            <label className="auth-field">
              <span>用户 ID</span>
              <input className="input mono" value={user.id} disabled />
            </label>
            <button className="btn btn--primary btn--sm" type="submit" disabled={busy}>
              {busy ? '保存中…' : '保存资料'}
            </button>
          </form>

          <div className="account-card">
            <div className="account-card__head">
              <span className="mono">AVATAR</span>
              <Upload width="16" height="16" />
            </div>
            <h3>头像</h3>
            <p className="account-muted">头像会存入对象存储，仅在账户中心与导航显示。</p>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              上传新头像
            </button>
            <div className="account-card__note">
              当前账户创建于 {new Date(user.createdAt).toLocaleString('zh-CN')}
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'security' ? (
        <div className="account-grid">
          <form className="account-card" onSubmit={changePassword}>
            <div className="account-card__head">
              <span className="mono">PASSWORD</span>
              <Shield width="16" height="16" />
            </div>
            <h3>修改密码</h3>
            <label className="auth-field">
              <span>当前密码</span>
              <input
                className="input"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
                autoComplete="current-password"
              />
            </label>
            <label className="auth-field">
              <span>新密码</span>
              <input
                className="input"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
                autoComplete="new-password"
              />
            </label>
            <label className="auth-field">
              <span>确认新密码</span>
              <input
                className="input"
                type="password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm((f) => ({ ...f, confirm: e.target.value }))}
                autoComplete="new-password"
              />
            </label>
            <button className="btn btn--primary btn--sm" type="submit" disabled={busy}>
              更新密码
            </button>
          </form>

          <div className="account-card account-card--wide">
            <div className="account-card__head">
              <span className="mono">SESSIONS</span>
              <button type="button" className="icon-btn" onClick={loadSessions} aria-label="刷新会话">
                <Refresh width="13" height="13" />
              </button>
            </div>
            <h3>设备与会话</h3>
            <div className="account-sessions">
              {sessions.length === 0 ? (
                <p className="account-muted">没有有效会话</p>
              ) : (
                sessions.map((session) => (
                  <div className="account-session" key={session.id}>
                    <div>
                      <b>{deviceLabel(session.userAgent)}</b>
                      <span>
                        {session.ip || '未知 IP'} · 最近活跃 {new Date(session.lastUsedAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <div className="account-session__actions">
                      {session.current ? <span className="account-current">当前设备</span> : null}
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => revokeSession(session)}>
                        撤销
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'danger' ? (
        <form className="account-card account-danger" onSubmit={deleteAccount}>
          <div className="account-card__head">
            <span className="mono">DELETE ACCOUNT</span>
            <Trash width="16" height="16" />
          </div>
          <h3>注销账户</h3>
          <p className="account-muted">
            注销后账户立即停用，所有会话撤销，项目与素材进入删除流程。此操作不可撤销。
          </p>
          <label className="auth-field">
            <span>当前密码</span>
            <input
              className="input"
              type="password"
              value={deleteForm.password}
              onChange={(e) => setDeleteForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="如果账户设置了密码"
            />
          </label>
          <label className="auth-field">
            <span>输入 DELETE 确认</span>
            <input
              className="input mono"
              value={deleteForm.confirm}
              onChange={(e) => setDeleteForm((f) => ({ ...f, confirm: e.target.value }))}
              placeholder="DELETE"
            />
          </label>
          <button className="btn btn--ghost btn--sm account-danger__btn" type="submit" disabled={busy}>
            注销账户
          </button>
        </form>
      ) : null}
    </div>
  );
}
