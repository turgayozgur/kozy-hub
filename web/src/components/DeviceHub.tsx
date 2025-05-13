import { useState, useEffect } from 'react';
import { DeviceList } from './DeviceList';
import { useSignalR } from '../lib/SignalRContext';

export function DeviceHub() {
  const { isConnected, subscribeToDevices } = useSignalR();
  const [subscribedKeys, setSubscribedKeys] = useState<string[]>([]);
  
  // Subscribe to saved device keys when connected
  useEffect(() => {
    if (!isConnected) return;
    
    // Get saved device keys from localStorage
    const savedKeysJson = localStorage.getItem('deviceKeys');
    if (!savedKeysJson) return;
    
    try {
      const savedKeysData = JSON.parse(savedKeysJson);
      const keys = savedKeysData.map((item: { key: string }) => item.key);
      
      if (keys.length > 0) {
        // Only subscribe if we have keys and we haven't subscribed to these exact keys yet
        const needsSubscription = !subscribedKeys.every((k: string) => keys.includes(k)) || 
                               !keys.every((k: string) => subscribedKeys.includes(k));
                               
        if (needsSubscription) {
          console.log('Subscribing to devices:', keys);
          subscribeToDevices(keys)
            .then(() => {
              setSubscribedKeys(keys);
              console.log('Successfully subscribed to devices');
            })
            .catch(err => {
              console.error('Failed to subscribe to devices:', err);
            });
        }
      }
    } catch (err) {
      console.error('Error parsing saved device keys:', err);
    }
  }, [isConnected, subscribeToDevices, subscribedKeys]);
  
  // Listen for storage events (when device keys are added/removed in other tabs/components)
  useEffect(() => {
    const handleStorageChange = () => {
      if (!isConnected) return;
      
      const savedKeysJson = localStorage.getItem('deviceKeys');
      if (!savedKeysJson) return;
      
      try {
        const savedKeysData = JSON.parse(savedKeysJson);
        const keys = savedKeysData.map((item: { key: string }) => item.key);
        
        if (keys.length > 0 && keys.toString() !== subscribedKeys.toString()) {
          console.log('Device keys changed, resubscribing:', keys);
          subscribeToDevices(keys)
            .then(() => {
              setSubscribedKeys(keys);
              console.log('Successfully resubscribed to devices');
            })
            .catch(err => {
              console.error('Failed to resubscribe to devices:', err);
            });
        }
      } catch (err) {
        console.error('Error parsing saved device keys after storage change:', err);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isConnected, subscribeToDevices, subscribedKeys]);

  return (
    <div className="container py-2 md:py-4">
      <DeviceList />
    </div>
  );
} 