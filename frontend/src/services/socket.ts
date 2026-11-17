import { io, Socket } from 'socket.io-client';

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'failed' | 'reconnecting';

interface ConnectionQuality {
  rtt: number;
  packetLoss: number;
}

interface SocketEventMap {
  connect: (socketId: string, latency: number) => void;
  disconnect: (reason: string, code?: number) => void;
  connect_error: (error: Error) => void;
  error: (error: Error) => void;
  reconnect: (attemptNumber: number) => void;
  reconnect_attempt: (attemptNumber: number) => void;
  reconnect_failed: () => void;
}

type EventCallback = (data: any) => void;
type AcknowledgmentCallback = (response: any) => void;

class SocketService {
  private socket: Socket | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectionAttempts = 10;
  private reconnectDelays = [1000, 2000, 4000, 8000, 16000, 16000, 16000, 16000, 16000, 16000];
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private pingTimeout: ReturnType<typeof setTimeout> | null = null;
  private pongReceived = true;
  private connectionStartTime = 0;
  private rtt = 0;
  private packetLossCount = 0;
  private totalPings = 0;
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  private reconnectCallbacks: Set<(state: ConnectionState) => void> = new Set();
  private joinedRooms: Set<string> = new Set();
  private token: string | null = null;
  private socketUrl: string;

  constructor() {
    this.socketUrl = import.meta.env.VITE_SOCKET_URL || '';
  }

  private setConnectionState(state: ConnectionState) {
    if (this.connectionState !== state) {
      console.log(`[Socket] State change: ${this.connectionState} -> ${state}`);
      this.connectionState = state;
      this.notifyReconnectCallbacks(state);
    }
  }

