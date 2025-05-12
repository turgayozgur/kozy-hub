import { useState, useEffect } from 'react';
import { useSignalR } from '../lib/SignalRContext';
import { Button } from './ui/button';
import { X } from 'lucide-react';

export function DeviceList() {
  const { devices } = useSignalR();
  const [savedKeys, setSavedKeys] = useState<{ key: string; label: string }[]>([]);
  
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
  
  // Function to handle removing a device
  const handleRemoveDevice = (key: string) => {
    const updated = savedKeys.filter(k => k.key !== key);
    setSavedKeys(updated);
    localStorage.setItem('deviceKeys', JSON.stringify(updated));
    
    // Dispatch storage event to notify other components
    window.dispatchEvent(new Event('storage'));
  };
  
  if (enhancedDevices.length === 0) {
    return null;
  }
  
  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {enhancedDevices.map((device) => (
        <div 
          key={device.key}
          className="flex items-center gap-2 p-2 pl-3 pr-2 bg-card border rounded-lg shadow-sm"
        >
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${device.isConnected ? 'bg-green-500' : 'bg-zinc-400'}`} />
            <span className="font-medium text-sm">{device.label}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 rounded-full"
            onClick={() => handleRemoveDevice(device.key)}
            title="Remove device"
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Remove</span>
          </Button>
        </div>
      ))}
    </div>
  );
} 