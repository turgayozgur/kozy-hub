import { useState, useEffect, useRef } from 'react';
import { useSignalR } from '../lib/SignalRContext';
import { Button } from './ui/button';
import { Monitor, X, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from './ui/dialog';
import { createPortal } from 'react-dom';
import { DeviceCommandPanel } from './DeviceCommandPanel';
import { useDeviceEvents } from '../hooks/useDeviceEvents';
import type { Device } from '../types';

export function DeviceList() {
  const { devices } = useSignalR();
  const [savedKeys, setSavedKeys] = useState<Device[]>([]);
  const [deviceToRemove, setDeviceToRemove] = useState<Device | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newDeviceKey, setNewDeviceKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const dialogCloseRef = useRef<HTMLButtonElement>(null);
  const addDialogCloseRef = useRef<HTMLButtonElement>(null);
  
  // Initialize device events handling
  const { triggerDeviceConnected } = useDeviceEvents();
  
  // Basit bir device isim güncelleme fonksiyonu
  const updateDeviceNames = () => {
    let hasUpdates = false;
    const updatedKeys = [...savedKeys];
    
    // Bağlı cihazları kontrol et ve isimlerini güncelle
    devices.forEach(device => {
      if (device.isConnected && device.name) {
        const index = updatedKeys.findIndex(k => k.key === device.key);
        if (index !== -1 && updatedKeys[index].label !== device.name) {
          console.log(`Updating device name for ${device.key} from "${updatedKeys[index].label}" to "${device.name}"`);
          updatedKeys[index].label = device.name;
          hasUpdates = true;
        }
      }
    });
    
    // Değişiklik varsa state'i güncelle
    if (hasUpdates) {
      setSavedKeys(updatedKeys);
      localStorage.setItem('deviceKeys', JSON.stringify(updatedKeys));
      
      // Seçili cihazı da güncelle
      if (selectedDevice) {
        const device = devices.find(d => d.key === selectedDevice.key);
        if (device && device.isConnected && device.name && selectedDevice.label !== device.name) {
          setSelectedDevice(prev => {
            if (!prev) return null;
            return { ...prev, label: device.name! };
          });
        }
      }
    }
  };
  
  // SignalR olaylarını dinle
  useEffect(() => {
    // Cihaz bağlandığında isim güncellemelerini kontrol et
    const handleDeviceConnected = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail && detail.key && detail.name) {
        const deviceKey = detail.key;
        const deviceName = detail.name;
        
        // Küçük bir gecikme ile güncelleme işlemini yap
        setTimeout(() => {
          setSavedKeys(prev => {
            const updated = [...prev];
            const index = updated.findIndex(k => k.key === deviceKey);
            
            if (index !== -1 && updated[index].label !== deviceName) {
              console.log(`Event: Updating device name for ${deviceKey} from "${updated[index].label}" to "${deviceName}"`);
              updated[index].label = deviceName;
              
              // LocalStorage'a kaydet
              localStorage.setItem('deviceKeys', JSON.stringify(updated));
              
              return updated;
            }
            return prev;
          });
          
          // Seçili cihazı da güncelle - ayrı bir çağrı olarak yap
          if (selectedDevice && selectedDevice.key === deviceKey) {
            setSelectedDevice(old => {
              if (!old) return null;
              return { ...old, label: deviceName };
            });
          }
        }, 100); // Küçük bir gecikme ile React state güncellemelerinin çakışmasını önle
      }
    };

    // Handle manual device updates explicitly
    const handleManualDeviceUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail && detail.key && detail.name) {
        const deviceKey = detail.key;
        const deviceName = detail.name;
        
        setSavedKeys(prev => {
          const updated = [...prev];
          const index = updated.findIndex(k => k.key === deviceKey);
          
          if (index !== -1 && updated[index].label !== deviceName) {
            console.log(`Manual update: Updating device name for ${deviceKey} from "${updated[index].label}" to "${deviceName}"`);
            updated[index].label = deviceName;
            
            // LocalStorage'a kaydet
            localStorage.setItem('deviceKeys', JSON.stringify(updated));
            
            return updated;
          }
          return prev;
        });
        
        // Seçili cihazı da güncelle
        if (selectedDevice && selectedDevice.key === deviceKey) {
          setSelectedDevice(old => {
            if (!old) return null;
            return { ...old, label: deviceName };
          });
        }
      }
    };
    
    // Event listener'ları ekle
    document.addEventListener('signalr-device-connected', handleDeviceConnected);
    document.addEventListener('device-connected', handleDeviceConnected);
    document.addEventListener('manual-device-update', handleManualDeviceUpdate);
    
    // Debug için doğrudan çağır - bağlı cihazların hepsinin isimlerini güncelle
    devices.forEach(device => {
      if (device.isConnected && device.name) {
        const fakeEvent = new CustomEvent('manual-device-update', { 
          detail: { key: device.key, name: device.name } 
        });
        handleManualDeviceUpdate(fakeEvent);
      }
    });
    
    return () => {
      document.removeEventListener('signalr-device-connected', handleDeviceConnected);
      document.removeEventListener('device-connected', handleDeviceConnected);
      document.removeEventListener('manual-device-update', handleManualDeviceUpdate);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Cihaz listesi her değiştiğinde isimleri güncelle (daha güvenli bir yaklaşım)
  useEffect(() => {
    if (devices.length > 0 && savedKeys.length > 0) {
      // İsim güncellemelerini hemen yap
      updateDeviceNames();
      
      // Bağlı cihazlar için manual-device-update event'i tetikle
      devices.forEach(device => {
        if (device.isConnected && device.name) {
          // İsim değişikliğini zorlayarak güncellemek için event tetikle
          const updateEvent = new CustomEvent('manual-device-update', { 
            detail: { key: device.key, name: device.name } 
          });
          document.dispatchEvent(updateEvent);
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices]);
  
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
    
    // If the real device name is available but different from the saved label,
    // update the saved label in the next render cycle to ensure consistency
    if (device?.isConnected && device?.name && saved.label !== device.name) {
      // Schedule an update with a slight delay to avoid render conflicts
      setTimeout(() => {
        setSavedKeys(prev => {
          const updatedKeys = [...prev];
          const index = updatedKeys.findIndex(k => k.key === saved.key);
          if (index !== -1 && updatedKeys[index].label !== device.name) {
            console.log(`Auto-updating device name from ${updatedKeys[index].label} to ${device.name}`);
            updatedKeys[index].label = device.name;
            localStorage.setItem('deviceKeys', JSON.stringify(updatedKeys));
            return updatedKeys;
          }
          return prev;
        });
      }, 0);
    }
    
    return {
      ...saved,
      displayName,
      isConnected: device?.isConnected || false
    };
  });
  
  // Handle device selection
  const handleDeviceSelect = (device: Device) => {
    if (selectedDevice?.key === device.key) {
      setSelectedDevice(null);
    } else {
      setSelectedDevice(device);
      
      // Check connection status and trigger events if necessary
      const currentDevice = devices.find(d => d.key === device.key);
      
      if (currentDevice?.isConnected) {
        // If device is connected, trigger a connected event to load commands
        triggerDeviceConnected({
          key: device.key,
          name: device.label
        });
      }
    }
  };
  
  // Open confirmation dialog before removing a device
  const openRemoveConfirmation = (device: Device) => {
    setDeviceToRemove(device);
  };
  
  // Handle removing a device
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
  
  // Handle adding a device
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
        label: newDeviceKey.trim(), // Use key as initial label
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
      
      // Update local state
      setSavedKeys(updatedKeys);
      
    } catch (error) {
      console.error('Error adding device:', error);
      setIsSubmitting(false);
    }
  };
  
  // Render main content with commands panel
  const renderMainContent = () => {
    if (!selectedDevice) {
      return (
        <div className="h-full flex items-center justify-center">
          <p className="text-muted-foreground">Select a device to view commands</p>
        </div>
      );
    }
    
    const isConnected = enhancedDevices.find(d => d.key === selectedDevice.key)?.isConnected || false;
    
    // Render main content with a fixed size container to prevent layout shifts
    return (
      <div className="h-full w-full overflow-hidden">
      <DeviceCommandPanel 
        key={`${selectedDevice.key}-${isConnected ? 'connected' : 'disconnected'}`}
        device={selectedDevice} 
        isConnected={isConnected} 
      />
      </div>
    );
  };
  
  return (
    <>
      {/* Device list - vertical layout for sidebar */}
      <div className="space-y-4 w-full">
        {/* Devices as vertical list */}
        <div className="space-y-4 px-2">
          {enhancedDevices.map((device) => (
            <div 
              key={device.key}
              className={`group flex items-center justify-between py-3 px-4 rounded-md border cursor-pointer ${
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
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <div 
                    className={`absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ${
                      device.isConnected ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'
                    }`}
                  />
                </div>
                <span className="font-medium">{device.displayName}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  openRemoveConfirmation(device);
                }}
                title="Remove device"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Remove</span>
              </Button>
            </div>
          ))}
        </div>
        
        {/* Add Device Button */}
        <div className="px-2">
          <Button
            variant="outline"
            size="default"
            onClick={() => setIsAddDialogOpen(true)}
            className="w-full py-2"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Device
          </Button>
        </div>
      </div>
      
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
      
      {/* Inject the main content via portal into the main-content div */}
      {typeof document !== 'undefined' && document.getElementById('main-content') && 
        createPortal(
          <div className="h-full w-full overflow-hidden fixed-size-container">
            {renderMainContent()}
          </div>,
          document.getElementById('main-content')!
        )
      }
    </>
  );
} 