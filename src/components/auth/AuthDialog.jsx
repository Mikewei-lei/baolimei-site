'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Arrow, Spark } from '@/components/Icons';

const initialForm = { name: '', phone: '', code: '', password: '', agree: false };

export default function AuthDialog({ open, mode = 'login', onClose, onModeChange, onSuccess }) {
  const [form, setForm] = useState(initialForm);
  const [method, setMethod] = useState('code');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [devCode, setDevCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const panelRef = useRef(null);
  const firstRef = useRef(null);

  const isRegister = mode === 'register';

  useEffect(() => {
    if (!open) return;
    setError('');
    setNotice('');
    setDevCode('');
    setBusy(false);
    setForm((f) => ({ ...f, code: '', password: '', agree: false }));
    const t = setTimeout(() => firstRef.current?.focus(), 80);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && panelRef.current) {
        const nodes = panelRef.current.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), a[href], textarea'
        );
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, mode, onClose]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((v) => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  if (!open) return null;

  const update = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    if (error) setError('');
    if (notice) setNotice('');
  };

  const requestCode = async () => {
    if (sending || countdown > 0) return;
    const phone = form.phone.trim();
    if (!/^1[3-9]\d{9}$/.test(phone.replace(/[^\d]/g, '').replace(/^86/, ''))) {
      setError('请输入有效的中国大陆手机号');
      return;
    }
    setSending(true);
    setError('');
    setNotice('');
    try {
      const data = await apiFetch('/api/auth/request-code', {
        method: 'POST',
        body: { phone, purpose: isRegister ? 'register' : 'login' },
      });
      if (isRegister && data.exists) {
        setError('该手机号已注册，请切换到登录');
        return;
      }
      if (!isRegister && data.exists === false) {
        setError('该手机号尚未注册，请先创建账户');
        return;
      }
      setCountdown(60);
      if (data.devCode) {
        setDevCode(data.devCode);
        setNotice('开发环境验证码已生成，可直接使用下方验证码。');
      } else {
        setNotice('验证码已发送，请查看短信。');
      }
    } catch (err) {
      setError(err.message || '验证码发送失败');
    } finally {
      setSending(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const phone = form.phone.trim();
    if (!/^1[3-9]\d{9}$/.test(phone.replace(/[^\d]/g, '').replace(/^86/, ''))) {
      setError('请输入有效的中国大陆手机号');
      return;
    }
    if (isRegister) {
      if (!form.name.trim()) {
        setError('请填写你的称呼');
        return;
      }
      if (!/^\d{6}$/.test(form.code.trim())) {
        setError('请输入 6 位短信验证码');
        return;
      }
      if (form.password.length < 8) {
        setError('密码至少 8 位，且包含字母和数字');
        return;
      }
      if (!form.agree) {
        setError('请先同意用户协议与隐私政策');
        return;
      }
    } else if (method === 'code' && !/^\d{6}$/.test(form.code.trim())) {
      setError('请输入 6 位短信验证码');
      return;
    } else if (method === 'password' && !form.password) {
      setError('请输入密码');
      return;
    }

    setBusy(true);
    setError('');
    try {
      let data;
      if (isRegister) {
        data = await apiFetch('/api/auth/register', {
          method: 'POST',
          body: {
            phone,
            code: form.code.trim(),
            name: form.name.trim(),
            password: form.password,
          },
        });
      } else if (method === 'password') {
        data = await apiFetch('/api/auth/login/password', {
          method: 'POST',
          body: { phone, password: form.password },
        });
      } else {
        data = await apiFetch('/api/auth/login/code', {
          method: 'POST',
          body: { phone, code: form.code.trim() },
        });
      }
      onSuccess(data.user);
      onClose();
    } catch (err) {
      setError(err.message || '操作失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-mask" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="auth-dialog auth-dialog--compact"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
      >
        <div className="auth-dialog__brandbar">
          <div className="auth-brandbar__brand">
            <img src="/icon.png" alt="" width="28" height="28" />
            <span>
              BAOLIMEI
              <em>SECURE ACCESS</em>
            </span>
          </div>
          <button className="auth-close" type="button" onClick={onClose} aria-label="关闭登录窗口">
            ×
          </button>
        </div>

        <div className="auth-dialog__body">
          <div className="auth-dialog__intro">
            <span className="eyebrow">{isRegister ? 'Create account' : 'Welcome back'}</span>
            <h2 id="auth-title">{isRegister ? '创建你的创作席位' : '回到你的片场'}</h2>
            <p className="auth-dialog__sub">
              {isRegister
                ? '手机号注册，账户、项目与画布会云端保存。'
                : '登录后继续编辑云端画布、作品与生成任务。'}
            </p>
          </div>
          <div className="auth-badges" aria-hidden="true">
            <span>云端画布</span>
            <span>服务端会话</span>
            <span>设备管理</span>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="登录或注册">
            <button
              type="button"
              role="tab"
              aria-selected={!isRegister}
              className={!isRegister ? 'is-on' : ''}
              onClick={() => onModeChange('login')}
            >
              登录
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isRegister}
              className={isRegister ? 'is-on' : ''}
              onClick={() => onModeChange('register')}
            >
              注册
            </button>
          </div>

          {!isRegister ? (
            <div className="auth-methods" role="tablist" aria-label="登录方式">
              <button
                type="button"
                className={method === 'code' ? 'is-on' : ''}
                onClick={() => setMethod('code')}
              >
                验证码登录
              </button>
              <button
                type="button"
                className={method === 'password' ? 'is-on' : ''}
                onClick={() => setMethod('password')}
              >
                密码登录
              </button>
            </div>
          ) : null}

          <form onSubmit={submit} noValidate>
            <label className="auth-field">
              <span>手机号</span>
              <input
                ref={firstRef}
                className="input"
                type="tel"
                inputMode="numeric"
                value={form.phone}
                onChange={update('phone')}
                placeholder="138 0000 0000"
                autoComplete="tel"
                maxLength={20}
              />
            </label>

            {(isRegister || method === 'code') ? (
              <label className="auth-field">
                <span>短信验证码</span>
                <div className="auth-code-row">
                  <input
                    className="input"
                    inputMode="numeric"
                    value={form.code}
                    onChange={update('code')}
                    placeholder="6 位数字"
                    autoComplete="one-time-code"
                    maxLength={6}
                  />
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    disabled={sending || countdown > 0}
                    onClick={requestCode}
                  >
                    {sending ? '发送中…' : countdown > 0 ? `${countdown}s` : '获取验证码'}
                  </button>
                </div>
              </label>
            ) : null}

            {isRegister ? (
              <label className="auth-field">
                <span>称呼</span>
                <input
                  className="input"
                  value={form.name}
                  onChange={update('name')}
                  placeholder="例如：林导演"
                  autoComplete="name"
                  maxLength={60}
                />
              </label>
            ) : null}

            {isRegister || method === 'password' ? (
              <label className="auth-field">
                <span>密码</span>
                <input
                  className="input"
                  type="password"
                  value={form.password}
                  onChange={update('password')}
                  placeholder={isRegister ? '至少 8 位，含字母和数字' : '输入密码'}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  maxLength={72}
                />
              </label>
            ) : null}

            {isRegister ? (
              <label className="auth-check">
                <input type="checkbox" checked={form.agree} onChange={update('agree')} />
                <span>
                  我已阅读并同意 <a href="/legal/terms">用户协议</a> 与{' '}
                  <a href="/legal/privacy">隐私政策</a>
                </span>
              </label>
            ) : null}

            {devCode ? (
              <p className="auth-dev-code">
                开发环境验证码 <b>{devCode}</b>
              </p>
            ) : null}
            {notice ? <p className="auth-notice">{notice}</p> : null}
            {error ? (
              <p className="auth-error" role="alert">
                {error}
              </p>
            ) : null}

            <button className="btn btn--primary auth-submit" type="submit" disabled={busy}>
              {busy ? '处理中…' : isRegister ? '创建账户' : '登录'}
              {busy ? null : <Arrow width="15" height="15" />}
            </button>
          </form>

          <div className="auth-dialog__foot">
            <Spark width="13" height="13" />
            <span>会话保存在服务端，支持设备管理与安全退出。</span>
          </div>
        </div>
      </div>
    </div>
  );
}
