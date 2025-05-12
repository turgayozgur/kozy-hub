import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Monitor, Network, MessageSquare, Send } from 'lucide-react';
import { deviceService } from '../lib/deviceService';

interface ReceivedMessage {
  connectionId: string;
  name: string;
  payload: any;
  timestamp: Date;
}

export function DeviceTestPanel() {
  const [deviceKey, setDeviceKey] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receivedMessages, setReceivedMessages] = useState<ReceivedMessage[]>([]);
  const [messageToSend, setMessageToSend] = useState('');
  const [savedDevices, setSavedDevices] = useState<Array<{key: string, label: string}>>([]);
  const hubUrlRef = useRef<string>('');
  
  // Load saved devices and hub URL when component mounts
  useEffect(() => {
    const getSavedDevices = () => {
      const savedKeys = localStorage.getItem('deviceKeys');
      if (!savedKeys) return [];
      
      try {
        return JSON.parse(savedKeys);
      } catch (err) {
        console.error('Error parsing saved device keys:', err);
        return [];
      }
    };
    
    setSavedDevices(getSavedDevices());
    
    // Get the hub URL from localStorage
    const savedHubUrl = localStorage.getItem('hubUrl');
    if (savedHubUrl) {
      hubUrlRef.current = savedHubUrl;
    } else {
      // Default hub URL if none is saved
      const defaultUrl = `${window.location.origin}/hub`;
      hubUrlRef.current = defaultUrl;
      localStorage.setItem('hubUrl', defaultUrl);
    }
    
    // Listen for storage events
    const handleStorageChange = () => {
      setSavedDevices(getSavedDevices());
      const updatedHubUrl = localStorage.getItem('hubUrl');
      if (updatedHubUrl) {
        hubUrlRef.current = updatedHubUrl;
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Clean up on unmount
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      // Disconnect device if connected
      if (deviceService.isConnected()) {
        deviceService.disconnect().catch(console.error);
      }
    };
  }, []);
  
  // Function to connect device
  const connectDevice = async () => {
    if (!deviceKey.trim()) return;
    
    try {
      setIsConnecting(true);
      setError(null);
      
      await deviceService.connect({
        hubUrl: hubUrlRef.current,
        deviceKey: deviceKey.trim(),
        deviceName: deviceName.trim() || deviceKey.trim(),
        onConnected: () => {
          setIsConnected(true);
          setIsConnecting(false);
          
          // Trigger custom event for UI update
          const customEvent = new CustomEvent('device-connected', {
            detail: {
              key: deviceKey.trim(),
              name: deviceName.trim() || deviceKey.trim(),
              isConnected: true
            }
          });
          window.dispatchEvent(customEvent);
        },
        onDisconnected: () => {
          setIsConnected(false);
          
          // Trigger custom event for UI update
          const customEvent = new CustomEvent('device-disconnected', {
            detail: {
              key: deviceKey.trim()
            }
          });
          window.dispatchEvent(customEvent);
        },
        onError: (err) => {
          setError(err.message);
          setIsConnecting(false);
        },
        onReceiveFromUser: (key, name, payload, connectionId) => {
          // Add received message to the list
          setReceivedMessages(prev => [
            {
              connectionId,
              name,
              payload,
              timestamp: new Date()
            },
            ...prev
          ]);
        }
      });
      
    } catch (err) {
      setIsConnecting(false);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    }
  };
  
  // Function to disconnect device
  const disconnectDevice = async () => {
    try {
      await deviceService.disconnect();
      // The onDisconnected callback will update the state
    } catch (err) {
      console.error('Error disconnecting device:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    }
  };
  
  // Function to send message to all users
  const sendMessageToUsers = async () => {
    if (!messageToSend.trim() || !isConnected) return;
    
    try {
      await deviceService.sendToUsers('message', {
        text: messageToSend.trim(),
        timestamp: new Date().toISOString()
      });
      
      // Clear message field after sending
      setMessageToSend('');
    } catch (err) {
      console.error('Error sending message:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to send message');
      }
    }
  };
  
  // Function to select a saved device
  const selectSavedDevice = (deviceInfo: { key: string, label: string }) => {
    setDeviceKey(deviceInfo.key);
    setDeviceName(deviceInfo.label);
  };
  
  return (
    <div className="max-w-md mx-auto p-6 bg-card border rounded-lg shadow-sm">
      <div className="space-y-4">
        {!isConnected ? (
          <>
            <div>
              <label htmlFor="device-key" className="block text-sm font-medium mb-1">
                Device Key
              </label>
              <input
                id="device-key"
                type="text"
                value={deviceKey}
                onChange={(e) => setDeviceKey(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter device key"
              />
            </div>
            
            <div>
              <label htmlFor="device-name" className="block text-sm font-medium mb-1">
                Device Name (optional)
              </label>
              <input
                id="device-name"
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter device name"
              />
            </div>
            
            <Button 
              onClick={connectDevice}
              disabled={!deviceKey.trim() || isConnecting}
              className="w-full"
            >
              <Network className="mr-2 h-4 w-4" />
              {isConnecting ? 'Connecting...' : 'Connect Device'}
            </Button>
            
            {error && (
              <div className="text-sm text-red-500 mt-2">
                {error}
              </div>
            )}
            
            {savedDevices.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium mb-2">Saved Devices</h3>
                <div className="space-y-2">
                  {savedDevices.map((device) => (
                    <div 
                      key={device.key}
                      className="flex items-center justify-between p-2 border rounded-md cursor-pointer hover:bg-accent"
                      onClick={() => selectSavedDevice(device)}
                    >
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-zinc-400" />
                        <span className="text-sm">{device.label} ({device.key})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4 bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-green-500" />
                <div>
                  <div className="font-medium">{deviceName || deviceKey}</div>
                  <div className="text-xs text-muted-foreground">{deviceKey}</div>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={disconnectDevice}
              >
                Disconnect
              </Button>
            </div>
            
            <div className="border-t pt-4">
              <div className="flex items-center mb-2">
                <MessageSquare className="h-4 w-4 mr-2 text-primary" />
                <h3 className="text-sm font-medium">Send Message to Users</h3>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={messageToSend}
                  onChange={(e) => setMessageToSend(e.target.value)}
                  className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Type a message..."
                  onKeyDown={(e) => e.key === 'Enter' && messageToSend.trim() && sendMessageToUsers()}
                />
                <Button 
                  variant="default"
                  onClick={sendMessageToUsers}
                  disabled={!messageToSend.trim()}
                  className="flex items-center justify-center h-10 w-10 p-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {receivedMessages.length > 0 && (
              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-medium mb-2">Received Messages</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {receivedMessages.map((msg, index) => (
                    <div key={index} className="p-2 border rounded-md text-sm">
                      <div className="flex justify-between items-start">
                        <div className="font-medium">{msg.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {msg.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                      <div className="mt-1">
                        {typeof msg.payload === 'object' 
                          ? JSON.stringify(msg.payload)
                          : String(msg.payload)
                        }
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        from: {msg.connectionId.substring(0, 8)}...
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 