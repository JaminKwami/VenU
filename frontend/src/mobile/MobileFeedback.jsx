import { createContext, useCallback, useContext, useRef, useState } from 'react';

/*
 * Mobile feedback: in-app toasts + a bottom-sheet confirm dialog, replacing
 * the jarring native alert()/confirm() on phones.
 *
 *   const { toast, confirm } = useFeedback();
 *   toast('Saved');
 *   if (await confirm({ title: 'Cancel booking?', danger: true })) { … }
 */
const FeedbackContext = createContext(null);

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    // Safe fallback if used outside the provider (e.g. desktop) — never throws.
    return {
      toast: (m) => window.alert(m),
      confirm: (o) => Promise.resolve(window.confirm(o?.message || o?.title || 'Are you sure?')),
    };
  }
  return ctx;
}

export function MobileFeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const idRef = useRef(0);

  const toast = useCallback((message) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  const confirm = useCallback(
    (opts = {}) => new Promise((resolve) => {
      setDialog({
        title: opts.title || 'Are you sure?',
        message: opts.message || '',
        confirmLabel: opts.confirmLabel || 'Confirm',
        cancelLabel: opts.cancelLabel || 'Cancel',
        danger: !!opts.danger,
        resolve,
      });
    }),
    [],
  );

  function close(value) {
    dialog?.resolve(value);
    setDialog(null);
  }

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      <div className="m-toast-area" aria-live="polite">
        {toasts.map((t) => (
          <div className="m-toast" key={t.id}>{t.message}</div>
        ))}
      </div>

      {dialog && (
        <div className="m-sheet-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) close(false); }}>
          <div className="m-sheet">
            <h3 className="m-sheet-title">{dialog.title}</h3>
            {dialog.message && <p className="m-sheet-msg">{dialog.message}</p>}
            <div className="m-sheet-actions">
              <button className="btn btn-ghost btn-block" onClick={() => close(false)}>{dialog.cancelLabel}</button>
              <button className={`btn btn-block ${dialog.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)} autoFocus>
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}
