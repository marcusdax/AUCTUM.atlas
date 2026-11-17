import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { setupAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  isLoaded: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { user, accessToken, isLoading, loadUser, login, register, logout } = useAuthStore();
  const navigate = useNavigate();

  const [isLoaded, setIsLoaded] = React.useState(false);

  useEffect(() => {
    const initAuth = async () => {
      await loadUser();
      setIsLoaded(true);
    };
    initAuth();
  }, [loadUser]);

  // Setup API interceptors and auth headers
  useEffect(() => {
    setupAPI(accessToken);
  }, [accessToken]);

  const handleLogin = async (email: string, password: string) => {
    await login(email, password);
    navigate('/');
  };

  const handleRegister = async (data: any) => {
    await register(data);
    navigate('/');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const value: AuthContextType = {
    isLoaded,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
