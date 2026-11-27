import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  companyId: string;
  company: { id: string; name: string; subscriptionTier: string };
  avatarUrl?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateUser: (user: Partial<AuthUser>) => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await axios.post('/api/v1/auth/login', {
            email,
            password,
          });

          const { user, accessToken, refreshToken } = res.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);

          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (data) => {
        set({ isLoading: true });
        try {
          const res = await axios.post(`${API_BASE}/api/v1/auth/register`, data);
          const { user, accessToken, refreshToken } = res.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);

          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) {
          get().logout();
          return;
        }

        try {
          const res = await axios.post(`${API_BASE}/api/v1/auth/refresh`, {
            refreshToken,
          });

          const { accessToken: newAccess, refreshToken: newRefresh } = res.data;
          localStorage.setItem('accessToken', newAccess);
          localStorage.setItem('refreshToken', newRefresh || refreshToken);

          set({
            accessToken: newAccess,
            refreshToken: newRefresh || refreshToken,
          });
        } catch (error) {
          get().logout();
          throw error;
        }
      },

      loadUser: async () => {
        let token = localStorage.getItem('accessToken') || get().accessToken;
        const storedRefresh = localStorage.getItem('refreshToken') || get().refreshToken;

        if (!token && !storedRefresh) {
          set({ isAuthenticated: false, isLoading: false });
          return;
        }

        set({ isLoading: true });
        try {
          if (!token && storedRefresh) {
            await get().refreshAccessToken();
            token = localStorage.getItem('accessToken') || get().accessToken;
          }

          const fetchMe = (bearer: string) =>
            axios.get(`${API_BASE}/api/v1/auth/me`, {
              headers: { Authorization: `Bearer ${bearer}` },
            });

          try {
            const res = await fetchMe(token!);
            set({
              user: res.data.user,
              accessToken: token,
              isAuthenticated: true,
              isLoading: false,
            });
          } catch (meErr: any) {
            if (meErr?.response?.status === 401 && storedRefresh) {
              // Access token expired (e.g. >15m) or rotated across container rebuild — exchange refresh token silently
              const refreshRes = await axios.post(`${API_BASE}/api/v1/auth/refresh`, {
                refreshToken: storedRefresh,
              });
              const { accessToken: nextAccess, refreshToken: nextRefresh } = refreshRes.data;
              localStorage.setItem('accessToken', nextAccess);
              localStorage.setItem('refreshToken', nextRefresh || storedRefresh);
              const meRetry = await fetchMe(nextAccess);
              set({
                user: meRetry.data.user,
                accessToken: nextAccess,
                refreshToken: nextRefresh || storedRefresh,
                isAuthenticated: true,
                isLoading: false,
              });
              return;
            }
            throw meErr;
          }
        } catch (error) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      updateUser: (updates) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        }));
      },
    }),
    {
      name: 'roofpro-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
);

// Helper to get auth headers
export const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Helper to check if user has required role
export const hasRole = (requiredRoles: string[]): boolean => {
  const { user } = useAuthStore.getState();
  if (!user) return false;
  return requiredRoles.includes(user.role);
};
