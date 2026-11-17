import { useEffect, useState, useCallback, useRef } from 'react';
import socketService from '../services/socket';
import { useConnectivityStore } from '../stores/connectivityStore';

export interface UseSocketRoomOptions {
  autoJoin?: boolean;
  onRoomEvent?: (event: string, data: any) => void;
  onError?: (error: Error) => void;
}

export interface UseSocketRoomReturn {
  roomId: string | null;
  isConnected: boolean;
  isJoined: boolean;
  joinedRooms: string[];
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  leaveCurrentRoom: () => void;
  emit: (event: string, data: any) => void;
  emitWithAck: (event: string, data: any) => Promise<any>;
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string, callback?: (data: any) => void) => void;
  once: (event: string, callback: (data: any) => void) => void;
  error: Error | null;
}

/**
 * Hook for managing room-based WebSocket subscriptions.
 * Handles joining/leaving rooms and room-specific events.
 */
export function useSocketRoom(
  roomId: string | null = null,
  options: UseSocketRoomOptions = {}
): UseSocketRoomReturn {
  const { autoJoin = true, onRoomEvent, onError } = options;
  const [isConnected, setIsConnected] = useState(socketService.isConnected());
  const [isJoined, setIsJoined] = useState(false);
  const [joinedRooms, setJoinedRooms] = useState<string[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(roomId);
  
  const roomEventHandlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const autoJoinRef = useRef(autoJoin);
  const roomIdRef = useRef(roomId);

  // Update refs
  useEffect(() => {
    autoJoinRef.current = autoJoin;
  }, [autoJoin]);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  // Sync connection state
  useEffect(() => {
    const handleStateChange = (state: string) => {
      setIsConnected(state === 'connected');
      if (state === 'connected' && currentRoomId) {
        // Re-join room on reconnection
        socketService.joinRoom(currentRoomId);
        setIsJoined(true);
      } else if (state !== 'connected') {
        setIsJoined(false);
      }
    };

    socketService.onReconnect(handleStateChange);
    setIsConnected(socketService.isConnected());

    return () => {
      socketService.offReconnect(handleStateChange);
    };
  }, [currentRoomId]);

  // Sync joined rooms from socket service
  useEffect(() => {
    const syncRooms = () => {
      const rooms = socketService.getJoinedRooms();
      setJoinedRooms(rooms);
      if (roomIdRef.current) {
        setIsJoined(rooms.includes(roomIdRef.current));
      }
    };

    // Initial sync
    syncRooms();

    // Listen for room changes
    const handleRoomChange = () => syncRooms();
    socketService.on('room:joined', handleRoomChange);
    socketService.on('room:left', handleRoomChange);

    return () => {
      socketService.off('room:joined', handleRoomChange);
      socketService.off('room:left', handleRoomChange);
    };
  }, []);

  // Auto-join room on mount or when roomId changes
  useEffect(() => {
    if (autoJoinRef.current && roomIdRef.current) {
      joinRoom(roomIdRef.current);
    }

    return () => {
      if (roomIdRef.current) {
        socketService.leaveRoom(roomIdRef.current);
        setIsJoined(false);
      }
    };
  }, [roomId, autoJoin]);

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

  // Handle room events
  useEffect(() => {
    if (!onRoomEvent) return;

    const handleRoomEvent = (event: string, data: any) => {
      onRoomEvent(event, data);
    };

    // We can't easily listen to all events, so we expose on/off methods
    // This effect just sets up the error handler
  }, [onRoomEvent]);

  const joinRoom = useCallback((roomId: string) => {
    if (!socketService.isConnected()) {
      const err = new Error('Cannot join room: not connected');
      setError(err);
      onError?.(err);
      return;
    }

    socketService.joinRoom(roomId);
    setCurrentRoomId(roomId);
    setIsJoined(true);
    setJoinedRooms(socketService.getJoinedRooms());
  }, [onError]);

  const leaveRoom = useCallback((roomId: string) => {
    socketService.leaveRoom(roomId);
    setJoinedRooms(socketService.getJoinedRooms());
    if (currentRoomId === roomId) {
      setIsJoined(false);
      setCurrentRoomId(null);
    }
  }, []);

  const leaveCurrentRoom = useCallback(() => {
    if (currentRoomId) {
      leaveRoom(currentRoomId);
    }
  }, [currentRoomId, leaveRoom]);

  const emit = useCallback((event: string, data: any) => {
    socketService.emit(event, data);
  }, []);

  const emitWithAck = useCallback(async (event: string, data: any) => {
    return socketService.emitWithAck(event, data);
  }, []);

  const on = useCallback((event: string, callback: (data: any) => void) => {
    socketService.on(event, callback);
    
    // Track handlers for cleanup
    if (!roomEventHandlersRef.current.has(event)) {
      roomEventHandlersRef.current.set(event, new Set());
    }
    roomEventHandlersRef.current.get(event)!.add(callback);
  }, []);

  const off = useCallback((event: string, callback?: (data: any) => void) => {
    socketService.off(event, callback);
    
    if (callback) {
      roomEventHandlersRef.current.get(event)?.delete(callback);
    } else {
      roomEventHandlersRef.current.delete(event);
    }
  }, []);

  const once = useCallback((event: string, callback: (data: any) => void) => {
    socketService.once(event, callback);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up all tracked event handlers
      roomEventHandlersRef.current.forEach((handlers, event) => {
        handlers.forEach(handler => {
          socketService.off(event, handler);
        });
      });
      roomEventHandlersRef.current.clear();
      
      if (currentRoomId) {
        socketService.leaveRoom(currentRoomId);
      }
    };
  }, [currentRoomId]);

  return {
    roomId: currentRoomId,
    isConnected,
    isJoined,
    joinedRooms,
    joinRoom,
    leaveRoom,
    leaveCurrentRoom,
    emit,
    emitWithAck,
    on,
    off,
    once,
    error,
  };
}

