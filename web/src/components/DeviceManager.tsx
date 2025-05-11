import { useState, useEffect, useRef, useCallback } from 'react';
import { useSignalR } from '../lib/SignalRContext';
import { Button } from './ui/button';

interface DeviceKey {
  key: string;
  label: string;
}

export function DeviceManager() {
  const [keys, setKeys] = useState<DeviceKey[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const { subscribeToDevices } = useSignalR();
  const initialLoadDone = useRef(false);

  // Load saved keys from localStorage only once on component mount
  useEffect(() => {
    if (initialLoadDone.current) return;
    
    const savedKeys = localStorage.getItem('deviceKeys');
    if (savedKeys) {
      try {
        const parsedKeys = JSON.parse(savedKeys);
        setKeys(parsedKeys);
        initialLoadDone.current = true;
        
        // Subscribe to all saved keys
        if (parsedKeys.length > 0) {
          const keyStrings = parsedKeys.map((k: DeviceKey) => k.key);
          subscribeToDevices(keyStrings).catch(console.error);
        }
      } catch (err) {
        console.error('Error parsing saved keys:', err);
      }
    } else {
      initialLoadDone.current = true;
    }
  // Remove subscribeToDevices from the dependency array to avoid infinite loops
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save keys to localStorage when they change
  useEffect(() => {
    // Skip the initial render to avoid unnecessary saves
    if (!initialLoadDone.current) return;
    
    localStorage.setItem('deviceKeys', JSON.stringify(keys));
  }, [keys]);

  // Memoize the addKey function to prevent recreating it on each render
  const addKey = useCallback(() => {
    if (!newKey.trim()) return;
    
    const keyToAdd = {
      key: newKey.trim(),
      label: newLabel.trim() || newKey.trim(),
    };
    
    // Check for duplicates
    if (keys.some(k => k.key === keyToAdd.key)) {
      alert('This key already exists');
      return;
    }
    
    const updatedKeys = [...keys, keyToAdd];
    setKeys(updatedKeys);
    
    // Subscribe to the new key
    subscribeToDevices([keyToAdd.key]).catch(console.error);
    
    // Reset input fields
    setNewKey('');
    setNewLabel('');
  }, [keys, newKey, newLabel, subscribeToDevices]);

  // Memoize the removeKey function
  const removeKey = useCallback((keyToRemove: string) => {
    setKeys(prevKeys => prevKeys.filter(k => k.key !== keyToRemove));
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-card p-4 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700">
        <h2 className="text-xl font-semibold mb-4">Add Device Key</h2>
        <div className="space-y-3">
          <div>
            <label htmlFor="key" className="block text-sm font-medium mb-1">
              Device Key
            </label>
            <input
              id="key"
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter device key"
            />
          </div>
          <div>
            <label htmlFor="label" className="block text-sm font-medium mb-1">
              Label (optional)
            </label>
            <input
              id="label"
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter a friendly name"
            />
          </div>
          <Button 
            onClick={addKey} 
            disabled={!newKey.trim()}
            className="w-full"
          >
            Add Device
          </Button>
        </div>
      </div>

      <div className="bg-card p-4 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700">
        <h2 className="text-xl font-semibold mb-4">Your Devices</h2>
        {keys.length === 0 ? (
          <p className="text-muted-foreground">No device keys added yet</p>
        ) : (
          <div className="space-y-2">
            {keys.map((keyItem) => (
              <div 
                key={keyItem.key}
                className="flex items-center justify-between p-3 border border-zinc-200 dark:border-zinc-700 rounded-md bg-zinc-50 dark:bg-zinc-800/50"
              >
                <div className="flex items-center space-x-3">
                  <div>
                    <p className="font-medium">{keyItem.label}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{keyItem.key}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => removeKey(keyItem.key)}
                    className="border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 