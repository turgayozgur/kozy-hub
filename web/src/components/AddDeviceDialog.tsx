import { useState, useCallback, useRef } from 'react';
import { useSignalR } from '../lib/SignalRContext';
import { Button } from './ui/button';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from './ui/dialog';

export function AddDeviceDialog() {
  const [deviceKey, setDeviceKey] = useState('');
  const { subscribeToDevices } = useSignalR();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogCloseRef = useRef<HTMLButtonElement>(null);

  const handleAddDevice = useCallback(async () => {
    if (!deviceKey.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      // Get existing keys from localStorage
      const savedKeys = localStorage.getItem('deviceKeys');
      const parsedKeys = savedKeys ? JSON.parse(savedKeys) : [];
      
      // Check for duplicates
      if (parsedKeys.some((k: { key: string }) => k.key === deviceKey.trim())) {
        alert('This key already exists');
        setIsSubmitting(false);
        return;
      }
      
      // Add the new key
      const keyToAdd = {
        key: deviceKey.trim(),
        label: deviceKey.trim(),
      };
      
      const updatedKeys = [...parsedKeys, keyToAdd];
      
      // Save to localStorage
      localStorage.setItem('deviceKeys', JSON.stringify(updatedKeys));
      
      // Subscribe to the new key
      await subscribeToDevices([keyToAdd.key]);
      
      // Reset form
      setDeviceKey('');
      setIsSubmitting(false);
      
      // Close dialog using the ref
      dialogCloseRef.current?.click();
      
      // Dispatch storage event to notify other components
      window.dispatchEvent(new Event('storage'));
      
    } catch (error) {
      console.error('Error adding device:', error);
      setIsSubmitting(false);
    }
  }, [deviceKey, subscribeToDevices]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="flex items-center gap-1"
        >
          <Plus className="h-4 w-4" />
          <span>Add Device</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Device</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div className="space-y-4">
            <div>
              <label htmlFor="deviceKey" className="block text-sm font-medium mb-1">
                Device Key
              </label>
              <input
                id="deviceKey"
                type="text"
                value={deviceKey}
                onChange={(e) => setDeviceKey(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter device key"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild ref={dialogCloseRef}>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button 
            onClick={handleAddDevice} 
            disabled={!deviceKey.trim() || isSubmitting}
          >
            {isSubmitting ? 'Adding...' : 'Add Device'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 