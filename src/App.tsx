import React, { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import NotificationsPage from './pages/NotificationsPage';
import MainLayout from './components/MainLayout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeContextProvider } from './contexts/ThemeContext';

// Konsol uyarılarını azalt
const originalWarn = console.warn;
console.warn = (...args) => {
  // React Router deprecation uyarılarını bastır
  if (args[0] && typeof args[0] === 'string' && args[0].includes('React Router')) {
    return;
  }
  // React Beautiful DnD uyarılarını bastır
  if (args[0] && typeof args[0] === 'string' && (
    args[0].includes('Support for defaultProps') || 
    args[0].includes('Connect(Droppable)') ||
    args[0].includes('react-beautiful-dnd') ||
    args[0].includes('defaultProps will be removed')
  )) {
    return;
  }
  // Aria-hidden uyarılarını bastır
  if (args[0] && typeof args[0] === 'string' && args[0].includes('aria-hidden')) {
    return;
  }
  originalWarn.apply(console, args);
};

// React'in geliştirme modundaki warning sistemini de bastır
if (typeof window !== 'undefined') {
  const originalConsole = window.console;
  
  // React DevTools warning'lerini bastır
  const filterReactWarnings = (method: string) => {
    const original = originalConsole[method as keyof Console] as any;
    if (typeof original === 'function') {
      (window.console as any)[method] = (...args: any[]) => {
        // React Beautiful DnD warning'lerini bastır
        if (args[0] && typeof args[0] === 'string' && (
          args[0].includes('Support for defaultProps') || 
          args[0].includes('Connect(Droppable)') ||
          args[0].includes('react-beautiful-dnd') ||
          args[0].includes('defaultProps will be removed')
        )) {
          return;
        }
        return original.apply(originalConsole, args);
      };
    }
  };
  
  // Her console method'u için filtreyi uygula
  ['warn', 'error', 'log'].forEach(filterReactWarnings);
}

// Console.error için de aynı filtre
const originalError = console.error;
console.error = (...args) => {
  // Aria-hidden hatalarını bastır
  if (args[0] && typeof args[0] === 'string' && args[0].includes('aria-hidden')) {
    return;
  }
  // WebRTC screen share hatalarını bastır (geliştirme amaçlı)
  if (args[0] && typeof args[0] === 'string' && (
    args[0].includes('Screen share permission denied') ||
    args[0].includes('Error toggling screen share')
  )) {
    return;
  }
  originalError.apply(console, args);
};

const HomePage: React.FC = () => {
  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100%',
      color: 'text.secondary'
    }}>
      <Typography variant="h5">Ana Sayfa - Nexus'a Hoşgeldiniz</Typography>
    </Box>
  );
};

const AppContent: React.FC = () => {
  const { currentUser, userProfile, loading } = useAuth();
  const navigate = useNavigate();

  // Auth state değiştiğinde routing'i güncelle
  useEffect(() => {
    if (!loading) {
      // Sadece açık şekilde logout yapılmışsa yönlendir
      if (currentUser === null && userProfile === null) {
        navigate('/', { replace: true });
      }
    }
  }, [currentUser, userProfile, loading, navigate]);

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        width: '100vw', 
        height: '100vh',
        backgroundColor: '#36393f'
      }}>
        <CircularProgress sx={{ color: '#5865f2' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {currentUser && userProfile ? (
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>
        </Routes>
      ) : (
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      )}
    </Box>
  );
};

const App: React.FC = () => {
  return (
    <ThemeContextProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeContextProvider>
  );
};

export default App; 