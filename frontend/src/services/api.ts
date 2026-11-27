import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const API_BASE = import.meta.env.VITE_API_URL || '';

export { API_BASE };

// Resolve a (possibly relative) file URL to an absolute, directly-fetchable URL.
// `fileUrl` is stored as `/uploads/<filename>` on the backend.
export const resolveFileUrl = (fileUrl: string): string => {
  if (!fileUrl) return '';
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  return `${API_BASE}${fileUrl.startsWith('/') ? '' : `/`}${fileUrl}`;
};

// Create axios instance with interceptors
const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Let the browser set multipart/form-data (with boundary) for FormData payloads.
    if (config.data instanceof FormData) {
      config.headers.delete?.('Content-Type');
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401 and auto-refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}> = [];

const processQueue = (error: unknown, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue the request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post('/api/v1/auth/refresh', {
          refreshToken,
        });

        const { accessToken, refreshToken: nextRefreshToken } = response.data;
        localStorage.setItem('accessToken', accessToken);
        if (nextRefreshToken) {
          localStorage.setItem('refreshToken', nextRefreshToken);
        }
        useAuthStore.setState((state) => ({
          accessToken,
          refreshToken: nextRefreshToken || state.refreshToken,
        }));

        apiClient.defaults.headers.Authorization = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        processQueue(null, accessToken);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Convenience exports
export const api = apiClient;

export const setAuthToken = (token: string | null) => {
  if (token) {
    localStorage.setItem('accessToken', token);
    apiClient.defaults.headers.Authorization = `Bearer ${token}`;
  } else {
    localStorage.removeItem('accessToken');
    delete apiClient.defaults.headers.Authorization;
  }
};

export const setupAPI = (userToken: string | null) => {
  if (userToken) {
    apiClient.defaults.headers.Authorization = `Bearer ${userToken}`;
  }
};

export default apiClient;
