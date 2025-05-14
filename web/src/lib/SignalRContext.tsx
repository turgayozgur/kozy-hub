import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { signalRService } from './signalrService';
import type { DeviceSession, ConnectionState } from './signalrService';

interface SignalRContextType {
  isConnected: boolean;
  connectionState: ConnectionState;
  devices: DeviceSession[];
  connectSignalR: (hubUrl: string, token?: string) => Promise<void>;
  disconnectSignalR: () => Promise<void>;
  subscribeToDevices: (keys: string[]) => Promise<void>;
  sendToDevice: (key: string, name: string, payload: any) => Promise<void>;
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

const SignalRContext = createContext<SignalRContextType | undefined>(undefined);

interface SignalRProviderProps {
  children: ReactNode;
}

export const SignalRProvider = ({ children }: SignalRProviderProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isConnecting = useRef(false);
  const lastConnectionUrl = useRef<string | null>(null);
  const isInitialized = useRef(false);

  // Define connectSignalR with useCallback to avoid infinite loops
  const connectSignalR = useCallback(async (hubUrl: string, token?: string) => {
    // Prevent multiple concurrent connection attempts
    if (isConnecting.current) {
      console.log('Connection attempt already in progress, ignoring duplicate request');
      return;
    }
    
    // If we're already connected to this URL, don't reconnect
    if (isConnected && lastConnectionUrl.current === hubUrl) {
      console.log('Already connected to this hub URL');
      setLoading(false); // Ensure loading is false if already connected
      return;
    }
    
    try {
      isConnecting.current = true;
      setLoading(true);
      setError(null);
      
      lastConnectionUrl.current = hubUrl;
      console.log('Connecting to SignalR hub:', hubUrl);
      await signalRService.start(hubUrl, token);
      
      // Connection succeeded
      setDevices(signalRService.getAllDevices());
      // Let the connection state handler set isConnected to true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to SignalR hub';
      console.error('SignalR connection error:', err);
      setError(errorMessage);
      isConnecting.current = false;
      setConnectionState('disconnected');
      setLoading(false); // Make sure loading is false on error
    }
  }, [isConnected]);

  const disconnectSignalR = useCallback(async () => {
    try {
      setLoading(true);
      await signalRService.stop();
      lastConnectionUrl.current = null;
    } catch (err) {
      console.error('SignalR disconnection error:', err);
    } finally {
      setLoading(false);
      isConnecting.current = false;
      setConnectionState('disconnected');
    }
  }, []);

  const subscribeToDevices = useCallback(async (keys: string[]) => {
    if (!isConnected) {
      console.warn('Cannot subscribe to devices: not connected');
      return;
    }

    try {
      setLoading(true);
      await signalRService.subscribeToDevices(keys);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to subscribe to devices';
      console.error('Device subscription error:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [isConnected]);

  const sendToDevice = useCallback(async (key: string, name: string, payload: any) => {
    if (!isConnected) {
      throw new Error('Cannot send to device: not connected');
    }

    try {
      await signalRService.sendToDevice(key, name, payload);
    } catch (err) {
      console.error('Error sending message to device:', err);
      throw err;
    }
  }, [isConnected]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Setup event listeners once when the component mounts
  useEffect(() => {
    // Register connection state listener
    const handleConnectionStateChange = (state: ConnectionState) => {
      setConnectionState(state);
      setIsConnected(state === 'connected');
      
      if (state === 'connected') {
        // When connected, clear loading and connecting states
        isConnecting.current = false;
        setLoading(false);
      } else if (state === 'connecting' || state === 'reconnecting') {
        // When connecting or reconnecting, ensure loading is true
        setLoading(true);
      }
      
      if (state !== 'connected') {
        // Clear devices or mark them as disconnected when connection is lost
        setDevices(prev => prev.map(d => ({ ...d, isConnected: false })));
      }
    };
    
    signalRService.onConnectionStateChanged(handleConnectionStateChange);

    // Register device listeners
    signalRService.onDeviceConnected((device) => {
      setDevices(prev => {
        const exists = prev.some(d => d.key === device.key);
        if (exists) {
          return prev.map(d => d.key === device.key ? { ...d, isConnected: true, name: device.name } : d);
        } else {
          return [...prev, device];
        }
      });
      
      // Trigger manual device update event to ensure UI is updated immediately
      if (typeof window !== 'undefined' && document) {
        // This will force the DeviceList component to update the device name
        const updateEvent = new CustomEvent('manual-device-update', {
          detail: { 
            key: device.key, 
            name: device.name 
          }
        });
        setTimeout(() => {
          document.dispatchEvent(updateEvent);
        }, 100);
      }
    });

    signalRService.onDeviceDisconnected((device) => {
      setDevices(prev => 
        prev.map(d => d.key === device.key ? { ...d, isConnected: false } : d)
      );
    });

    return () => {
      // Clean up connection when component unmounts
      signalRService.dispose();
    };
  }, []);

  // Initialize connection on component mount
  useEffect(() => {
    const initializeConnection = async () => {
      if (isInitialized.current) return;
      
      const envHubUrl = import.meta.env.VITE_HUB_URL;
      const savedHubUrl = localStorage.getItem('hubUrl');
      const hubUrl = envHubUrl || savedHubUrl || `${window.location.origin}/hub`;
      
      if (hubUrl && !savedHubUrl) {
        localStorage.setItem('hubUrl', hubUrl);
      }
      
      isInitialized.current = true;
      try {
        await connectSignalR(hubUrl);
        console.log('SignalR connection initialized at application start');
      } catch (err) {
        console.error('Failed to initialize SignalR connection:', err);
      }
    };

    // Small delay to ensure everything is properly initialized
    setTimeout(() => {
      initializeConnection();
    }, 500);
  }, [connectSignalR]);

  const value = {
    isConnected,
    connectionState,
    devices,
    connectSignalR,
    disconnectSignalR,
    subscribeToDevices,
    sendToDevice,
    loading,
    error,
    clearError,
  };

  return (
    <SignalRContext.Provider value={value}>
      {children}
    </SignalRContext.Provider>
  );
};

export const useSignalR = () => {
  const context = useContext(SignalRContext);
  if (context === undefined) {
    throw new Error('useSignalR must be used within a SignalRProvider');
  }
  return context;
}; 