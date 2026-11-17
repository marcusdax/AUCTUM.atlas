import { useEffect, useRef, useState, useCallback } from 'react';
import socketService from '../services/socket';
import { useConnectivityStore } from '../stores/connectivityStore';

export interface UseWebSocketOptions {
  room?: string;
  autoJoin?: boolean;
  debounce?: number;
  onError?: (error: Error) => void;
}

export interface UseWebSocketReturn<T = any> {
  isConnected: boolean;
  lastEvent: T | null;
  error: Error | null;
  emit: (event: string, data: any) => void;
  emitWithAck: (event: string, data: any) => Promise<any>;
}

export function useWebSocket<T = any>(
  eventName: string,
  callback: (data: T) => void,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn<T> {
  const { room, autoJoin = true, debounce = 0, onError } = options;
  const [isConnected, setIsConnected] = useState(socketService.isConnected());
  const [lastEvent, setLastEvent] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  const roomRef = useRef(room);
  const autoJoinRef = useRef(autoJoin);

  // Update refs when props change
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    autoJoinRef.current = autoJoin;
  }, [autoJoin]);

  // Sync connection state
  useEffect(() => {
    const handleStateChange = (state: string) => {
      setIsConnected(state === 'connected');
    };

    socketService.onReconnect(handleStateChange);
    setIsConnected(socketService.isConnected());

    return () => {
      socketService.offReconnect(handleStateChange);
    };
  }, []);

  // Handle room joining/leaving
  useEffect(() => {
    if (autoJoinRef.current && roomRef.current) {
      socketService.joinRoom(roomRef.current);
      return () => {
        if (roomRef.current) {
          socketService.leaveRoom(roomRef.current);
        }
      };
    }
  }, [autoJoin, room]);

  // Subscribe to events
  useEffect(() => {
    const handleEvent = (data: T) => {
      setLastEvent(data);
      setError(null);

      if (debounce > 0) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          try {
            callbackRef.current(data);
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            onError?.(error);
          }
        }, debounce);
      } else {
        try {
          callbackRef.current(data);
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
          onError?.(error);
        }
      }
    };

    socketService.on(eventName, handleEvent);

    return () => {
      socketService.off(eventName, handleEvent);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [eventName, debounce, onError]);

  // Handle connection errors
  useEffect(() => {
    const handleError = (err: Error) => {
      setError(err);
      onError?.(err);
    };

    socketService.on('error', handleError);
    socketService.on('connect_error', handleError);

    return () => {
      socketService.off('error', handleError);
      socketService.off('connect_error', handleError);
    };
  }, [onError]);

  const emit = useCallback((event: string, data: any) => {
    socketService.emit(event, data);
  }, []);

  const emitWithAck = useCallback(async (event: string, data: any) => {
    return socketService.emitWithAck(event, data);
  }, []);

  return {
    isConnected,
    lastEvent,
    error,
    emit,
    emitWithAck,
  };
}

// Hook for one-time event listener
export function useWebSocketOnce<T = any>(
  eventName: string,
  callback: (data: T) => void,
  options: Omit<UseWebSocketOptions, 'debounce'> = {}
): UseWebSocketReturn<T> {
  const { room, autoJoin = true, onError } = options;
  const [isConnected, setIsConnected] = useState(socketService.isConnected());
  const [lastEvent, setLastEvent] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleStateChange = (state: string) => {
      setIsConnected(state === 'connected');
    };

    socketService.onReconnect(handleStateChange);
    setIsConnected(socketService.isConnected());

    return () => {
      socketService.offReconnect(handleStateChange);
    };
  }, []);

  useEffect(() => {
    if (autoJoin && room) {
      socketService.joinRoom(room);
      return () => {
        if (room) {
          socketService.leaveRoom(room);
        }
      };
    }
  }, [autoJoin, room]);

  useEffect(() => {
    const handleEvent = (data: T) => {
      setLastEvent(data);
      setError(null);
      try {
        callback(data);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
      }
    };

    socketService.once(eventName, handleEvent);

    return () => {
      socketService.off(eventName, handleEvent);
    };
  }, [eventName, onError]);

  useEffect(() => {
    const handleError = (err: Error) => {
      setError(err);
      onError?.(err);
    };

    socketService.on('error', handleError);
    socketService.on('connect_error', handleError);

    return () => {
      socketService.off('error', handleError);
      socketService.off('connect_error', handleError);
    };
  }, [onError]);

  const emit = useCallback((event: string, data: any) => {
    socketService.emit(event, data);
  }, []);

  const emitWithAck = useCallback(async (event: string, data: any) => {
    return socketService.emitWithAck(event, data);
  }, []);

  return {
    isConnected,
    lastEvent,
    error,
    emit,
    emitWithAck,
  };
}