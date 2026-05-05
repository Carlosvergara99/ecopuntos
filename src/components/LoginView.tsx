import React from 'react';
import { Mail, Lock, ChevronRight, Recycle } from 'lucide-react';
import Button from './ui/Button';
import TextField from './ui/TextField';

interface LoginViewProps {
  onLogin: () => void;
  onRegisterClick: () => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin, onRegisterClick }) => {
  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] shadow-2xl overflow-hidden w-full max-w-md border border-green-100">
        {/* Header Section */}
        <div className="bg-green-600 p-10 flex flex-col items-center text-white text-center">
          <div className="bg-white p-4 rounded-3xl mb-4 shadow-xl">
            <Recycle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-1">EcoPuntos Bogotá</h1>
          <p className="text-green-50 opacity-90 text-sm">Gestión inteligente de residuos voluminosos</p>
        </div>

        {/* Form Section */}
        <div className="p-8">
          <div className="space-y-6">
            <TextField 
              label="Correo Electrónico"
              type="email"
              placeholder="ciudadano@bogota.gov.co"
              icon={<Mail className="w-5 h-5" />}
            />

            <TextField 
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              icon={<Lock className="w-5 h-5" />}
            />

            <Button 
              onClick={onLogin}
              fullWidth
              variant="secondary"
              rightIcon={<ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
              className="group py-5"
            >
              Ingresar a la Plataforma
            </Button>
          </div>

          <div className="mt-6 text-center">
            <button 
              onClick={onRegisterClick}
              className="text-sm text-green-600 font-semibold hover:underline"
            >
              ¿No tienes cuenta? Regístrate aquí
            </button>
          </div>

          {/* Footer Info */}
          <div className="mt-8 flex items-start gap-2 text-[10px] text-gray-400 leading-relaxed italic">

            <div className="bg-green-50 p-1 rounded-full text-green-500 mt-0.5">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.9L9.03 9.069a2.25 2.25 0 002.44 0L18.334 4.9A.75.75 0 0017.5 3.5H3a.75.75 0 00-.834 1.4z" />
                <path d="M18.334 6.132l-6.865 4.147a3.75 3.75 0 01-4.069 0L.5 6.132V13.5A2.25 2.25 0 002.75 15.75h14.5a2.25 2.25 0 002.25-2.25V6.132z" />
              </svg>
            </div>
            <p>
              Conforme a la Ley 1581 de 2012, no almacenamos datos personales sensibles. Tu privacidad está garantizada.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginView;

