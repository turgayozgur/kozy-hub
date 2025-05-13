import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import {
  Monitor, Network, MessageSquare, Send, SendHorizontal, CheckCircle, XCircle, AlertCircle, Clock,
  Loader2, RefreshCw, FileCheck, Hourglass, ShieldAlert, ChevronRight
} from 'lucide-react';
import { deviceService } from '../lib/deviceService';

// Komut statüsü için tip tanımları
type CommandStatus = 'sending' | 'accepted' | 'running' | 'completed' | 'failed' | 'timeout';

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
  const [pendingCommands, setPendingCommands] = useState<Map<string, CommandStatus>>(new Map());
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
          
          // Trigger custom event for UI update with commands from the device
          const customEvent = new CustomEvent('device-connected', {
            detail: {
              key: deviceKey.trim(),
              name: deviceName.trim() || deviceKey.trim(),
              isConnected: true,
              payload: {
                // Use the same game-themed commands as test examples
                commands: [
                  'Party kabul et',
                  '10 item trade et',
                  'VIP\'den silah al',
                  'Town at'
                ]
              }
            }
          });
          window.dispatchEvent(customEvent);
          console.log('Dispatched device-connected event with commands:', customEvent.detail);
        },
        onDisconnected: () => {
          setIsConnected(false);
          
          // Clear all pending commands when disconnected
          setPendingCommands(new Map());
          
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
          
          // Check if this is a command type message
          if (deviceService.isConnected()) {
            let commandName = '';
            
            if (name === 'command' && payload && typeof payload === 'object') {
              // Legacy format: { command: 'commandName', ... }
              commandName = payload.command || 'unknown';
            } else if (payload && typeof payload === 'object' && payload.command) {
              // Direct command format with command in payload
              commandName = payload.command;
            } else if (typeof name === 'string' && [
              'Party kabul et',
              '10 item trade et',
              'VIP\'den silah al',
              'Town at',
              'get-info'
            ].includes(name)) {
              // Direct command format where name is the command
              commandName = name;
            }
            
            if (commandName) {
              console.log(`Received command from user: ${commandName}`, payload);
              
              // Process the command directly here
              // Helper function to get random delay between min and max seconds
              const getRandomDelay = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min) * 1000;
              
              if (commandName === 'get-info') {
                // Immediately respond with device info including commands
                deviceService.sendResponseToUser(
                  connectionId,
                  commandName,
                  {
                    command: commandName,
                    status: 'completed',
                    deviceType: 'web-test-device',
                    version: '1.0.0',
                    commands: [
                      'Party kabul et',
                      '10 item trade et',
                      'VIP\'den silah al',
                      'Town at'
                    ]
                  }
                ).catch(error => {
                  console.error('Error responding to get-info command:', error);
                });
                return;
              }
              
              if ([
                'Party kabul et',
                '10 item trade et',
                'VIP\'den silah al',
                'Town at'
              ].includes(commandName)) {
                // Set the command as sending initially
                setPendingCommands(prev => {
                  const newMap = new Map(prev);
                  newMap.set(commandName, 'sending');
                  return newMap;
                });
                
                // Send initial 'sending' status
                deviceService.sendResponseToUser(
                  connectionId,
                  commandName,
                  { 
                    command: commandName,
                    status: 'sending',
                    timestamp: new Date().toISOString()
                  }
                ).then(() => {
                  // After random delay (2-5s), set to accepted
                  const acceptedDelay = getRandomDelay(2, 5);
                  setTimeout(() => {
                    setPendingCommands(prev => {
                      const newMap = new Map(prev);
                      newMap.set(commandName, 'accepted');
                      return newMap;
                    });
                    
                    deviceService.sendResponseToUser(
                      connectionId,
                      commandName,
                      { 
                        command: commandName,
                        status: 'accepted',
                        timestamp: new Date().toISOString()
                      }
                    ).then(() => {
                      // After another random delay (2-5s), set to running
                      const runningDelay = getRandomDelay(2, 5);
                      setTimeout(() => {
                        setPendingCommands(prev => {
                          const newMap = new Map(prev);
                          newMap.set(commandName, 'running');
                          return newMap;
                        });
                        
                        deviceService.sendResponseToUser(
                          connectionId,
                          commandName,
                          { 
                            command: commandName,
                            status: 'running',
                            timestamp: new Date().toISOString()
                          }
                        ).then(() => {
                          // After another random delay (2-5s), complete or fail (randomly with 80% success rate)
                          const completionDelay = getRandomDelay(2, 5);
                          setTimeout(() => {
                            const isSuccess = Math.random() > 0.2; // 80% success rate
                            const finalStatus = isSuccess ? 'completed' : 'failed';
                            
                            setPendingCommands(prev => {
                              const newMap = new Map(prev);
                              newMap.set(commandName, finalStatus as CommandStatus);
                              return newMap;
                            });
                            
                            deviceService.sendResponseToUser(
                              connectionId,
                              commandName,
                              { 
                                command: commandName,
                                status: finalStatus,
                                result: isSuccess ? 'Command executed successfully' : 'Command execution failed',
                                timestamp: new Date().toISOString()
                              }
                            ).then(() => {
                              // After showing the completion status for 2 seconds, remove the command completely
                              // so the button returns to its original state
                              setTimeout(() => {
                                setPendingCommands(prev => {
                                  const newMap = new Map(prev);
                                  // Remove the command completely so button returns to original state
                                  newMap.delete(commandName);
                                  return newMap;
                                });
                              }, 2000); // Show the completion state for 2 seconds
                            }).catch(error => {
                              console.error(`Error sending ${finalStatus} response:`, error);
                              // If there's an error sending the response, also remove the command
                              // after a delay so the button can be used again
                              setTimeout(() => {
                                setPendingCommands(prev => {
                                  const newMap = new Map(prev);
                                  newMap.delete(commandName);
                                  return newMap;
                                });
                              }, 2000);
                            });
                          }, completionDelay);
                        }).catch(error => {
                          console.error('Error sending running response:', error);
                        });
                      }, runningDelay);
                    }).catch(error => {
                      console.error('Error sending accepted response:', error);
                    });
                  }, acceptedDelay);
                }).catch(error => {
                  console.error('Error sending initial response:', error);
                  // Update UI to show error
                  setPendingCommands(prev => {
                    const newMap = new Map(prev);
                    newMap.set(commandName, 'failed');
                    return newMap;
                  });
                });
              }
            }
          }
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
  
  // Get command status icon and style
  const getCommandStatusIcon = (status: CommandStatus) => {
    switch (status) {
      case 'sending':
        return { icon: <SendHorizontal className="h-4 w-4 animate-pulse" />, color: 'text-yellow-500' };
      case 'accepted':
        return { icon: <FileCheck className="h-4 w-4" />, color: 'text-blue-500' };
      case 'running':
        return { icon: <Loader2 className="h-4 w-4 animate-spin" />, color: 'text-green-500' };
      case 'completed':
        return { icon: <CheckCircle className="h-4 w-4" />, color: 'text-primary' };
      case 'failed':
        return { icon: <ShieldAlert className="h-4 w-4" />, color: 'text-red-500' };
      case 'timeout':
        return { icon: <Hourglass className="h-4 w-4" />, color: 'text-orange-500' };
      default:
        return { icon: <ChevronRight className="h-4 w-4" />, color: 'text-zinc-400' };
    }
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
            
            {/* Show pending commands section if there are any commands */}
            {pendingCommands.size > 0 && (
              <div className="border-t pt-4 mb-4">
                <div className="flex items-center mb-2">
                  <Clock className="h-4 w-4 mr-2 text-primary" />
                  <h3 className="text-sm font-medium">Pending Commands</h3>
                </div>
                <div className="space-y-2">
                  {Array.from(pendingCommands.entries()).map(([command, status]) => {
                    const { icon, color } = getCommandStatusIcon(status);
                    return (
                      <div key={command} className={`flex items-center justify-between p-2 border rounded-md ${color}`}>
                        <span className="text-sm">{command}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs capitalize">{status}</span>
                          {icon}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
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
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Received Messages</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReceivedMessages([])}
                    className="text-xs h-6"
                  >
                    Clear
                  </Button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {receivedMessages.map((msg, index) => (
                    <div key={index} className="p-2 border rounded-md text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{msg.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {msg.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        {typeof msg.payload === 'object' 
                          ? JSON.stringify(msg.payload) 
                          : String(msg.payload)
                        }
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