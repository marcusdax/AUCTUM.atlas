import React, { createContext, useContext, useEffect, useCallback, ReactNode, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useConnectivityStore } from '../../stores/connectivityStore';
import socketService from '../../services/socket';

interface SocketContextType {
  socket: typeof socketService;
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'RECONNECTING';
  isOnline: boolean;
  connectionQuality: { rtt: number; packetLoss: number };
  reconnect: () => void;
  // Legacy methods for backward compatibility
  joinJob: (jobId: string) => void;
  leaveJob: (jobId: string) => void;
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string, callback?: (data: any) => void) => void;
  emitFeedPost: (jobId: string, post: { content: string; attachmentUrls?: string[] }) => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const { accessToken, isAuthenticated, logout, refreshAccessToken } = useAuthStore();
  const { setStatus, setDisconnectReason, setConnectionQuality, setRooms } = useConnectivityStore();
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'RECONNECTING'>('DISCONNECTED');
  const [connectionQuality, setConnectionQualityState] = useState({ rtt: 0, packetLoss: 0 });
  const [showOfflineWarning, setShowOfflineWarning] = useState(false);
  const isMountedRef = React.useRef(true);
  const reconnectTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineWarning(false);
      // Trigger reconnection if authenticated
      if (isAuthenticated && accessToken) {
        socketService.connect(accessToken);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineWarning(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isAuthenticated, accessToken]);

  // Handle socket connection state changes
  useEffect(() => {
    if (!isMountedRef.current) return;

    const handleStateChange = (state: string) => {
      if (!isMountedRef.current) return;
      
      switch (state) {
        case 'connecting':
          setStatus('CONNECTING');
          setConnectionStatus('CONNECTING');
          break;
        case 'connected':
          setStatus('CONNECTED');
          setConnectionStatus('CONNECTED');
          setShowOfflineWarning(false);
          break;
        case 'reconnecting':
          setStatus('RECONNECTING');
          setConnectionStatus('RECONNECTING');
          break;
        case 'disconnected':
          setStatus('DISCONNECTED');
          setConnectionStatus('DISCONNECTED');
          break;
        case 'failed':
          setStatus('DISCONNECTED');
          setConnectionStatus('DISCONNECTED');
          break;
      }
    };

    socketService.onReconnect(handleStateChange);
    setConnectionStatus(socketService.isConnected() ? 'CONNECTED' : 'DISCONNECTED');
    setStatus(socketService.isConnected() ? 'CONNECTED' : 'DISCONNECTED');

    return () => {
      socketService.offReconnect(handleStateChange);
    };
  }, [setStatus]);

  // Track connection quality
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isMountedRef.current) return;
      
      const quality = socketService.getConnectionQuality();
      setConnectionQuality(quality);
      setConnectionQualityState(quality);
    }, 5000);

    return () => clearInterval(interval);
  }, [setConnectionQuality]);

  // Track joined rooms
  useEffect(() => {
    const syncRooms = () => {
      if (!isMountedRef.current) return;
      setRooms(socketService.getJoinedRooms());
    };

    syncRooms();
    const handleRoomChange = () => syncRooms();
    socketService.on('room:joined', handleRoomChange);
    socketService.on('room:left', handleRoomChange);

    return () => {
      socketService.off('room:joined', handleRoomChange);
      socketService.off('room:left', handleRoomChange);
    };
  }, [setRooms]);

  // Handle disconnect reason
  useEffect(() => {
    const handleDisconnect = (reason: string) => {
      setDisconnectReason(reason);
    };

    socketService.on('disconnect', handleDisconnect);
    return () => socketService.off('disconnect', handleDisconnect);
  }, [setDisconnectReason]);

  // Handle auth token refresh and reconnection
  const handleReconnect = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      // Refresh token before reconnecting
      await refreshAccessToken();
      
      // Get fresh token from store
      const { accessToken: newToken } = useAuthStore.getState();
      if (newToken) {
        socketService.connect(newToken);
      }
    } catch (error) {
      console.error('[SocketProvider] Failed to refresh token for reconnection:', error);
      logout();
    }
  }, [isAuthenticated, refreshAccessToken, logout]);

  // Main connection effect
  useEffect(() => {
    if (!isMountedRef.current) return;

    if (isAuthenticated && accessToken && isOnline) {
      socketService.connect(accessToken);
    } else if (!isAuthenticated || !isOnline) {
      socketService.disconnect();
    }

    // Handle auth errors
    const handleAuthError = () => {
      logout();
    };

    socketService.on('auth:error', handleAuthError);
    socketService.on('connect_error', (error: Error) => {
      if (error.message.includes('auth') || error.message.includes('unauthorized')) {
        handleAuthError();
      }
    });

    return () => {
      socketService.off('auth:error', handleAuthError);
      socketService.off('connect_error', handleAuthError);
    };
  }, [isAuthenticated, accessToken, isOnline, logout]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      // Clear any pending reconnect timeouts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      // Leave all rooms
      const rooms = socketService.getJoinedRooms();
      rooms.forEach(room => socketService.leaveRoom(room));

      // Remove all listeners
      socketService.off('connect');
      socketService.off('disconnect');
      socketService.off('connect_error');
      socketService.off('error');
      socketService.off('reconnect');
      socketService.off('reconnect_attempt');
      socketService.off('reconnect_failed');
      socketService.off('pong');
      socketService.off('room:joined');
      socketService.off('room:left');
      socketService.off('auth:error');
      
      // Disconnect socket
      socketService.disconnect();
    };
  }, []);

  const contextValue: SocketContextType = {
    socket: socketService,
    connectionStatus,
    isOnline,
    connectionQuality,
    reconnect: handleReconnect,
    // Legacy methods for backward compatibility
    joinJob: (jobId: string) => socketService.joinJob(jobId),
    leaveJob: (jobId: string) => socketService.leaveJob(jobId),
    on: (event: string, callback: (data: any) => void) => socketService.on(event, callback),
    off: (event: string, callback?: (data: any) => void) => socketService.off(event, callback),
    emitFeedPost: (jobId: string, post: { content: string; attachmentUrls?: string[] }) => socketService.emitFeedPost(jobId, post),
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
      {/* Offline warning banner */}
      {showOfflineWarning && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            background: '#f59e0b',
            color: 'white',
            padding: '8px 16px',
            textAlign: 'center',
            fontSize: '14px',
            fontWeight: 500,
            zIndex: 9999,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
          role="alert"
          aria-live="polite"
        >
          You're offline. Some features may be unavailable. Showing cached data.
        </div>
      )}
      {/* Connection quality indicator */}
      {connectionStatus === 'CONNECTED' && connectionQuality.packetLoss > 10 && (
        <div
          style={{
            position: 'fixed',
            top: showOfflineWarning ? 48 : 0,
            right: 16,
            background: '#ef4444',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 500,
            zIndex: 9998,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
          role="status"
          aria-live="polite"
        >
          Poor connection: {Math.round(connectionQuality.packetLoss)}% packet loss, {connectionQuality.rtt}ms latency
        </div>
      )}
      {/* Reconnecting indicator */}
      {connectionStatus === 'RECONNECTING' && (
        <div
          style={{
            position: 'fixed',
            top: showOfflineWarning ? 48 : 0,
            right: 16,
            background: '#3b82f6',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 500,
            zIndex: 9998,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            animation: 'pulse 1.5s infinite',
          }}
          role="status"
          aria-live="polite"
        >
          Reconnecting...
        </div>
      )}
      </SocketContext.Provider>
  );
};