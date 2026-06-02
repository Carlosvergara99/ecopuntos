import React, { useEffect, useState } from 'react';
import { ArrowLeft, Package, Truck, Trash2, Calendar, MapPin, ClipboardList, Phone, Image as ImageIcon, X, Ban } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

// Shape que devuelve el backend en GET /api/solicitudes/mias (campos en
// inglés, ver solicitudesController.aFormatoFrontend).
interface Solicitud {
  id: number;
  type: 'muebles' | 'colchones' | 'escombros' | 'otros';
  description: string;
  address: string;
  date: string;
  photoName: string | null;
  photoData: string | null;
  solicitanteNombre: string | null;
  solicitanteTelefono: string | null;
  status: 'pendiente' | 'agendada' | 'completada' | 'cancelada';
  createdAt: string;
}

interface MisSolicitudesViewProps {
  onBack: () => void;
}

// Etiqueta + ícono por tipo de residuo.
const TIPO_META: Record<Solicitud['type'], { label: string; icon: React.ReactNode }> = {
  muebles: { label: 'Muebles', icon: <Package className="w-5 h-5" /> },
  colchones: { label: 'Colchones', icon: <Trash2 className="w-5 h-5" /> },
  escombros: { label: 'Escombros', icon: <Truck className="w-5 h-5" /> },
  otros: { label: 'Otros', icon: <Package className="w-5 h-5" /> },
};

// Color del badge por estado.
const ESTADO_META: Record<Solicitud['status'], { label: string; classes: string }> = {
  pendiente: { label: 'Pendiente', classes: 'bg-amber-100 text-amber-700' },
  agendada: { label: 'Agendada', classes: 'bg-blue-100 text-blue-700' },
  completada: { label: 'Completada', classes: 'bg-green-100 text-green-700' },
  cancelada: { label: 'Cancelada', classes: 'bg-gray-100 text-gray-500' },
};

