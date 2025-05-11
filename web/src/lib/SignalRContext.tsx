import { createContext, useContext, useState, useEffect, useRef } from 'react';
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
          return prev.map(d => d.key === device.key ? { ...d, isConnected: true } : d);
        } else {
          return [...prev, device];
        }
      });
    });

    signalRService.onDeviceDisconnected((device) => {
      setDevices(prev => 
        prev.map(d => d.key === device.key ? { ...d, isConnected: false } : d)
      );
    });

    return () => {
      // Clean up connection when component unmounts
      // Use the dispose method which properly cleans up resources
      signalRService.dispose();
    };
  }, []);

  const clearError = () => {
    setError(null);
  };

  const connectSignalR = async (hubUrl: string, token?: string) => {
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
    // Note: we don't set loading = false here for successful connection
    // The connection state change handler will do that when it confirms connection
  };

  const disconnectSignalR = async () => {
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
  };

  const subscribeToDevices = async (keys: string[]) => {
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
  };

  const sendToDevice = async (key: string, name: string, payload: any) => {
    if (!isConnected) {
      throw new Error('Cannot send to device: not connected');
    }

    try {
      await signalRService.sendToDevice(key, name, payload);
    } catch (err) {
      console.error('Error sending message to device:', err);
      throw err;
    }
  };

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