/**
 * Hook for managing multiple rooms at once
 */
export function useSocketRooms(
  roomIds: string[],
  options: Omit<UseSocketRoomOptions, 'autoJoin'> = {}
): UseSocketRoomReturn {
  const { onRoomEvent, onError } = options;
  const [isConnected, setIsConnected] = useState(socketService.isConnected());
  const [joinedRooms, setJoinedRooms] = useState<string[]>([]);
  const [error, setError] = useState<Error | null>(null);

  // Sync connection state
  useEffect(() => {
    const handleStateChange = (state: string) => {
      setIsConnected(state === 'connected');
      if (state === 'connected') {
        // Re-join all rooms on reconnection
        roomIds.forEach(roomId => socketService.joinRoom(roomId));
      }
    };

    socketService.onReconnect(handleStateChange);
    setIsConnected(socketService.isConnected());

    return () => {
      socketService.offReconnect(handleStateChange);
    };
  }, [roomIds]);

  // Sync joined rooms
  useEffect(() => {
    const syncRooms = () => {
      setJoinedRooms(socketService.getJoinedRooms());
    };

    syncRooms();
    const handleRoomChange = () => syncRooms();
    socketService.on('room:joined', handleRoomChange);
    socketService.on('room:left', handleRoomChange);

    return () => {
      socketService.off('room:joined', handleRoomChange);
      socketService.off('room:left', handleRoomChange);
    };
  }, []);

  // Auto-join rooms
  useEffect(() => {
    roomIds.forEach(roomId => socketService.joinRoom(roomId));
    return () => {
      roomIds.forEach(roomId => socketService.leaveRoom(roomId));
    };
  }, [roomIds]);

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

  const joinRoom = useCallback((roomId: string) => {
    if (!socketService.isConnected()) {
      const err = new Error('Cannot join room: not connected');
      setError(err);
      onError?.(err);
      return;
    }
    socketService.joinRoom(roomId);
    setJoinedRooms(socketService.getJoinedRooms());
  }, [onError]);

  const leaveRoom = useCallback((roomId: string) => {
    socketService.leaveRoom(roomId);
    setJoinedRooms(socketService.getJoinedRooms());
  }, []);

  const leaveCurrentRoom = useCallback(() => {
    // No current room in multi-room mode
  }, []);

  const emit = useCallback((event: string, data: any) => {
    socketService.emit(event, data);
  }, []);

  const emitWithAck = useCallback(async (event: string, data: any) => {
    return socketService.emitWithAck(event, data);
  }, []);

  const on = useCallback((event: string, callback: (data: any) => void) => {
    socketService.on(event, callback);
  }, []);

  const off = useCallback((event: string, callback?: (data: any) => void) => {
    socketService.off(event, callback);
  }, []);

  const once = useCallback((event: string, callback: (data: any) => void) => {
    socketService.once(event, callback);
  }, []);

  return {
    roomId: roomIds[0] || null,
    isConnected,
    isJoined: roomIds.length > 0 && roomIds.every(r => joinedRooms.includes(r)),
    joinedRooms,
    joinRoom,
    leaveRoom,
    leaveCurrentRoom,
    emit,
    emitWithAck,
    on,
    off,
    once,
    error,
  };
}