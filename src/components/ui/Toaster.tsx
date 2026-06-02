import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { subscribeToasts, dismissToast, type Toast } from '../../lib/toast';

// Contenedor de toasts. Se monta una vez en la raíz (App) y se suscribe al
// store de lib/toast. Cualquier parte de la app dispara con `toast(...)`.
const ICONOS = {
  success: <CheckCircle className="w-5 h-5 text-green-600" />,
  error: <XCircle className="w-5 h-5 text-red-600" />,
  info: <Info className="w-5 h-5 text-blue-600" />,
};

const Toaster = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => subscribeToasts(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[4000] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto bg-white shadow-xl border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3 min-w-[260px] max-w-sm animate-in fade-in slide-in-from-top-2"
        >
          {ICONOS[t.tipo]}
          <span className="text-sm font-semibold text-gray-700 flex-1">{t.mensaje}</span>
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Cerrar notificación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default Toaster;
