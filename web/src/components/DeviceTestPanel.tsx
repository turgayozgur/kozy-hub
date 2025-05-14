import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import {
  Monitor, Network, MessageSquare, Send, SendHorizontal, CheckCircle, XCircle, AlertCircle, Clock,
  Loader2, RefreshCw, FileCheck, Hourglass, ShieldAlert, ChevronRight, Camera, Upload, Image as ImageIcon
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
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSendingImage, setIsSendingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  
  // Function to handle file selection (for image upload)
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Only accept image files
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        // Extract the base64 data (remove the data URL prefix)
        const base64Data = result.split(',')[1];
        
        // Use the image as is, without resizing
        setCapturedImage(base64Data);
      }
    };
    reader.onerror = () => {
      setError('Failed to read the image file');
    };
    reader.readAsDataURL(file);
  };

  // Function to capture screen (if supported by browser)
  const captureScreen = async () => {
    try {
      // Check if the browser supports screen capture
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen capture not supported');
      }

      // Request screen capture
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      
      // Create video element to capture the stream
      const video = document.createElement('video');
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
        
        // Create canvas to draw the image at original size
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw the video frame to the canvas at original size
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Draw the video at its original dimensions
          ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
          
          // Get base64 data from canvas
          const imageData = canvas.toDataURL('image/jpeg', 0.9);
          const base64Data = imageData.split(',')[1];
          
          // Use the image as is
          setCapturedImage(base64Data);
          
          // Stop all tracks
          stream.getTracks().forEach(track => track.stop());
        }
      };
    } catch (err) {
      console.error('Error capturing screen:', err);
      setError('Failed to capture screen. Try uploading an image instead.');
    }
  };

  // Function to send image to users
  const sendImageToUsers = async () => {
    if (!capturedImage || !isConnected) return;
    
    try {
      setIsSendingImage(true);
      
      await deviceService.sendToUsers('device-update', {
        image: capturedImage,
        timestamp: new Date().toISOString()
      });
      
      setIsSendingImage(false);
      // Leave the image preview visible after sending
    } catch (err) {
      setIsSendingImage(false);
      console.error('Error sending image:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to send image');
      }
    }
  };

  // Function to clear captured image
  const clearCapturedImage = () => {
    setCapturedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
            
            {/* Screen Capture Section */}
            <div className="border-t pt-4">
              <div className="flex items-center mb-2">
                <Camera className="h-4 w-4 mr-2 text-primary" />
                <h3 className="text-sm font-medium">Screen Capture</h3>
              </div>
              
              {capturedImage ? (
                <div className="space-y-3">
                  <div className="border rounded-md overflow-hidden">
                    <img 
                      src={`data:image/jpeg;base64,${capturedImage}`} 
                      alt="Captured screen" 
                      className="w-full h-auto"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={clearCapturedImage}
                      className="flex-1"
                    >
                      Clear
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={sendImageToUsers}
                      disabled={isSendingImage}
                      className="flex-1"
                    >
                      {isSendingImage ? 'Sending...' : 'Send Image'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={captureScreen}
                      className="flex-1"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Capture Screen
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Image
                    </Button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                  <div className="border rounded-md p-8 flex flex-col items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-10 w-10 mb-2 opacity-20" />
                    <p className="text-sm text-center">Capture a screen or upload an image to send to users</p>
                  </div>
                </div>
              )}
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