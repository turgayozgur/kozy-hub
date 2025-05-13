import { useState, useEffect, useRef, useCallback } from 'react';
import { useSignalR } from '../lib/SignalRContext';
import { Button } from './ui/button';
import {
  Monitor, X, Plus, SendHorizontal, CheckCircle, XCircle, AlertCircle, Clock,
  Loader2, RefreshCw, FlaskConical, Hourglass, ShieldAlert, FileCheck, Bolt,
  ChevronRight, MoreHorizontal
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from './ui/dialog';

// Komut durumları için tip tanımlaması
type CommandStatus = 'idle' | 'sending' | 'accepted' | 'running' | 'completed' | 'failed' | 'timeout' | 'no-response';

// Komut yönetimi için arayüz
interface DeviceCommand {
  name: string;
  status: CommandStatus;
  timestamp: number;
}

// Cihaz komut paneli bileşeni
function DeviceCommandPanel({ device, isConnected }: { device: { key: string; label: string }, isConnected: boolean }) {
  const { sendToDevice } = useSignalR();
  const [commands, setCommands] = useState<string[]>([]);
  const [commandStatus, setCommandStatus] = useState<Map<string, DeviceCommand>>(new Map());
  const [localIsConnected, setLocalIsConnected] = useState(isConnected);
  const [isLoading, setIsLoading] = useState(true);
  
  // isConnected prop'u değiştiğinde, lokal state'i güncelle
  useEffect(() => {
    setLocalIsConnected(isConnected);
    console.log(`DeviceCommandPanel: isConnected prop changed to ${isConnected} for device ${device.key}`);
  }, [isConnected, device.key]);
  
  // Cihaz bağlandığında payload'dan commands bilgisini al ve kaydet
  useEffect(() => {
    console.log(`Setting up command listener for device ${device.key}, isConnected=${isConnected}, commands.length=${commands.length}`);
    setIsLoading(true);
    
    // Bağlı cihazlar için komut bilgilerini dinle
    const handleDeviceInfo = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      console.log('DeviceCommandPanel received device-connected event:', detail);
      
      if (detail && detail.key === device.key) {
        // Cihaz bağlantı durumunu güncelle
        setLocalIsConnected(true);
        
        // Payload'dan komutları al ve kaydet
        if (detail.payload && Array.isArray(detail.payload.commands)) {
          console.log(`Setting commands for device ${device.key}:`, detail.payload.commands);
          setCommands(detail.payload.commands);
          
          // Komutları local storage'a kaydet
          try {
            const deviceCommandsKey = `device_commands_${device.key}`;
            localStorage.setItem(deviceCommandsKey, JSON.stringify(detail.payload.commands));
          } catch (err) {
            console.error('Error saving device commands to localStorage:', err);
          }
        } else {
          // Eğer komut yoksa, boş dizi kullan
          console.log(`No commands received for device ${device.key}`);
          setCommands([]);
        }
        setIsLoading(false);
      }
    };
    
    // Cihaz bağlantısı kesildiğinde
    const handleDeviceDisconnected = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail && detail.key === device.key) {
        console.log(`Device ${device.key} disconnected, updating command panel`);
        setLocalIsConnected(false);
        // Komut durumlarını temizle
        setCommandStatus(new Map());
        setIsLoading(false);
      }
    };
    
    // Cihaz bağlantı olaylarını dinle
    document.addEventListener('device-connected', handleDeviceInfo);
    document.addEventListener('device-disconnected', handleDeviceDisconnected);
    
    // Cihaz zaten bağlıysa, localStorage'dan komutları yüklemeyi dene
    if (isConnected && commands.length === 0) {
      try {
        const deviceCommandsKey = `device_commands_${device.key}`;
        const savedCommands = localStorage.getItem(deviceCommandsKey);
        
        if (savedCommands) {
          const parsedCommands = JSON.parse(savedCommands);
          console.log(`Loaded saved commands for device ${device.key}:`, parsedCommands);
          setCommands(parsedCommands);
        } else {
          console.log(`No saved commands found for device ${device.key} in localStorage`);
        }
        // Kısa bir gecikme ile yüklemeyi bitir (animasyonu görmek için)
        setTimeout(() => setIsLoading(false), 300);
      } catch (err) {
        console.error('Error loading device commands from localStorage:', err);
        setIsLoading(false);
      }
    } else {
      // Eğer zaten komut yüklenmişse veya cihaz bağlı değilse, yükleme durumunu kapat
      if (commands.length > 0 || !isConnected) {
        setIsLoading(false);
      }
    }
    
    // Temizleme
    return () => {
      document.removeEventListener('device-connected', handleDeviceInfo);
      document.removeEventListener('device-disconnected', handleDeviceDisconnected);
    };
  }, [device.key, isConnected, commands.length]);
  
  // Komut yanıtlarını dinle
  useEffect(() => {
    // Bir global event handler oluştur ve cihaz cevaplarını dinle
    const handleResponse = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail && detail.key === device.key && detail.originalName) {
        const commandName = detail.originalName;
        const status = detail.payload?.status || 'failed';
        
        console.log(`Device ${device.key} command ${commandName} status update:`, status, detail.payload);
        
        // Mevcut komut durumlarını güncelle
        setCommandStatus(prev => {
          const newMap = new Map(prev);
          const existingCommand = newMap.get(commandName);
          
          if (existingCommand) {
            console.log(`Updating command status: ${commandName} from ${existingCommand.status} to ${status}`);
            newMap.set(commandName, {
              ...existingCommand,
              status: status as CommandStatus
            });
          } else {
            console.log(`Adding new command with status: ${commandName} - ${status}`);
            newMap.set(commandName, {
              name: commandName,
              status: status as CommandStatus,
              timestamp: Date.now()
            });
          }
          
          return newMap;
        });
        
        // If command is completed or failed, remove it after a delay
        if (['completed', 'failed', 'timeout', 'no-response'].includes(status)) {
          setTimeout(() => {
            setCommandStatus(prev => {
              const newMap = new Map(prev);
              // Only remove if status is still completed, failed, timeout, or no-response
              const current = newMap.get(commandName);
              if (current && ['completed', 'failed', 'timeout', 'no-response'].includes(current.status)) {
                console.log(`Removing completed/failed command: ${commandName}`);
                newMap.delete(commandName);
              }
              return newMap;
            });
          }, 2000);
        }
      }
    };
    
    // Olayı dinle
    document.addEventListener('device-response', handleResponse);
    
    return () => {
      document.removeEventListener('device-response', handleResponse);
    };
  }, [device.key]);
  
  // Komut gönder
  const executeCommand = useCallback(async (commandName: string) => {
    // Zaten işlem yapılan bir komut ise çalıştırma
    const currentCommand = commandStatus.get(commandName);
    if (currentCommand && ['sending', 'accepted', 'running'].includes(currentCommand.status)) {
      return;
    }
    
    // Create a timestamp for this command execution
    const executionTimestamp = Date.now();
    
    // Komut durumunu 'sending' olarak güncelle
    setCommandStatus(prev => {
      const newMap = new Map(prev);
      newMap.set(commandName, {
        name: commandName,
        status: 'sending',
        timestamp: executionTimestamp
      });
      return newMap;
    });
    
    try {
      // Komutu cihaza gönder
      await sendToDevice(device.key, commandName, null);
      
      // 5 saniye sonra hala bir cevap gelmediyse, no-response
      const noResponseTimeout = setTimeout(() => {
        setCommandStatus(prev => {
          const newMap = new Map(prev);
          const command = newMap.get(commandName);
          
          // Only update if this is the same command execution (check timestamp)
          // and it's still in 'sending' state (no status update received)
          if (command && command.timestamp === executionTimestamp && command.status === 'sending') {
            console.log(`No response received for command ${commandName} after 5 seconds`);
            newMap.set(commandName, {
              ...command,
              status: 'no-response'
            });
            
            // Remove no-response status after 2 seconds to reset the button
            setTimeout(() => {
              setCommandStatus(prev => {
                const newMap = new Map(prev);
                const current = newMap.get(commandName);
                if (current && current.timestamp === executionTimestamp && current.status === 'no-response') {
                  newMap.delete(commandName);
                }
                return newMap;
              });
            }, 2000);
          }
          
          return newMap;
        });
      }, 5000); // 5 seconds timeout for no-response
      
      // 10 saniye sonra hala bir cevap gelmediyse, timeout
      // This still applies for cases when we got an initial response but then no further updates
      setTimeout(() => {
        setCommandStatus(prev => {
          const newMap = new Map(prev);
          const command = newMap.get(commandName);
          
          // Only update status if the command is still in sending state and it's the same execution
          if (command && command.timestamp === executionTimestamp && command.status === 'sending') {
            newMap.set(commandName, {
              ...command,
              status: 'timeout'
            });
            
            // Reset the button after 2 seconds
            setTimeout(() => {
              setCommandStatus(prev => {
                const newMap = new Map(prev);
                const current = newMap.get(commandName);
                if (current && current.timestamp === executionTimestamp && current.status === 'timeout') {
                  newMap.delete(commandName);
                }
                return newMap;
              });
            }, 2000);
          }
          
          return newMap;
        });
      }, 10000);
      
    } catch (error) {
      console.error(`Error sending command ${commandName} to device:`, error);
      
      // Hata durumunda durumu 'failed' olarak işaretle
      setCommandStatus(prev => {
        const newMap = new Map(prev);
        newMap.set(commandName, {
          name: commandName,
          status: 'failed',
          timestamp: executionTimestamp
        });
        return newMap;
      });
      
      // Reset the button after 2 seconds
      setTimeout(() => {
        setCommandStatus(prev => {
          const newMap = new Map(prev);
          const current = newMap.get(commandName);
          if (current && current.timestamp === executionTimestamp && current.status === 'failed') {
            newMap.delete(commandName);
          }
          return newMap;
        });
      }, 2000);
    }
  }, [device.key, sendToDevice, commandStatus]);
  
  // Komut durumuna göre ikon ve renk belirle
  const getCommandStatusInfo = (commandName: string) => {
    const command = commandStatus.get(commandName);
    
    if (!command) {
      return {
        icon: <ChevronRight className="h-4 w-4" />,
        color: 'text-zinc-400',
        label: ''
      };
    }
    
    switch (command.status) {
      case 'sending':
        return {
          icon: <SendHorizontal className="h-4 w-4 animate-pulse" />,
          color: 'text-yellow-500',
          label: 'Sending'
        };
      case 'accepted':
        return {
          icon: <FileCheck className="h-4 w-4" />,
          color: 'text-blue-500',
          label: 'Accepted'
        };
      case 'running':
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          color: 'text-green-500',
          label: 'Running'
        };
      case 'completed':
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          color: 'text-emerald-500',
          label: 'Completed'
        };
      case 'failed':
        return {
          icon: <ShieldAlert className="h-4 w-4" />,
          color: 'text-red-500',
          label: 'Failed'
        };
      case 'timeout':
        return {
          icon: <Hourglass className="h-4 w-4" />,
          color: 'text-orange-500',
          label: 'Timeout'
        };
      case 'no-response':
        return {
          icon: <RefreshCw className="h-4 w-4" />,
          color: 'text-purple-500',
          label: 'No Response'
        };
      default:
        return {
          icon: <ChevronRight className="h-4 w-4" />,
          color: 'text-zinc-400',
          label: ''
        };
    }
  };
  
  // Cihaz bağlı değilse komutları gösterme
  if (!localIsConnected) {
    console.log(`DeviceCommandPanel: Device ${device.key} is not connected, showing disconnected message`);
    return (
      <div className="mt-3 md:mt-6 rounded-md bg-zinc-50 dark:bg-zinc-900">
        <p className="text-sm text-muted-foreground text-center py-4 md:py-6 px-3 md:px-4">
          Device is disconnected. Connect the device to view available commands.
        </p>
      </div>
    );
  }
  
  console.log(`DeviceCommandPanel: Rendering commands for device ${device.key}, commands count: ${commands.length}, isLoading: ${isLoading}`);
  console.log('Command list:', commands);
  
  return (
    <div className="space-y-6 md:space-y-8">
      {isLoading ? (
        null
      ) : commands.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4 md:py-6 px-3 md:px-4 border rounded-lg">
          No commands available for this device.
        </p>
      ) : (
        <>
          {/* Command buttons with consistent spacing */}
          <div className="flex flex-wrap gap-2 md:gap-4">
            {commands.map(cmd => {
              const { icon, color, label } = getCommandStatusInfo(cmd);
              const isDisabled = (() => {
                const command = commandStatus.get(cmd);
                // Only disable the button if the command is actively being processed
                return command && ['sending', 'accepted', 'running'].includes(command.status);
              })();
              
              return (
                <Button
                  key={cmd}
                  variant="outline"
                  size="sm"
                  className={`flex items-start justify-start gap-2 h-[60px] md:h-[68px] py-3 pl-4 pr-4 min-w-[120px] md:min-w-[140px] shadow-sm hover:shadow`}
                  onClick={() => executeCommand(cmd)}
                  disabled={isDisabled}
                >
                  <div className={`mt-0.5 ${color}`}>
                    {icon}
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-sm truncate">{cmd}</span>
                    <span className={`text-xs mt-1 ${color} ${commandStatus.has(cmd) ? 'opacity-80' : 'opacity-40'}`}>
                      {commandStatus.has(cmd) ? label : <MoreHorizontal className="h-3 w-3" />}
                    </span>
                  </div>
                  <span className="sr-only">{label}</span>
                </Button>
              );
            })}
          </div>
          
          {/* Content frame with consistent spacing */}
          <div className="border rounded-lg w-full md:w-[512px] h-[300px] md:h-[384px] overflow-hidden">
            {/* Frame is intentionally empty */}
          </div>
        </>
      )}
    </div>
  );
}

