"use client";
import { createContext, useContext, useState, useCallback } from 'react';

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((msg, type='info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  return (
    <ToastCtx.Provider value={{ push, dismiss }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-64">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`text-sm px-3 py-2 rounded shadow bg-neutral-900 border ${t.type==='error'?"border-red-500/40 text-red-300": t.type==='success'?"border-green-500/40 text-green-300":"border-neutral-700 text-neutral-200"} flex items-start justify-between gap-3`}
            role="alert"
            aria-live="polite"
          >
            <span className="flex-1">{t.msg}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Cerrar notificación"
              title="Cerrar"
              className="leading-none text-current/80 hover:text-current focus:outline-none"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}