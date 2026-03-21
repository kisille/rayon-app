import React, { createContext, useContext, useState, useCallback } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null); // { message, resolve }

  const confirm = useCallback((message) => {
    return new Promise((resolve) => {
      setDialog({ message, resolve });
    });
  }, []);

  const handleClose = (result) => {
    if (dialog) dialog.resolve(result);
    setDialog(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-4 mb-6">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-sm text-gray-800 leading-relaxed pt-1.5">{dialog.message}</p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                className="btn-secondary"
                onClick={() => handleClose(false)}
              >
                Abbrechen
              </button>
              <button
                className="btn-danger"
                onClick={() => handleClose(true)}
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
