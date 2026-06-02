// Store mínimo de toasts (notificaciones flotantes), con patrón pub/sub.
// Vive fuera de React para que cualquier módulo pueda llamar `toast(...)` sin
// pasar por un contexto/provider. El componente <Toaster> se suscribe y pinta.

export type ToastTipo = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  mensaje: string;
  tipo: ToastTipo;
}

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(toasts);
}

// El <Toaster> llama esto en un useEffect; devuelve la función de limpieza.
export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => {
    listeners.delete(listener);
  };
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

// API pública: dispara un toast. Se auto-descarta a los `durationMs`.
export function toast(mensaje: string, tipo: ToastTipo = 'success', durationMs = 3000) {
  const id = nextId++;
  toasts = [...toasts, { id, mensaje, tipo }];
  emit();
  setTimeout(() => dismissToast(id), durationMs);
}
