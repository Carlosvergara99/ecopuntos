import { useState, useEffect } from 'react';
import LoginView from './components/LoginView';
import MapView from './components/MapView';
import RegisterView from './components/RegisterView';
import MisSolicitudesView from './components/MisSolicitudesView';
import Toaster from './components/ui/Toaster';
import { api, setToken, clearToken } from './lib/api';
import { toast } from './lib/toast';

type ViewState = 'login' | 'register' | 'map' | 'solicitudes';

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

function App() {
  const [currentView, setCurrentView] = useState<ViewState>(() => {
    const hash = window.location.hash.replace('#/', '');
    if (hash === 'register') return 'register';
    if (hash === 'map') return 'map';
    if (hash === 'solicitudes') return 'solicitudes';
    return 'login';
  });

  const [user, setUser] = useState<Usuario | null>(() => {
    const savedUser = localStorage.getItem('eco_user');
    return savedUser ? (JSON.parse(savedUser) as Usuario) : null;
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '');
      if (hash === 'register') setCurrentView('register');
      else if (hash === 'map') setCurrentView('map');
      else if (hash === 'solicitudes') setCurrentView('solicitudes');
      else setCurrentView('login');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (view: ViewState) => {
    window.location.hash = `#/${view}`;
  };

  const handleLogin = async (email: string, password: string) => {
    const { token, usuario } = await api<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(token);
    localStorage.setItem('eco_user', JSON.stringify(usuario));
    setUser(usuario);
    navigate('map');
    toast(`¡Hola, ${usuario.nombre}! 👋`, 'success');
  };

  const handleRegister = async (nombre: string, email: string, password: string) => {
    const { token, usuario } = await api<AuthResponse>('/api/auth/registro', {
      method: 'POST',
      body: JSON.stringify({ nombre, email, password }),
    });
    setToken(token);
    localStorage.setItem('eco_user', JSON.stringify(usuario));
    setUser(usuario);
    navigate('map');
    toast(`¡Bienvenido, ${usuario.nombre}! Tu cuenta fue creada.`, 'success');
  };

  // Llamado por GoogleSignInButton tras intercambiar el credential por JWT.
  // El token y eco_user ya fueron persistidos por el componente — aqui solo
  // sincronizamos el state de React y navegamos al mapa.
  const handleGoogleSuccess = (usuario: Usuario) => {
    setUser(usuario);
    navigate('map');
  };

  const handleLogout = () => {
    setUser(null);
    clearToken();
    localStorage.removeItem('eco_user');
    navigate('login');
  };

  // MapView todavía espera { name, email } (shape del compañero). Mapeamos.
  const userForMap = user ? { name: user.nombre, email: user.email } : null;

  return (
    <div className="w-full h-screen font-sans antialiased">
      <Toaster />

      {currentView === 'login' && (
        <LoginView
          onLogin={handleLogin}
          onGoogleSuccess={handleGoogleSuccess}
          onRegisterClick={() => navigate('register')}
        />
      )}

      {currentView === 'register' && (
        <RegisterView
          onRegister={handleRegister}
          onGoogleSuccess={handleGoogleSuccess}
          onBackToLogin={() => navigate('login')}
        />
      )}

      {currentView === 'map' && (
        <MapView onLogout={handleLogout} user={userForMap} />
      )}

      {currentView === 'solicitudes' && (
        <MisSolicitudesView onBack={() => navigate('map')} />
      )}
    </div>
  );
}

export default App;
