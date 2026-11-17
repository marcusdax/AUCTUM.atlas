/**
 * IntelligenceLayerProvider — Context provider for cross-cutting intelligence state
 * 
 * Tracks:
 * - connectivity state (LIVE/SYNCING/STALE/DEGRADED/OFFLINE) per layer
 * - lastUpdate timestamps per layer
 * - data freshness per layer (0-100%)
 * Provides useIntelligenceLayer hook for consuming components
 * Uses React Context + useReducer for state management
 */

import React, { createContext, useContext, useReducer, useCallback, useMemo, ReactNode } from 'react';

export type LayerStatus = 'LIVE' | 'SYNCING' | 'STALE' | 'DEGRADED' | 'OFFLINE';

export interface LayerState {
  status: LayerStatus;
  lastUpdate: string | null;
  freshness: number; // 0-100
}

export interface IntelligenceLayerState {
  layers: Record<string, LayerState>;
}

export type IntelligenceLayerAction =
  | { type: 'SET_LAYER_STATUS'; layerId: string; status: LayerStatus }
  | { type: 'SET_LAYER_LAST_UPDATE'; layerId: string; timestamp: string }
  | { type: 'SET_LAYER_FRESHNESS'; layerId: string; freshness: number }
  | { type: 'SET_LAYER_STATE'; layerId: string; state: Partial<LayerState> }
  | { type: 'INITIALIZE_LAYERS'; layers: Record<string, LayerState> }
  | { type: 'RESET_LAYER'; layerId: string };

const DEFAULT_LAYER_STATE: LayerState = {
  status: 'OFFLINE',
  lastUpdate: null,
  freshness: 0,
};

const INITIAL_STATE: IntelligenceLayerState = {
  layers: {
    atlas: DEFAULT_LAYER_STATE,
    helios: DEFAULT_LAYER_STATE,
    command: DEFAULT_LAYER_STATE,
    intelligence: DEFAULT_LAYER_STATE,
    system: DEFAULT_LAYER_STATE,
  },
};

function intelligenceLayerReducer(state: IntelligenceLayerState, action: IntelligenceLayerAction): IntelligenceLayerState {
  switch (action.type) {
    case 'SET_LAYER_STATUS': {
      const currentLayer = state.layers[action.layerId] || DEFAULT_LAYER_STATE;
      return {
        ...state,
        layers: {
          ...state.layers,
          [action.layerId]: {
            ...currentLayer,
            status: action.status,
          },
        },
      };
    }
    case 'SET_LAYER_LAST_UPDATE': {
      const currentLayer = state.layers[action.layerId] || DEFAULT_LAYER_STATE;
      return {
        ...state,
        layers: {
          ...state.layers,
          [action.layerId]: {
            ...currentLayer,
            lastUpdate: action.timestamp,
          },
        },
      };
    }
    case 'SET_LAYER_FRESHNESS': {
      const currentLayer = state.layers[action.layerId] || DEFAULT_LAYER_STATE;
      return {
        ...state,
        layers: {
          ...state.layers,
          [action.layerId]: {
            ...currentLayer,
            freshness: Math.max(0, Math.min(100, action.freshness)),
          },
        },
      };
    }
    case 'SET_LAYER_STATE': {
      const currentLayer = state.layers[action.layerId] || DEFAULT_LAYER_STATE;
      return {
        ...state,
        layers: {
          ...state.layers,
          [action.layerId]: {
            ...currentLayer,
            ...action.state,
          },
        },
      };
    }
    case 'INITIALIZE_LAYERS': {
      return {
        ...state,
        layers: {
          ...state.layers,
          ...action.layers,
        },
      };
    }
    case 'RESET_LAYER': {
      const { [action.layerId]: removed, ...remainingLayers } = state.layers;
      return {
        ...state,
        layers: remainingLayers,
      };
    }
    default:
      return state;
  }
}

interface IntelligenceLayerContextValue {
  state: IntelligenceLayerState;
  setLayerStatus: (layerId: string, status: LayerStatus) => void;
  setLayerLastUpdate: (layerId: string, timestamp: string) => void;
  setLayerFreshness: (layerId: string, freshness: number) => void;
  setLayerState: (layerId: string, state: Partial<LayerState>) => void;
  getLayerState: (layerId: string) => LayerStatus;
  getLastUpdate: (layerId: string) => string | null;
  getFreshness: (layerId: string) => number;
  getLayer: (layerId: string) => LayerState;
  isLayerHealthy: (layerId: string) => boolean;
  getOverallStatus: () => LayerStatus;
}

const IntelligenceLayerContext = createContext<IntelligenceLayerContextValue | null>(null);

export interface IntelligenceLayerProviderProps {
  children: ReactNode;
  initialLayers?: Record<string, LayerState>;
}