  private notifyReconnectCallbacks(state: ConnectionState) {
    this.reconnectCallbacks.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        console.error('[Socket] Reconnect callback error:', error);
      }
    });
  }

  private setupSocketEvents() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      const latency = Date.now() - this.connectionStartTime;
      this.setConnectionState('connected');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      console.log(`[Socket] Connected: ${this.socket?.id}, latency: ${latency}ms`);
      this.emitInternal('connect', this.socket?.id || '', latency);
    });

    this.socket.on('disconnect', (reason: string) => {
      this.stopHeartbeat();
      this.setConnectionState('disconnected');
      console.log(`[Socket] Disconnected: ${reason}`);
      this.emitInternal('disconnect', reason);
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('[Socket] Connection error:', error.message);
      this.setConnectionState('failed');
      this.emitInternal('connect_error', error);
    });

    this.socket.on('error', (error: Error) => {
      console.error('[Socket] Server error:', error);
      this.emitInternal('error', error);
    });

    this.socket.on('reconnect', (attemptNumber: number) => {
      console.log(`[Socket] Reconnected after ${attemptNumber} attempts`);
      this.emitInternal('reconnect', attemptNumber);
    });

    this.socket.on('reconnect_attempt', (attemptNumber: number) => {
      console.log(`[Socket] Reconnection attempt ${attemptNumber}`);
      this.setConnectionState('reconnecting');
      this.emitInternal('reconnect_attempt', attemptNumber);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('[Socket] Reconnection failed after max attempts');
      this.setConnectionState('failed');
      this.emitInternal('reconnect_failed');
    });

    // Handle pong for heartbeat
    this.socket.on('pong', (timestamp: number) => {
      const now = Date.now();
      this.rtt = now - timestamp;
      this.pongReceived = true;
      this.totalPings++;
      console.log(`[Socket] Pong received, RTT: ${this.rtt}ms`);
    });
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (!this.socket || !this.socket.connected) {
        this.stopHeartbeat();
        return;
      }

      const timestamp = Date.now();
      this.pongReceived = false;
      this.socket.emit('ping', timestamp);

      this.pingTimeout = setTimeout(() => {
        if (!this.pongReceived) {
          this.packetLossCount++;
          console.warn('[Socket] Pong timeout, possible connection issue');
          this.socket?.disconnect();
        }
      }, 10000);
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout);
      this.pingTimeout = null;
    }
  }

  private getNextReconnectDelay(): number {
    const index = Math.min(this.reconnectAttempts, this.reconnectDelays.length - 1);
    return this.reconnectDelays[index];
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectionAttempts) {
      console.error('[Socket] Max reconnection attempts reached');
      this.setConnectionState('failed');
      return;
    }

    const delay = this.getNextReconnectDelay();
    this.reconnectAttempts++;
    console.log(`[Socket] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (this.token) {
        this.connect(this.token);
      }
    }, delay);
  }

  private emitInternal(event: string, ...args: any[]) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (callback as (...args: any[]) => void)(...args);
        } catch (error) {
          console.error(`[Socket] Event listener error for ${event}:`, error);
        }
      });
    }
  }

  connect(token: string) {
    this.token = token;
    this.connectionStartTime = Date.now();
    
    if (this.socket) {
      this.socket.disconnect();
    }

    this.setConnectionState('connecting');

    this.socket = io(this.socketUrl, {
      auth: { token },
      reconnection: false, // We handle reconnection manually
      transports: ['websocket', 'polling'],
      timeout: 20000,
    });

    this.setupSocketEvents();
    this.scheduleReconnect();

    return this.socket;
  }

  disconnect() {
    this.stopHeartbeat();
    this.token = null;
    this.joinedRooms.clear();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.setConnectionState('disconnected');
    this.reconnectAttempts = 0;
  }

  // Join a job's room for real-time feed updates
  joinJob(jobId: string) {
    const room = `job:${jobId}`;
    this.socket?.emit('join:job', jobId);
    this.joinedRooms.add(room);
  }

  leaveJob(jobId: string) {
    const room = `job:${jobId}`;
    this.socket?.emit('leave:job', jobId);
    this.joinedRooms.delete(room);
  }

  // Room management
  joinRoom(roomId: string) {
    this.socket?.emit('join:room', roomId);
    this.joinedRooms.add(roomId);
  }

  leaveRoom(roomId: string) {
    this.socket?.emit('leave:room', roomId);
    this.joinedRooms.delete(roomId);
  }

  getJoinedRooms(): string[] {
    return Array.from(this.joinedRooms);
  }

  // Emit a new feed post
  emitFeedPost(jobId: string, post: { content: string; attachmentUrls?: string[] }) {
    this.socket?.emit('feed:new_post', { jobId, ...post });
  }

  // Emit with acknowledgment support
  emit(event: string, data: any, callback?: AcknowledgmentCallback) {
    this.socket?.emit(event, data, callback);
  }

  // Emit with acknowledgment (Promise-based)
  emitWithAck(event: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.socket?.emit(event, data, (response: any) => {
        if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  // Listen for real-time events
  on(event: string, callback: EventCallback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
    
    // Also attach to socket if connected
    this.socket?.on(event, callback);
  }

  // One-time event listener
  once(event: string, callback: EventCallback) {
    const wrapper = (data: any) => {
      callback(data);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  off(event: string, callback?: EventCallback) {
    if (callback) {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.delete(callback);
      }
    } else {
      this.eventListeners.delete(event);
    }
    this.socket?.off(event, callback);
  }

  // Add reconnect callback for UI state updates
  onReconnect(callback: (state: ConnectionState) => void) {
    this.reconnectCallbacks.add(callback);
  }

  offReconnect(callback: (state: ConnectionState) => void) {
    this.reconnectCallbacks.delete(callback);
  }

  getSocket() {
    return this.socket;
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  isConnected(): boolean {
    return this.socket?.connected === true && this.connectionState === 'connected';
  }

  getConnectionQuality(): ConnectionQuality {
    const packetLoss = this.totalPings > 0 
      ? (this.packetLossCount / this.totalPings) * 100 
      : 0;
    return {
      rtt: this.rtt,
      packetLoss: Math.round(packetLoss * 100) / 100,
    };
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  getMaxReconnectionAttempts(): number {
    return this.maxReconnectionAttempts;
  }

  setMaxReconnectionAttempts(attempts: number) {
    this.maxReconnectionAttempts = Math.max(1, attempts);
    this.reconnectDelays = Array.from({ length: this.maxReconnectionAttempts }, (_, i) => 
      Math.min(1000 * Math.pow(2, i), 16000)
    );
  }
}

export default new SocketService();