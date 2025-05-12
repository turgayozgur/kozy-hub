import { useState, useEffect, useRef } from 'react';
import { useSignalR } from '../lib/SignalRContext';
import { Button } from './ui/button';
import { Monitor, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from './ui/dialog';

export function DeviceList() {
  const { devices } = useSignalR();
  const [savedKeys, setSavedKeys] = useState<{ key: string; label: string }[]>([]);
  const [deviceToRemove, setDeviceToRemove] = useState<{ key: string; label: string } | null>(null);
  const dialogCloseRef = useRef<HTMLButtonElement>(null);
  
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
  
  // Create enhanced devices array with connection status
  const enhancedDevices = savedKeys.map(saved => {
    const device = devices.find(d => d.key === saved.key);
    return {
      ...saved,
      isConnected: device?.isConnected || false
    };
  });
  
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
    
    // Dispatch storage event to notify other components
    window.dispatchEvent(new Event('storage'));
    
    // Close dialog and reset deviceToRemove
    dialogCloseRef.current?.click();
    setDeviceToRemove(null);
  };
  
  if (enhancedDevices.length === 0) {
    return null;
  }
  
  return (
    <>
      <div className="flex flex-wrap gap-3 mb-6">
        {enhancedDevices.map((device) => (
          <div 
            key={device.key}
            className={`flex items-center gap-2 p-2 pl-3 pr-2 rounded-lg shadow-sm border ${
              device.isConnected 
                ? 'border-green-200 dark:border-green-800 bg-green-50/80 dark:bg-green-900/10' 
                : 'border-border bg-card'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="relative">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                <div 
                  className={`absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ${
                    device.isConnected ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'
                  }`}
                />
              </div>
              <span className="font-medium text-sm">{device.label}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 rounded-full"
              onClick={() => openRemoveConfirmation(device)}
              title="Remove device"
            >
              <X className="h-3 w-3" />
              <span className="sr-only">Remove</span>
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={!!deviceToRemove} onOpenChange={(open) => !open && setDeviceToRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Device</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            Are you sure you want to remove {deviceToRemove?.label}?
          </div>
          <DialogFooter>
            <DialogClose asChild ref={dialogCloseRef}>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button 
              variant="destructive" 
              onClick={handleRemoveDevice}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 