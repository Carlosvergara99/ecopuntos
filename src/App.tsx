import { useState } from 'react';
import LoginView from './components/LoginView';
import MapView from './components/MapView';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  const handleLogin = () => {
    setIsAuthenticated(true);
    setUser({ name: 'Ciudadano Bogotá', email: 'ciudadano@bogota.gov.co' });
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <div className="w-full h-screen font-sans antialiased">
      {!isAuthenticated ? (
        <LoginView onLogin={handleLogin} />
      ) : (
        <MapView onLogout={handleLogout} user={user} />
      )}
    </div>
  );
}

export default App;