export const IntelligenceLayerProvider: React.FC<IntelligenceLayerProviderProps> = ({
  children,
  initialLayers = {},
}) => {
  const [state, dispatch] = useReducer(intelligenceLayerReducer, {
    ...INITIAL_STATE,
    layers: {
      ...INITIAL_STATE.layers,
      ...initialLayers,
    },
  });

  const setLayerStatus = useCallback((layerId: string, status: LayerStatus) => {
    dispatch({ type: 'SET_LAYER_STATUS', layerId, status });
  }, []);

  const setLayerLastUpdate = useCallback((layerId: string, timestamp: string) => {
    dispatch({ type: 'SET_LAYER_LAST_UPDATE', layerId, timestamp });
  }, []);

  const setLayerFreshness = useCallback((layerId: string, freshness: number) => {
    dispatch({ type: 'SET_LAYER_FRESHNESS', layerId, freshness });
  }, []);

  const setLayerState = useCallback((layerId: string, layerState: Partial<LayerState>) => {
    dispatch({ type: 'SET_LAYER_STATE', layerId, state: layerState });
  }, []);

  const getLayerState = useCallback((layerId: string): LayerStatus => {
    return state.layers[layerId]?.status || 'OFFLINE';
  }, [state.layers]);

  const getLastUpdate = useCallback((layerId: string): string | null => {
    return state.layers[layerId]?.lastUpdate || null;
  }, [state.layers]);

  const getFreshness = useCallback((layerId: string): number => {
    return state.layers[layerId]?.freshness || 0;
  }, [state.layers]);

  const getLayer = useCallback((layerId: string): LayerState => {
    return state.layers[layerId] || DEFAULT_LAYER_STATE;
  }, [state.layers]);

  const isLayerHealthy = useCallback((layerId: string): boolean => {
    const layer = state.layers[layerId];
    if (!layer) return false;
    return layer.status === 'LIVE' || (layer.status === 'SYNCING' && layer.freshness > 30);
  }, [state.layers]);

  const getOverallStatus = useCallback((): LayerStatus => {
    const statuses = Object.values(state.layers).map(l => l.status);
    if (statuses.includes('OFFLINE')) return 'OFFLINE';
    if (statuses.includes('DEGRADED')) return 'DEGRADED';
    if (statuses.includes('STALE')) return 'STALE';
    if (statuses.includes('SYNCING')) return 'SYNCING';
    return 'LIVE';
  }, [state.layers]);

  const value = useMemo(() => ({
    state,
    setLayerStatus,
    setLayerLastUpdate,
    setLayerFreshness,
    setLayerState,
    getLayerState,
    getLastUpdate,
    getFreshness,
    getLayer,
    isLayerHealthy,
    getOverallStatus,
  }), [
    state,
    setLayerStatus,
    setLayerLastUpdate,
    setLayerFreshness,
    setLayerState,
    getLayerState,
    getLastUpdate,
    getFreshness,
    getLayer,
    isLayerHealthy,
    getOverallStatus,
  ]);

  return (
    <IntelligenceLayerContext.Provider value={value}>
      {children}
    </IntelligenceLayerContext.Provider>
  );
};

/**
 * Hook to access intelligence layer state and actions
 * Must be used within IntelligenceLayerProvider
 */
export function useIntelligenceLayer(): IntelligenceLayerContextValue {
  const context = useContext(IntelligenceLayerContext);
  if (!context) {
    throw new Error('useIntelligenceLayer must be used within an IntelligenceLayerProvider');
  }
  return context;
}

/**
 * Hook to access a specific layer's state
 */
export function useLayer(layerId: string): LayerState & {
  status: LayerStatus;
  isHealthy: boolean;
  refresh: () => void;
} {
  const { getLayer, getLayerState, getLastUpdate, getFreshness, isLayerHealthy, setLayerStatus, setLayerLastUpdate } = useIntelligenceLayer();
  
  const layer = getLayer(layerId);
  
  const refresh = useCallback(() => {
    setLayerStatus(layerId, 'SYNCING');
    setLayerLastUpdate(layerId, new Date().toISOString());
    // Simulate async refresh completing
    setTimeout(() => {
      setLayerStatus(layerId, 'LIVE');
      setLayerLastUpdate(layerId, new Date().toISOString());
    }, 1000 + Math.random() * 2000);
  }, [layerId, setLayerStatus, setLayerLastUpdate]);

  return {
    ...layer,
    status: getLayerState(layerId),
    isHealthy: isLayerHealthy(layerId),
    refresh,
  };
}

/**
 * Hook to subscribe to overall system health
 */
export function useSystemHealth(): {
  overallStatus: LayerStatus;
  healthyLayers: number;
  totalLayers: number;
  layers: Record<string, LayerState>;
} {
  const { state, getOverallStatus, isLayerHealthy } = useIntelligenceLayer();
  
  const overallStatus = getOverallStatus();
  const healthyLayers = Object.keys(state.layers).filter(id => isLayerHealthy(id)).length;
  const totalLayers = Object.keys(state.layers).length;

  return {
    overallStatus,
    healthyLayers,
    totalLayers,
    layers: state.layers,
  };
}

export default IntelligenceLayerProvider;