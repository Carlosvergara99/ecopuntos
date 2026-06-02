import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { api, setToken } from '../lib/api';

interface Usuario {
  id: number;
  nombre: string;
  email: string;
  creado_en?: string;
}

interface AuthResponse {
  token: string;
  usuario: Usuario;
}

interface Props {
  onSuccess: (usuario: Usuario) => void;
  onError: (msg: string) => void;
}

const GoogleSignInButton: React.FC<Props> = ({ onSuccess, onError }) => {
  // Si no hay client id configurado, no renderizamos nada. La app sigue
  // funcionando con login/registro tradicional.
  const hasGoogle = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!hasGoogle) return null;

  return (
    <GoogleLogin
      onSuccess={async (response) => {
        if (!response.credential) {
          onError('Google no devolvió credencial.');
          return;
        }
        try {
          const { token, usuario } = await api<AuthResponse>('/api/auth/google', {
            method: 'POST',
            body: JSON.stringify({ credential: response.credential }),
          });
          setToken(token);
          localStorage.setItem('eco_user', JSON.stringify(usuario));
          onSuccess(usuario);
        } catch (err) {
          onError(err instanceof Error ? err.message : 'Error con Google Sign-in.');
        }
      }}
      onError={() => onError('No se pudo iniciar sesión con Google.')}
      theme="outline"
      size="large"
      text="continue_with"
      shape="rectangular"
      width="320"
    />
  );
};

export default GoogleSignInButton;
