import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';

const ToastContext = createContext(null);

const ICONS = {
  success: <CheckCircleIcon className="w-5 h-5 text-green-500 shrink-0" />,
  error:   <XCircleIcon className="w-5 h-5 text-red-500 shrink-0" />,
  warning: <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500 shrink-0" />,
  info:    <InformationCircleIcon className="w-5 h-5 text-blue-500 shrink-0" />,
};

const BORDER = {
  success: 'border-green-200',
  error:   'border-red-200',
  warning: 'border-yellow-200',
  info:    'border-blue-200',
};

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++nextId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-start gap-3 bg-white border ${BORDER[t.type]} rounded-xl shadow-lg px-4 py-3 min-w-72 max-w-sm pointer-events-auto animate-[fadeInUp_0.2s_ease]`}
          >
            {ICONS[t.type]}
            <span className="text-sm text-gray-800 flex-1 leading-snug">{t.message}</span>
            <button onClick={() => remove(t.id)} className="text-gray-300 hover:text-gray-500 shrink-0 -mr-1">
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