export function DeviceList() {
  const { devices, sendToDevice } = useSignalR();
  const [savedKeys, setSavedKeys] = useState<{ key: string; label: string }[]>([]);
  const [deviceToRemove, setDeviceToRemove] = useState<{ key: string; label: string } | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newDeviceKey, setNewDeviceKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<{ key: string; label: string } | null>(null);
  const dialogCloseRef = useRef<HTMLButtonElement>(null);
  const addDialogCloseRef = useRef<HTMLButtonElement>(null);
  
  // Cihaz bağlantı durumunu doğrudan dinle
  useEffect(() => {
    // devices listesi değiştiğinde, ve seçili bir cihaz varsa
    // o cihazın bağlantı durumunu kontrol et ve component'i zorla güncelle
    if (selectedDevice) {
      // Log connection state updates
      const device = devices.find(d => d.key === selectedDevice.key);
      console.log(`Device connection state updated for ${selectedDevice.key}:`, 
        device ? `Connected: ${device.isConnected}` : 'Not found in devices list');
      
      // Force update only if device connected state changed
      if (device && device.isConnected) {
        // If device name is available and different from current, update it
        if (device.name && device.name !== selectedDevice.label) {
          setSelectedDevice(prev => {
            if (!prev) return null;
            return { ...prev, label: device.name || prev.label };
          });
        }
      }
    }
  }, [devices]); // Remove selectedDevice from dependencies to prevent loops
  
  // Cihaz yanıtlarını global olaylar aracılığıyla dinle
  useEffect(() => {
    // SignalR'dan cihaz cevaplarını dinle ve global olaylar olarak yay
    const handleDeviceResponse = (key: string, originalName: string, payload: any) => {
      // Global olay olarak yay
      const event = new CustomEvent('device-response', {
        detail: { key, originalName, payload }
      });
      document.dispatchEvent(event);
    };
    
    // Bağlanan cihazların komutlarını işle
    const handleDeviceConnected = (device: any) => {
      console.log('Received signalr-device-connected event:', device);
      
      if (device?.key) {
        // Check if payload contains commands - get from the payload property if it exists
        let commands = [];
        
        // Debug logs to see what's coming in
        console.log('Device payload:', device.payload);
        
        if (device.payload && Array.isArray(device.payload.commands)) {
          // Get commands directly from payload.commands
          commands = device.payload.commands;
          console.log(`Found commands in device.payload.commands:`, commands);
        } else if (device.commands && Array.isArray(device.commands)) {
          // Fallback to device.commands if available
          commands = device.commands;
          console.log(`Found commands in device.commands:`, commands);
        }
        
        // Global olay olarak yay (payload bilgisini ekle)
        const event = new CustomEvent('device-connected', {
          detail: { 
            key: device.key, 
            name: device.name || device.key,
            isConnected: device.isConnected !== undefined ? device.isConnected : true,
            payload: {
              commands: commands
            }
          }
        });
        console.log('Dispatching device-connected event with commands:', commands);
        document.dispatchEvent(event);
      }
    };
    
    // Event listener'ları ekle
    const addListeners = () => {
      if (typeof window !== 'undefined') {
        document.addEventListener('signalr-response', (event: Event) => {
          const detail = (event as CustomEvent).detail;
          if (detail) {
            // signalr-response event'ini device-response'a dönüştür
            handleDeviceResponse(detail.key, detail.name, detail.payload);
          }
        });
        
        // Handle both command responses from test panel and regular responses
        document.addEventListener('signalr-message', (event: Event) => {
          const detail = (event as CustomEvent).detail;
          if (detail && detail.payload && detail.payload._responseType === 'deviceResponse') {
            // This is a device response via the test panel
            const commandName = detail.name; // The original command name is used as the message name
            const payload = detail.payload;
            handleDeviceResponse(detail.key, commandName, payload);
          }
        });
        
        document.addEventListener('signalr-device-connected', (event: Event) => {
          const detail = (event as CustomEvent).detail;
          if (detail) {
            handleDeviceConnected(detail);
          }
        });
        
        // Device disconnected olaylarını dinle
        document.addEventListener('signalr-device-disconnected', (event: Event) => {
          const detail = (event as CustomEvent).detail;
          if (detail) {
            console.log('Received signalr-device-disconnected event:', detail);
            
            // Global olaya çevir
            if (detail.key) {
              const event = new CustomEvent('device-disconnected', {
                detail: { 
                  key: detail.key,
                  name: detail.name || detail.key
                }
              });
              document.dispatchEvent(event);
            }
          }
        });
        
        // Doğrudan device-connected olaylarını da dinle
        document.addEventListener('device-connected', (event: Event) => {
          const detail = (event as CustomEvent).detail;
          if (detail && selectedDevice && selectedDevice.key === detail.key) {
            console.log(`Direct device-connected event for selected device ${detail.key}`);
            // Force a refresh of the command panel by updating selectedDevice reference
            setTimeout(() => {
              setSelectedDevice(prev => {
                if (!prev || prev.key !== detail.key) return prev;
                const newLabel = detail.name || prev.label;
                // Only update if label changed to avoid infinite loops
                if (newLabel !== prev.label) {
                  return { ...prev, label: newLabel };
                }
                return prev;
              });
            }, 100); // Small delay to ensure state updates properly
          }
        });
      }
    };
    
    addListeners();
    
    // Cleanup - Önemli: Gerçek event listener fonksiyonlarını temizle
    return () => {
      document.removeEventListener('signalr-response', (event: Event) => {
        const detail = (event as CustomEvent).detail;
        if (detail) {
          handleDeviceResponse(detail.key, detail.name, detail.payload);
        }
      });
      document.removeEventListener('signalr-message', (event: Event) => {
        const detail = (event as CustomEvent).detail;
        if (detail && detail.payload && detail.payload._responseType === 'deviceResponse') {
          const commandName = detail.name;
          const payload = detail.payload;
          handleDeviceResponse(detail.key, commandName, payload);
        }
      });
      document.removeEventListener('signalr-device-connected', (event: Event) => {
        const detail = (event as CustomEvent).detail;
        if (detail) {
          handleDeviceConnected(detail);
        }
      });
      document.removeEventListener('device-connected', (event: Event) => {
        const detail = (event as CustomEvent).detail;
        if (detail && selectedDevice && selectedDevice.key === detail.key) {
          console.log(`Direct device-connected event for selected device ${detail.key}`);
        }
      });
      document.removeEventListener('signalr-device-disconnected', (event: Event) => {
        const detail = (event as CustomEvent).detail;
        if (detail) {
          console.log('Received signalr-device-disconnected event:', detail);
        }
      });
    };
  }, []); // Boş dependency array, sadece bir kez çalıştır
  
  // Load saved keys from localStorage
  useEffect(() => {
    const loadSavedKeys = () => {
      const keysJson = localStorage.getItem('deviceKeys');
      if (keysJson) {
        try {
          const parsed = JSON.parse(keysJson);
          setSavedKeys(parsed);
        } catch (err) {
          console.error('Error parsing saved device keys:', err);
        }
      }
    };
    
    loadSavedKeys();
    
    // Set up event listener for storage changes
    window.addEventListener('storage', loadSavedKeys);
    
    return () => {
      window.removeEventListener('storage', loadSavedKeys);
    };
  }, []);
  
  // Create enhanced devices array with connection status and real device names
  const enhancedDevices = savedKeys.map(saved => {
    const device = devices.find(d => d.key === saved.key);
    // Use the real device name if connected, otherwise use saved label
    const displayName = (device?.isConnected && device?.name) ? device.name : saved.label;
    
    return {
      ...saved,
      displayName,
      isConnected: device?.isConnected || false
    };
  });
  
  // Update saved device names when connected devices' names are received
  useEffect(() => {
    // Only process if we have devices
    if (devices.length === 0) return;
    
    let needsUpdate = false;
    const updatedKeys = [...savedKeys];
    
    devices.forEach(device => {
      // Only process connected devices with names
      if (device.isConnected && device.name) {
        // Find this device in our saved keys
        const savedDeviceIndex = updatedKeys.findIndex(s => s.key === device.key);
        
        if (savedDeviceIndex !== -1) {
          // If the label is different from the device name, update it
          if (updatedKeys[savedDeviceIndex].label !== device.name) {
            updatedKeys[savedDeviceIndex].label = device.name;
            needsUpdate = true;
          }
        }
      }
    });
    
    // If we made any updates, save them to localStorage
    if (needsUpdate) {
      setSavedKeys(updatedKeys);
      localStorage.setItem('deviceKeys', JSON.stringify(updatedKeys));
    }
  }, [devices, savedKeys]);
  
  // Open confirmation dialog before removing a device
  const openRemoveConfirmation = (device: { key: string; label: string }) => {
    setDeviceToRemove(device);
  };
  
  // Function to handle removing a device
  const handleRemoveDevice = () => {
    if (!deviceToRemove) return;
    
    const updated = savedKeys.filter(k => k.key !== deviceToRemove.key);
    setSavedKeys(updated);
    localStorage.setItem('deviceKeys', JSON.stringify(updated));
    
    // If the selected device is being removed, deselect it
    if (selectedDevice?.key === deviceToRemove.key) {
      setSelectedDevice(null);
    }
    
    // Dispatch storage event to notify other components
    window.dispatchEvent(new Event('storage'));
    
    // Close dialog and reset deviceToRemove
    dialogCloseRef.current?.click();
    setDeviceToRemove(null);
  };
  
  // Function to handle adding a device
  const handleAddDevice = async () => {
    if (!newDeviceKey.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      // Check for duplicates
      if (savedKeys.some(k => k.key === newDeviceKey.trim())) {
        alert('This key already exists');
        setIsSubmitting(false);
        return;
      }
      
      // Add the new key with the key as initial label
      const keyToAdd = {
        key: newDeviceKey.trim(),
        label: newDeviceKey.trim(), // Use key as initial label, will be replaced by real name when connected
      };
      
      const updatedKeys = [...savedKeys, keyToAdd];
      
      // Save to localStorage
      localStorage.setItem('deviceKeys', JSON.stringify(updatedKeys));
      
      // Reset form
      setNewDeviceKey('');
      setIsSubmitting(false);
      
      // Close dialog using the ref
      addDialogCloseRef.current?.click();
      
      // Dispatch storage event to notify other components
      window.dispatchEvent(new Event('storage'));
      
    } catch (error) {
      console.error('Error adding device:', error);
      setIsSubmitting(false);
    }
  };

  // Cihaz seçme işlevi
  const handleDeviceSelect = (device: { key: string; label: string }) => {
    if (selectedDevice?.key === device.key) {
      console.log(`Unselecting device ${device.key}`);
      setSelectedDevice(null); // Zaten seçiliyse, seçimi kaldır
    } else {
      console.log(`Selecting device ${device.key}`);
      setSelectedDevice(device); // Değilse, seçimi değiştir
      
      // Seçilen cihazın bağlantı durumunu kontrol et ve logla
      const currentDevice = devices.find(d => d.key === device.key);
      console.log(`Selected device ${device.key}, connection status:`, 
        currentDevice ? `Connected: ${currentDevice.isConnected}` : 'unknown');
      
      // Force trigger a device-connected event if the device is already connected
      // This helps ensure commands are loaded for the selected device
      if (currentDevice?.isConnected) {
        console.log('Device is connected, triggering device-connected event to load commands');
        
        // Try to get commands from localStorage
        try {
          const deviceCommandsKey = `device_commands_${device.key}`;
          const savedCommands = localStorage.getItem(deviceCommandsKey);
          let commands = [];
          
          if (savedCommands) {
            commands = JSON.parse(savedCommands);
            console.log(`Found saved commands for device ${device.key}:`, commands);
          } else {
            console.log(`No saved commands found for device ${device.key}`);
          }
          
          // Create a custom event to trigger the commands panel
          const customEvent = new CustomEvent('device-connected', {
            detail: {
              key: device.key,
              name: device.label,
              isConnected: true,
              payload: {
                commands: commands
              }
            }
          });
          
          console.log('Dispatching manual device-connected event for selected device');
          document.dispatchEvent(customEvent);
        } catch (err) {
          console.error('Error manually triggering device commands:', err);
        }
      }
    }
  };
  
  return (
    <>
      {/* Device list - adjust spacing */}
      <div className="mb-6 md:mb-8">
        <div className="flex flex-wrap gap-2 md:gap-4">
          {enhancedDevices.map((device) => (
            <div 
              key={device.key}
              className={`flex items-center gap-2 md:gap-3 p-2 md:p-3 pl-3 md:pl-4 pr-2 md:pr-3 rounded-lg shadow-sm border cursor-pointer ${
                device.isConnected 
                  ? 'border-green-200 dark:border-green-800 bg-green-50/80 dark:bg-green-900/10' 
                  : 'border-border bg-card'
              } ${
                selectedDevice?.key === device.key 
                  ? 'ring-1 ring-primary ring-offset-1' 
                  : ''
              }`}
              onClick={() => handleDeviceSelect(device)}
            >
              <div className="flex items-center gap-2 md:gap-3">
                <div className="relative">
                  <Monitor className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                  <div 
                    className={`absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ${
                      device.isConnected ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'
                    }`}
                  />
                </div>
                <span className="font-medium text-sm">{device.displayName}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 md:h-7 md:w-7 p-0 rounded-full ml-1 md:ml-1.5"
                onClick={(e) => {
                  e.stopPropagation(); // Tıklama olayının üst elemana geçmesini önle
                  openRemoveConfirmation(device);
                }}
                title="Remove device"
              >
                <X className="h-3 w-3 md:h-3.5 md:w-3.5" />
                <span className="sr-only">Remove</span>
              </Button>
            </div>
          ))}
          
          {/* Add Device Button - Shows + icon if devices exist, full text if no devices */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddDialogOpen(true)}
            className={`flex items-center gap-1 md:gap-1.5 py-2 md:py-2.5 h-auto ${enhancedDevices.length > 0 ? 'px-2 md:px-3' : 'px-3 md:px-3.5'}`}
          >
            <Plus className="h-2 w-4 md:h-5 md:w-5" />
            {enhancedDevices.length === 0 && <span>Add Device</span>}
          </Button>
        </div>
      </div>

      {/* Selected Device Commands Panel - with consistent spacing */}
      {selectedDevice && (
        <DeviceCommandPanel 
          key={`${selectedDevice.key}-${enhancedDevices.find(d => d.key === selectedDevice.key)?.isConnected ? 'connected' : 'disconnected'}`}
          device={selectedDevice} 
          isConnected={enhancedDevices.find(d => d.key === selectedDevice.key)?.isConnected || false} 
        />
      )}

      {/* Remove Device Confirmation Dialog */}
      <Dialog open={!!deviceToRemove} onOpenChange={(open) => !open && setDeviceToRemove(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-1 md:pb-2">
            <DialogTitle className="text-lg md:text-xl">Remove Device</DialogTitle>
          </DialogHeader>
          <div className="py-4 md:py-6">
            Are you sure you want to remove {deviceToRemove?.label}?
          </div>
          <DialogFooter className="gap-2 md:gap-3 sm:gap-2 sm:md:gap-3">
            <DialogClose asChild ref={dialogCloseRef}>
              <Button variant="outline" className="px-3 md:px-5">Cancel</Button>
            </DialogClose>
            <Button 
              variant="destructive" 
              onClick={handleRemoveDevice}
              className="px-3 md:px-5"
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add Device Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-1 md:pb-2">
            <DialogTitle className="text-lg md:text-xl">Add Device</DialogTitle>
          </DialogHeader>
          <div className="py-4 md:py-6">
            <div className="space-y-3 md:space-y-5">
              <div>
                <label htmlFor="newDeviceKey" className="block text-sm font-medium mb-1 md:mb-2">
                  Device Key
                </label>
                <input
                  id="newDeviceKey"
                  type="text"
                  value={newDeviceKey}
                  onChange={(e) => setNewDeviceKey(e.target.value)}
                  className="w-full px-3 md:px-4 py-2 md:py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter device key"
                />
                <p className="text-xs text-muted-foreground mt-1 md:mt-2">
                  When the device connects, its name will be automatically displayed.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 md:gap-3 sm:gap-2 sm:md:gap-3">
            <DialogClose asChild ref={addDialogCloseRef}>
              <Button variant="outline" className="px-3 md:px-5">Cancel</Button>
            </DialogClose>
            <Button 
              onClick={handleAddDevice} 
              disabled={!newDeviceKey.trim() || isSubmitting}
              className="px-3 md:px-5"
            >
              {isSubmitting ? 'Adding...' : 'Add Device'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 