import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'RECONNECTING';

export interface ConnectionQuality {
  rtt: number;
  packetLoss: number;
}

interface ConnectivityState {
  status: ConnectionStatus;
  lastConnected: number | null;
  disconnectReason: string | null;
  rooms: string[];
  connectionQuality: ConnectionQuality;
}

interface ConnectivityActions {
  setStatus: (status: ConnectionStatus) => void;
  setLastConnected: (timestamp: number) => void;
  setDisconnectReason: (reason: string | null) => void;
  addRoom: (room: string) => void;
  removeRoom: (room: string) => void;
  setRooms: (rooms: string[]) => void;
  setConnectionQuality: (quality: ConnectionQuality) => void;
  reset: () => void;
}

type ConnectivityStore = ConnectivityState & ConnectivityActions;

const initialState: ConnectivityState = {
  status: 'DISCONNECTED',
  lastConnected: null,
  disconnectReason: null,
  rooms: [],
  connectionQuality: { rtt: 0, packetLoss: 0 },
};

export const useConnectivityStore = create<ConnectivityStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setStatus: (status: ConnectionStatus) => {
        const previousStatus = get().status;
        set({ status });
        
        if (status === 'CONNECTED' && previousStatus !== 'CONNECTED') {
          set({ lastConnected: Date.now(), disconnectReason: null });
        }
      },

      setLastConnected: (timestamp: number) => {
        set({ lastConnected: timestamp });
      },

      setDisconnectReason: (reason: string | null) => {
        set({ disconnectReason: reason });
      },

      addRoom: (room: string) => {
        set((state) => ({
          rooms: state.rooms.includes(room) ? state.rooms : [...state.rooms, room],
        }));
      },

      removeRoom: (room: string) => {
        set((state) => ({
          rooms: state.rooms.filter((r) => r !== room),
        }));
      },

      setRooms: (rooms: string[]) => {
        set({ rooms });
      },

      setConnectionQuality: (quality: ConnectionQuality) => {
        set({ connectionQuality: quality });
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'atlas-helios-connectivity',
      partialize: (state) => ({
        lastConnected: state.lastConnected,
        disconnectReason: state.disconnectReason,
        rooms: state.rooms,
      }),
    }
  )
);

// Selector hooks
export const useConnectionStatus = () => 
  useConnectivityStore((state) => state.status);

export const useConnectionQuality = () => 
  useConnectivityStore((state) => state.connectionQuality);

export const useConnectedRooms = () => 
  useConnectivityStore((state) => state.rooms);

export const useDisconnectReason = () => 
  useConnectivityStore((state) => state.disconnectReason);

export const useLastConnected = () => 
  useConnectivityStore((state) => state.lastConnected);