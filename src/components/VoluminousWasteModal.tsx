import React, { useState } from 'react';
import { X, Truck, Package, Trash2, Calendar, MapPin, Camera } from 'lucide-react';
import Button from './ui/Button';
import IconButton from './ui/IconButton';
import TextField from './ui/TextField';

interface VoluminousWasteModalProps {
  onClose: () => void;
}

const VoluminousWasteModal: React.FC<VoluminousWasteModalProps> = ({ onClose }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    type: '',
    description: '',
    address: 'Calle 26 # 50-00, Bogotá',
    date: '',
    photoName: ''
  });

  const wasteTypes = [
    { id: 'muebles', name: 'Muebles', icon: <Package className="w-5 h-5" /> },
    { id: 'colchones', name: 'Colchones', icon: <Trash2 className="w-5 h-5" /> },
    { id: 'escombros', name: 'Escombros', icon: <Truck className="w-5 h-5" /> },
    { id: 'otros', name: 'Otros', icon: <Package className="w-5 h-5" /> },
  ];

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    const webhookUrl = import.meta.env.VITE_WEBHOOK_URL;

    try {
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'NEW_WASTE_COLLECTION_REQUEST',
            timestamp: new Date().toISOString(),
            data: formData
          })
        });
      }
      setIsSuccess(true);
    } catch (error) {
      console.error('Error sending webhook:', error);
      setIsSuccess(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => setStep(step + 1);
  const handleBack = () => setStep(step - 1);

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
                      multiline
                      placeholder="Ej: Un sofá viejo y dos sillas..."
                      rows={4}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Foto del residuo</label>
                      <input
                        type="file"
                        id="photo-upload"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setFormData({ ...formData, photoName: file.name });
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => document.getElementById('photo-upload')?.click()}
                        className="w-full h-32 border-2 border-dashed border-gray-200 rounded-[32px] flex flex-col items-center justify-center gap-3 text-gray-400 hover:text-blue-500 hover:border-blue-200 hover:bg-blue-50/50 transition-all group overflow-hidden"
                      >
                        <div className="p-3 bg-gray-50 rounded-full group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                          <Camera className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold">
                          {formData.photoName || 'Tomar o subir foto'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button onClick={handleBack} variant="ghost" className="flex-1">Atrás</Button>
                    <Button
                      onClick={handleNext}
                      disabled={!formData.description}
                      variant="primary"
                      className="flex-[2]"
                    >
                      Continuar
                    </Button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-gray-700">Lugar y Fecha</h4>
                    <p className="text-xs text-gray-500">¿Dónde debemos recogerlo?</p>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-blue-50/50 p-6 rounded-[32px] border border-blue-50 flex gap-4 items-center">
                      <div className="bg-white p-3 rounded-2xl text-blue-600 shadow-sm">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-blue-600/60 uppercase tracking-wider">Dirección Actual</p>
                        <p className="text-sm font-black text-gray-700">{formData.address}</p>
                      </div>
                    </div>

                    <TextField
                      label="¿Cuándo podemos pasar?"
                      type="date"
                      icon={<Calendar className="w-5 h-5 text-gray-400" />}
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>

                  {/* <div className="bg-emerald-50/50 p-4 rounded-2xl flex gap-3 items-center border border-emerald-50">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <p className="text-xs font-bold text-emerald-700">Servicio gratuito para ciudadanos</p>
                  </div> */}

                  <div className="flex gap-4 pt-4">
                    <Button onClick={handleBack} variant="ghost" className="flex-1">Atrás</Button>
                    <Button
                      onClick={handleConfirm}
                      disabled={!formData.date}
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
