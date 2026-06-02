import React, { useState } from 'react';
import { Mail, Lock, User, ChevronRight, Recycle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import Button from './ui/Button';
import TextField from './ui/TextField';
import GoogleSignInButton from './GoogleSignInButton';

interface Usuario {
  id: number;
  nombre: string;
  email: string;
  creado_en?: string;
}

interface RegisterViewProps {
  onRegister: (nombre: string, email: string, password: string) => Promise<void> | void;
  onGoogleSuccess: (usuario: Usuario) => void;
  onBackToLogin: () => void;
}

const RegisterView: React.FC<RegisterViewProps> = ({ onRegister, onGoogleSuccess, onBackToLogin }) => {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ nombre?: string; email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  // Mismas reglas que valida el backend (authController).
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validar = () => {
    const errs: { nombre?: string; email?: string; password?: string } = {};
    if (nombre.trim().length < 2) errs.nombre = 'Debe tener al menos 2 caracteres.';
    if (email.trim() === '') errs.email = 'El correo es obligatorio.';
    else if (!EMAIL_REGEX.test(email)) errs.email = 'Correo no válido (ej: nombre@dominio.com).';
    if (password.length < 6) errs.password = 'La contraseña debe tener al menos 6 caracteres.';
    return errs;
  };

  const handleSubmit = async () => {
    setError(null);
    const errs = validar();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setIsLoading(true);
    try {
      await onRegister(nombre, email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la cuenta.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] shadow-2xl overflow-hidden w-full max-w-md border border-green-100">
        <div className="bg-green-600 p-10 flex flex-col items-center text-white text-center">
          <div className="bg-white p-4 rounded-3xl mb-4 shadow-xl">
            <Recycle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-1">Crear cuenta</h1>
          <p className="text-green-50 opacity-90 text-sm">Únete a EcoPuntos Bogotá</p>
        </div>

        <div className="p-8">
          <div className="space-y-6">
            <TextField
              label="Nombre completo"
              requiredMark
              error={fieldErrors.nombre}
              type="text"
              placeholder="Tu nombre"
              icon={<User className="w-5 h-5" />}
              value={nombre}
              onChange={(e) => {
                setNombre((e.target as HTMLInputElement).value);
                setFieldErrors((prev) => ({ ...prev, nombre: undefined }));
              }}
            />

            <TextField
              label="Correo Electrónico"
              requiredMark
              error={fieldErrors.email}
              type="email"
              placeholder="ciudadano@bogota.gov.co"
              icon={<Mail className="w-5 h-5" />}
              value={email}
              onChange={(e) => {
                setEmail((e.target as HTMLInputElement).value);
                setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }}
            />

            <TextField
              label="Contraseña"
              requiredMark
              error={fieldErrors.password}
              type={showPassword ? 'text' : 'password'}
              placeholder="Mínimo 6 caracteres"
              icon={<Lock className="w-5 h-5" />}
              value={password}
              onChange={(e) => {
                setPassword((e.target as HTMLInputElement).value);
                setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="p-1 rounded-full hover:bg-gray-100 hover:text-gray-600"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              }
            />

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">
                {error}
              </p>
            )}

            <Button
              onClick={handleSubmit}
              fullWidth
              variant="secondary"
              isLoading={isLoading}
              rightIcon={<ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
              className="group py-5"
            >
              Crear cuenta
            </Button>

            {/* Separador "o continuar con" */}
            <div className="relative flex items-center">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="mx-3 text-[10px] text-gray-400 uppercase tracking-widest">o continuar con</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            <div className="flex justify-center">
              <GoogleSignInButton onSuccess={onGoogleSuccess} onError={setError} />
            </div>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={onBackToLogin}
              className="inline-flex items-center gap-1 text-sm text-green-600 font-semibold hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterView;
