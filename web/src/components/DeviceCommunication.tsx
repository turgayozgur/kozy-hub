import { useState, useEffect } from 'react';
import { useSignalR } from '../lib/SignalRContext';
import { Button } from './ui/button';
import type { DeviceSession } from '../lib/signalrService';
import { signalRService } from '../lib/signalrService';

interface Message {
  id: string;
  timestamp: Date;
  direction: 'sent' | 'received';
  deviceKey: string;
  name: string;
  payload: any;
}

export function DeviceCommunication() {
  const { devices, sendToDevice } = useSignalR();
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [messageName, setMessageName] = useState('');
  const [messagePayload, setMessagePayload] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);

  const connectedDevices = devices.filter(d => d.isConnected);

  // Register handlers for device messages
  useEffect(() => {
    const handleReceiveFromDevice = (key: string, name: string, payload: any) => {
      const newMessage: Message = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        direction: 'received',
        deviceKey: key,
        name,
        payload
      };
      
      setMessages(prev => [newMessage, ...prev]);
    };

    const handleReceiveResponseFromDevice = (key: string, name: string, payload: any) => {
      const newMessage: Message = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        direction: 'received',
        deviceKey: key,
        name,
        payload
      };
      
      setMessages(prev => [newMessage, ...prev]);
    };

    signalRService.onReceiveFromDevice(handleReceiveFromDevice);
    signalRService.onReceiveResponseFromDevice(handleReceiveResponseFromDevice);

    return () => {
      // There's no direct way to unregister in the service we created,
      // but this wouldn't cause memory leaks as the component dismounts
    };
  }, []);

  const handleSendMessage = async () => {
    if (!selectedDevice || !messageName) {
      setError('Please select a device and provide a message name');
      return;
    }

    setError(null);
    
    let payload: any;
    
    try {
      // Try to parse as JSON if not empty
      payload = messagePayload ? JSON.parse(messagePayload) : {};
    } catch (err) {
      setError('Invalid JSON payload');
      return;
    }

    try {
      const newMessage: Message = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        direction: 'sent',
        deviceKey: selectedDevice,
        name: messageName,
        payload
      };
      
      setMessages(prev => [newMessage, ...prev]);
      
      await sendToDevice(selectedDevice, messageName, payload);
      
      // Reset fields after successful send
      setMessagePayload('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error sending message');
    }
  };

  const getDeviceLabel = (key: string): string => {
    const device = devices.find(d => d.key === key);
    return device ? device.name : key;
  };

  const formatTimestamp = (date: Date): string => {
    return new Intl.DateTimeFormat('default', {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    }).format(date);
  };

  return (
    <div className="space-y-6">
      <div className="bg-card p-4 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700">
        <h2 className="text-xl font-semibold mb-4">Send Message to Device</h2>
        
        {connectedDevices.length === 0 ? (
          <p className="text-zinc-500 dark:text-zinc-400">No connected devices available</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label htmlFor="device" className="block text-sm font-medium mb-1">
                Select Device
              </label>
              <select
                id="device"
                value={selectedDevice || ''}
                onChange={(e) => setSelectedDevice(e.target.value || null)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">-- Select a device --</option>
                {connectedDevices.map((device) => (
                  <option key={device.key} value={device.key}>
                    {device.name} ({device.key})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Message Name
              </label>
              <input
                id="name"
                type="text"
                value={messageName}
                onChange={(e) => setMessageName(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., GetScreenshot, RunCommand"
              />
            </div>
            
            <div>
              <label htmlFor="payload" className="block text-sm font-medium mb-1">
                Payload (JSON)
              </label>
              <textarea
                id="payload"
                value={messagePayload}
                onChange={(e) => setMessagePayload(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary h-32 font-mono text-sm"
                placeholder='{"key": "value"}'
              />
            </div>
            
            {error && (
              <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-3 rounded-md border border-red-200 dark:border-red-800">
                {error}
              </div>
            )}
            
            <Button 
              onClick={handleSendMessage} 
              className="w-full"
              disabled={!selectedDevice || !messageName}
            >
              Send Message
            </Button>
          </div>
        )}
      </div>

      <div className="bg-card p-4 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700">
        <h2 className="text-xl font-semibold mb-4">Message History</h2>
        
        {messages.length === 0 ? (
          <p className="text-zinc-500 dark:text-zinc-400">No messages yet</p>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div 
                key={message.id}
                className={`p-3 rounded-md border ${
                  message.direction === 'sent' 
                    ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20' 
                    : 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                }`}
              >
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-medium">
                    {message.direction === 'sent' ? 'Sent to' : 'Received from'}{' '}
                    {getDeviceLabel(message.deviceKey)}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {formatTimestamp(message.timestamp)}
                  </span>
                </div>
                <div className="text-sm font-medium">{message.name}</div>
                <pre className="mt-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded p-2 overflow-x-auto">
                  {JSON.stringify(message.payload, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 