const MisSolicitudesView: React.FC<MisSolicitudesViewProps> = ({ onBack }) => {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Foto que se está viendo en el visor (lightbox). null = visor cerrado.
  const [fotoAbierta, setFotoAbierta] = useState<string | null>(null);
  // Gestión: id de la solicitud con una acción en curso (para deshabilitar
  // botones), la acción pendiente de confirmar (cancelar o eliminar) y error.
  const [accionId, setAccionId] = useState<number | null>(null);
  const [confirmAccion, setConfirmAccion] = useState<{ solicitud: Solicitud; tipo: 'cancelar' | 'eliminar' } | null>(null);

  const handleCancelar = async (s: Solicitud) => {
    setAccionId(s.id);
    try {
      await api(`/api/solicitudes/${s.id}/cancelar`, { method: 'PATCH' });
      setSolicitudes((prev) =>
        prev.map((x) => (x.id === s.id ? { ...x, status: 'cancelada' as const } : x))
      );
      setConfirmAccion(null);
      toast('Solicitud cancelada', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo cancelar la solicitud.', 'error');
    } finally {
      setAccionId(null);
    }
  };

  const handleEliminar = async (s: Solicitud) => {
    setAccionId(s.id);
    try {
      await api(`/api/solicitudes/${s.id}`, { method: 'DELETE' });
      setSolicitudes((prev) => prev.filter((x) => x.id !== s.id));
      setConfirmAccion(null);
      toast('Solicitud eliminada', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo eliminar la solicitud.', 'error');
    } finally {
      setAccionId(null);
    }
  };

  useEffect(() => {
    let cancelado = false;
    api<{ solicitudes: Solicitud[] }>('/api/solicitudes/mias')
      .then((data) => {
        if (!cancelado) setSolicitudes(data.solicitudes);
      })
      .catch((err: Error) => {
        if (!cancelado) setError(err.message);
      })
      .finally(() => {
        if (!cancelado) setIsLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-green-50">
      {/* Header */}
      <div className="bg-green-600 text-white px-6 py-6 flex items-center gap-4 shadow-lg">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          aria-label="Volver al mapa"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-black leading-tight">Mis solicitudes</h1>
          <p className="text-green-50 text-xs opacity-90">Historial de recolecciones agendadas</p>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-2xl mx-auto p-6">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="w-8 h-8 border-2 border-green-300 border-t-green-600 rounded-full animate-spin mb-3" />
            <p className="text-sm">Cargando tus solicitudes…</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-2xl text-sm">
            No se pudieron cargar tus solicitudes: {error}
          </div>
        )}

        {!isLoading && !error && solicitudes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4">
              <ClipboardList className="w-9 h-9" />
            </div>
            <h2 className="text-lg font-bold text-gray-700">Aún no tienes solicitudes</h2>
            <p className="text-sm text-gray-500 mt-1 mb-6">
              Cuando agendes una recolección, aparecerá aquí.
            </p>
            <button
              type="button"
              onClick={onBack}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-lg shadow-green-100 transition-colors"
            >
              Ir al mapa a agendar
            </button>
          </div>
        )}

        {!isLoading && !error && solicitudes.length > 0 && (
          <div className="space-y-4">
            {solicitudes.map((s) => {
              const tipo = TIPO_META[s.type] ?? TIPO_META.otros;
              const estado = ESTADO_META[s.status] ?? ESTADO_META.pendiente;
              return (
                <div
                  key={s.id}
                  className="bg-white rounded-[28px] shadow-sm border border-gray-100 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
                        {tipo.icon}
                      </div>
                      <div>
                        <p className="font-black text-gray-800 leading-none">{tipo.label}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Agendada el {s.createdAt?.slice(0, 10)}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full ${estado.classes}`}>
                      {estado.label}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mt-4">{s.description}</p>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span>{s.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{s.address}</span>
                    </div>
                    {s.solicitanteTelefono && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span>{s.solicitanteTelefono}</span>
                      </div>
                    )}
                  </div>

                  {/* Acciones: ver foto, cancelar, eliminar. */}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {s.photoData && (
                      <button
                        type="button"
                        onClick={() => setFotoAbierta(s.photoData)}
                        className="relative shrink-0 group rounded-xl overflow-hidden"
                        title="Ver foto"
                      >
                        <img
                          src={s.photoData}
                          alt="Foto del residuo"
                          className="w-12 h-12 rounded-xl object-cover border border-gray-200"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/25 transition-colors">
                          <ImageIcon className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                        </span>
                      </button>
                    )}

                    {/* Cancelar solo tiene sentido si aún está activa. */}
                    {(s.status === 'pendiente' || s.status === 'agendada') && (
                      <button
                        type="button"
                        onClick={() => setConfirmAccion({ solicitud: s, tipo: 'cancelar' })}
                        className="inline-flex items-center gap-2 text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-4 py-2 rounded-full transition-colors"
                      >
                        <Ban className="w-4 h-4" />
                        Cancelar
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setConfirmAccion({ solicitud: s, tipo: 'eliminar' })}
                      className="inline-flex items-center gap-2 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-full transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Visor de foto (lightbox). Click en el fondo o en la X para cerrar. */}
      {fotoAbierta && (
        <div
          className="fixed inset-0 z-[3000] bg-black/80 flex items-center justify-center p-6"
          onClick={() => setFotoAbierta(null)}
        >
          <button
            type="button"
            onClick={() => setFotoAbierta(null)}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white"
            aria-label="Cerrar foto"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={fotoAbierta}
            alt="Foto del residuo"
            className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Diálogo de confirmación in-app (no window.confirm). Sirve para
          cancelar y para eliminar; el contenido se adapta al tipo de acción. */}
      {confirmAccion && (() => {
        const { solicitud: s, tipo } = confirmAccion;
        const esEliminar = tipo === 'eliminar';
        const enCurso = accionId === s.id;
        return (
          <div
            className="fixed inset-0 z-[3000] bg-black/50 flex items-center justify-center p-6"
            onClick={() => accionId === null && setConfirmAccion(null)}
          >
            <div
              className="bg-white rounded-[28px] shadow-2xl max-w-sm w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  esEliminar ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {esEliminar ? <Trash2 className="w-7 h-7" /> : <Ban className="w-7 h-7" />}
              </div>
              <h3 className="text-lg font-black text-gray-800 text-center">
                {esEliminar ? '¿Eliminar esta solicitud?' : '¿Cancelar esta solicitud?'}
              </h3>
              <p className="text-sm text-gray-500 text-center mt-2">
                {esEliminar
                  ? 'Esta acción es permanente y no se puede deshacer.'
                  : 'La solicitud quedará marcada como cancelada.'}
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setConfirmAccion(null)}
                  disabled={accionId !== null}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                >
                  No, volver
                </button>
                <button
                  type="button"
                  onClick={() => (esEliminar ? handleEliminar(s) : handleCancelar(s))}
                  disabled={accionId !== null}
                  className={`flex-1 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50 ${
                    esEliminar ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'
                  }`}
                >
                  {enCurso
                    ? esEliminar ? 'Eliminando…' : 'Cancelando…'
                    : esEliminar ? 'Sí, eliminar' : 'Sí, cancelar'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default MisSolicitudesView;
