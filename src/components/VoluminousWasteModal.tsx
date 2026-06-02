import React, { useState } from 'react';
import { X, Truck, Package, Trash2, Calendar, MapPin, Camera, User as UserIcon, Phone, LocateFixed } from 'lucide-react';
import Button from './ui/Button';
import IconButton from './ui/IconButton';
import TextField from './ui/TextField';
import { api } from '../lib/api';
import { detectMyLocation } from '../lib/geo';
import { fileToCompressedDataUrl } from '../lib/image';
import { useMapContext } from './mapContextValue';

interface VoluminousWasteModalProps {
  onClose: () => void;
}

const VoluminousWasteModal: React.FC<VoluminousWasteModalProps> = ({ onClose }) => {
  // Pre-fill la direccion con la que el usuario busco en el mapa. Si no hay
  // busqueda, queda vacia y el usuario la tipea a mano.
  const { state: { searchResult } } = useMapContext();

  // Pre-fill el nombre con el del usuario logueado (puede editarlo).
  // El telefono no se guarda en la cuenta, asi que arranca vacio.
  const usuarioGuardado = (() => {
    try {
      const raw = localStorage.getItem('eco_user');
      return raw ? JSON.parse(raw) as { nombre?: string } : null;
    } catch {
      return null;
    }
  })();

  // Fecha mínima seleccionable = hoy (UTC, igual que valida el backend). Evita
  // que el usuario pueda siquiera elegir una fecha pasada en el calendario.
  const hoy = new Date().toISOString().slice(0, 10);

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    type: '',
    description: '',
    address: searchResult?.query ?? '',
    date: '',
    photoName: '',
    photoData: '', // data URL base64 de la foto ya comprimida (vacío si no hay).
    solicitanteNombre: usuarioGuardado?.nombre ?? '',
    solicitanteTelefono: '',
  });
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  // Lee el archivo, lo comprime/redimensiona en el cliente y lo guarda como
  // data URL en formData. Si algo falla, al menos conservamos el nombre.
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingPhoto(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setFormData((prev) => ({ ...prev, photoName: file.name, photoData: dataUrl }));
    } catch {
      setFormData((prev) => ({ ...prev, photoName: file.name, photoData: '' }));
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const wasteTypes = [
    { id: 'muebles', name: 'Muebles', icon: <Package className="w-5 h-5" /> },
    { id: 'colchones', name: 'Colchones', icon: <Trash2 className="w-5 h-5" /> },
    { id: 'escombros', name: 'Escombros', icon: <Truck className="w-5 h-5" /> },
    { id: 'otros', name: 'Otros', icon: <Package className="w-5 h-5" /> },
  ];

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Errores de validación por campo (mismas reglas que valida el backend).
  const [errores, setErrores] = useState<Record<string, string | undefined>>({});
  const limpiarError = (campo: string) =>
    setErrores((prev) => ({ ...prev, [campo]: undefined }));

  // Geolocalización para autocompletar la dirección de recolección.
  const [isLocating, setIsLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const handleUseMyLocation = async () => {
    setIsLocating(true);
    setLocateError(null);
    try {
      const place = await detectMyLocation();
      setFormData((prev) => ({ ...prev, address: place.name }));
    } catch (err) {
      setLocateError(err instanceof Error ? err.message : 'No pudimos obtener tu ubicación.');
    } finally {
      setIsLocating(false);
    }
  };

  // Valida los datos del paso 3 antes de enviar. Devuelve los errores.
  const validarPaso3 = () => {
    const e: Record<string, string> = {};
    if (formData.solicitanteNombre.trim().length < 2) e.solicitanteNombre = 'Debe tener al menos 2 caracteres.';
    if (formData.solicitanteTelefono.replace(/\D/g, '').length < 7) e.solicitanteTelefono = 'Debe tener al menos 7 dígitos.';
    if (formData.address.trim().length < 5) e.address = 'Debe tener al menos 5 caracteres.';
    if (!formData.date) e.date = 'Selecciona una fecha.';
    else if (formData.date < hoy) e.date = 'La fecha no puede ser pasada.';
    return e;
  };

  const handleConfirm = async () => {
    const e = validarPaso3();
    setErrores(e);
    if (Object.keys(e).length > 0) return; // mostramos los errores y no enviamos
    setIsLoading(true);
    setError(null);
    try {
      await api('/api/solicitudes', {
        method: 'POST',
        body: JSON.stringify({
          type: formData.type,
          description: formData.description,
          address: formData.address,
          date: formData.date,
          photoName: formData.photoName || undefined,
          photoData: formData.photoData || undefined,
          solicitanteNombre: formData.solicitanteNombre,
          solicitanteTelefono: formData.solicitanteTelefono,
        }),
      });
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la solicitud.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => setStep(step + 1);
  const handleBack = () => setStep(step - 1);

  // Paso 2 → 3: valida la descripción antes de avanzar.
  const handleContinuar = () => {
    const e: Record<string, string> = {};
    if (formData.description.trim().length < 5) e.description = 'Debe tener al menos 5 caracteres.';
    setErrores(e);
    if (Object.keys(e).length === 0) handleNext();
  };

  return (
    <div className="absolute inset-0 z-[2000] flex items-end sm:items-stretch justify-end bg-black/20 backdrop-blur-[2px] transition-all duration-500">
      <div className="bg-white w-full max-w-md sm:h-full shadow-2xl overflow-hidden animate-drawer-enter flex flex-col rounded-t-[32px] sm:rounded-l-[40px] sm:rounded-tr-none">

        {/* Header & Progress */}
        {!isSuccess && (
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white p-6 pb-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold">Agendar recolección</h3>
                <p className="text-blue-100 text-xs opacity-80">Gestión de Residuos Voluminosos</p>
              </div>
              <IconButton
                icon={<X className="w-5 h-5" />}
                onClick={onClose}
                variant="glass"
              />
            </div>

            {/* Progress Bar */}
            <div className="flex gap-2 h-1.5 px-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-white' : 'bg-white/20'
                    }`}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto flex flex-col">
          {isSuccess ? (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-2">
                <Package className="w-12 h-12" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-gray-800">¡Todo listo!</h3>
                <p className="text-gray-500 text-sm">Tu solicitud ha sido registrada correctamente. Un equipo se pondrá en contacto pronto.</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-[32px] w-full text-left space-y-4 border border-gray-100">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400 font-bold uppercase">Tipo</span>
                  <span className="text-gray-700 font-black uppercase">{formData.type}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400 font-bold uppercase">Fecha</span>
                  <span className="text-gray-700 font-black">{formData.date}</span>
                </div>
              </div>
              <Button onClick={onClose} fullWidth variant="secondary" className="py-5">
                Volver al Mapa
              </Button>
            </div>
          ) : (
            <div className="p-8 space-y-8 flex-1">
              {step === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-gray-700">¿Qué quieres entregar?</h4>
                    <p className="text-xs text-gray-500">Selecciona la categoría del residuo.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {wasteTypes.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => {
                          setFormData({ ...formData, type: type.id });
                          handleNext();
                        }}
                        className={`p-6 rounded-[32px] border-2 transition-all flex flex-col items-center gap-4 group ${formData.type === type.id
                          ? 'border-blue-600 bg-blue-50/50 text-blue-600 shadow-xl shadow-blue-50'
                          : 'border-gray-50 bg-gray-50/50 hover:border-blue-200 text-gray-400 hover:text-blue-500'
                          }`}
                      >
                        <div className={`p-4 rounded-2xl transition-all duration-300 ${formData.type === type.id ? 'bg-blue-600 text-white scale-110' : 'bg-white text-gray-400 group-hover:scale-110'
                          }`}>
                          {type.icon}
                        </div>
                        <span className="text-sm font-bold">{type.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-gray-700">Detalles del residuo</h4>
                    <p className="text-xs text-gray-500">Danos más información para el equipo.</p>
                  </div>

                  <div className="space-y-6">
                    <TextField
                      label="Descripción de los objetos"
                      requiredMark
                      error={errores.description}
                      multiline
                      placeholder="Ej: Un sofá viejo y dos sillas... (mínimo 5 caracteres)"
                      rows={4}
                      value={formData.description}
                      onChange={(e) => {
                        setFormData({ ...formData, description: e.target.value });
                        limpiarError('description');
                      }}
                    />

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Foto del residuo</label>
                      <input
                        type="file"
                        id="photo-upload"
                        className="hidden"
                        accept="image/*"
                        onChange={handlePhotoChange}
                      />
                      <button
                        type="button"
                        onClick={() => document.getElementById('photo-upload')?.click()}
                        className="w-full h-32 border-2 border-dashed border-gray-200 rounded-[32px] flex flex-col items-center justify-center gap-3 text-gray-400 hover:text-blue-500 hover:border-blue-200 hover:bg-blue-50/50 transition-all group overflow-hidden p-2"
                      >
                        {formData.photoData ? (
                          <img
                            src={formData.photoData}
                            alt="Vista previa del residuo"
                            className="h-full w-full object-cover rounded-[24px]"
                          />
                        ) : (
                          <>
                            <div className="p-3 bg-gray-50 rounded-full group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                              <Camera className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-bold">
                              {isProcessingPhoto ? 'Procesando…' : 'Tomar o subir foto'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button onClick={handleBack} variant="ghost" className="flex-1">Atrás</Button>
                    <Button
                      onClick={handleContinuar}
                      variant="primary"
                      className="flex-[2]"
                    >
                      Continuar
                    </Button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-gray-700">Datos de contacto y recolección</h4>
                    <p className="text-xs text-gray-500">¿Quién es el contacto y a dónde vamos?</p>
                  </div>

                  <div className="space-y-5">
                    <TextField
                      label="Nombre completo"
                      requiredMark
                      error={errores.solicitanteNombre}
                      type="text"
                      placeholder="Nicolas Pulido"
                      icon={<UserIcon className="w-5 h-5 text-gray-400" />}
                      value={formData.solicitanteNombre}
                      onChange={(e) => {
                        setFormData({ ...formData, solicitanteNombre: (e.target as HTMLInputElement).value });
                        limpiarError('solicitanteNombre');
                      }}
                    />

                    <TextField
                      label="Celular"
                      requiredMark
                      error={errores.solicitanteTelefono}
                      type="tel"
                      placeholder="300 123 4567 (mínimo 7 dígitos)"
                      icon={<Phone className="w-5 h-5 text-gray-400" />}
                      value={formData.solicitanteTelefono}
                      onChange={(e) => {
                        setFormData({ ...formData, solicitanteTelefono: (e.target as HTMLInputElement).value });
                        limpiarError('solicitanteTelefono');
                      }}
                    />

                    <div className="space-y-2">
                      <TextField
                        label="Dirección de recolección"
                        requiredMark
                        error={errores.address}
                        type="text"
                        placeholder="Carrera 11 # 127-50"
                        icon={<MapPin className="w-5 h-5 text-gray-400" />}
                        value={formData.address}
                        onChange={(e) => {
                          setFormData({ ...formData, address: (e.target as HTMLInputElement).value });
                          limpiarError('address');
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleUseMyLocation}
                        disabled={isLocating}
                        className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50 px-1"
                      >
                        <LocateFixed className="w-4 h-4" />
                        {isLocating ? 'Detectando…' : 'Usar mi ubicación actual'}
                      </button>
                      {locateError && (
                        <p className="text-xs text-red-600 px-1">{locateError}</p>
                      )}
                    </div>

                    <TextField
                      label="¿Cuándo podemos pasar?"
                      requiredMark
                      error={errores.date}
                      type="date"
                      min={hoy}
                      icon={<Calendar className="w-5 h-5 text-gray-400" />}
                      value={formData.date}
                      onChange={(e) => {
                        setFormData({ ...formData, date: e.target.value });
                        limpiarError('date');
                      }}
                    />
                  </div>

                  {/* <div className="bg-emerald-50/50 p-4 rounded-2xl flex gap-3 items-center border border-emerald-50">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <p className="text-xs font-bold text-emerald-700">Servicio gratuito para ciudadanos</p>
                  </div> */}

                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">
                      {error}
                    </p>
                  )}

                  <div className="flex gap-4 pt-4">
                    <Button onClick={handleBack} variant="ghost" className="flex-1">Atrás</Button>
                    <Button
                      onClick={handleConfirm}
                      isLoading={isLoading}
                      variant="secondary"
                      className="flex-[2]"
                    >
                      Confirmar Solicitud
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoluminousWasteModal;
