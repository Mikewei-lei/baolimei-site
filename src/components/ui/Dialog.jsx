'use client';

import { useEffect, useRef } from 'react';
import { Close } from '@/components/Icons';

export default function Dialog({
  open,
  onClose,
  eyebrow,
  title,
  description,
  children,
  footer,
  width = 560,
}) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && panelRef.current) {
        const nodes = panelRef.current.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], select:not([disabled])'
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
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ui-mask" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="ui-dialog"
        style={{ width: `min(${width}px, 100%)` }}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ui-dialog-title"
      >
        <div className="ui-dialog__head">
          <div>
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            <h2 id="ui-dialog-title">{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="关闭对话框">
            <Close width="14" height="14" />
          </button>
        </div>
        <div className="ui-dialog__body">{children}</div>
        {footer ? <div className="ui-dialog__foot">{footer}</div> : null}
      </div>
    </div>
  );
}
