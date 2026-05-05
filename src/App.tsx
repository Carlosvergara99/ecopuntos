import { useState, useEffect } from 'react';
import LoginView from './components/LoginView';
import MapView from './components/MapView';
import RegisterView from './components/RegisterView';

type ViewState = 'login' | 'register' | 'map';

function App() {
  const [currentView, setCurrentView] = useState<ViewState>(() => {
    const hash = window.location.hash.replace('#/', '');
    if (hash === 'register') return 'register';
    if (hash === 'map') return 'map';
    return 'login';
  });
  
  const [user, setUser] = useState<{ name: string; email: string } | null>(() => {
    const savedUser = localStorage.getItem('eco_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '');
      if (hash === 'register') setCurrentView('register');
      else if (hash === 'map') setCurrentView('map');
      else setCurrentView('login');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (view: ViewState) => {
    window.location.hash = `#/${view}`;
  };

  const handleLogin = () => {
    const userData = { name: 'Ciudadano Bogotá', email: 'ciudadano@bogota.gov.co' };
    setUser(userData);
    localStorage.setItem('eco_user', JSON.stringify(userData));
    navigate('map');
  };

  const handleRegister = () => {
    const userData = { name: 'Nuevo Usuario', email: 'usuario@ejemplo.com' };
    setUser(userData);
    localStorage.setItem('eco_user', JSON.stringify(userData));
    navigate('map');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('eco_user');
    navigate('login');
  };

  return (
    <div className="w-full h-screen font-sans antialiased">
      {currentView === 'login' && (
        <LoginView 
          onLogin={handleLogin} 
          onRegisterClick={() => navigate('register')}
        />
      )}
      
      {currentView === 'register' && (
        <RegisterView 
          onRegister={handleRegister} 
          onBackToLogin={() => navigate('login')} 
        />
      )}

      {currentView === 'map' && (
        <MapView onLogout={handleLogout} user={user} />
      )}
    </div>
  );
}

export default App;


