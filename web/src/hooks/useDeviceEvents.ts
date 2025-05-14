import { useCallback, useEffect } from 'react';

interface DeviceEventOptions {
  onDeviceConnected?: (detail: any) => void;
  onDeviceDisconnected?: (detail: any) => void;
  onDeviceResponse?: (detail: any) => void;
  onDeviceMessage?: (detail: any) => void;
}

export const useDeviceEvents = (options: DeviceEventOptions = {}) => {
  const { 
    onDeviceConnected, 
    onDeviceDisconnected, 
    onDeviceResponse, 
    onDeviceMessage 
  } = options;

  // Transform SignalR events to custom device events
  const transformSignalREvents = useCallback(() => {
    // Handle device responses from SignalR
    const handleSignalRResponse = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail) return;

      // Transform to device-response event
      const deviceEvent = new CustomEvent('device-response', {
        detail: { 
          key: detail.key, 
          originalName: detail.name, 
          payload: detail.payload 
        }
      });
      document.dispatchEvent(deviceEvent);

      // Call the callback if provided
      if (onDeviceResponse) {
        onDeviceResponse(detail);
      }
    };

    // Handle device messages from SignalR
    const handleSignalRMessage = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail || !detail.payload) return;

      // Call the callback if provided
      if (onDeviceMessage) {
        onDeviceMessage(detail);
      }

      // If it's a device response via the test panel
      if (detail.payload._responseType === 'deviceResponse') {
        const commandName = detail.name;
        
        // Create a device response event
        const deviceEvent = new CustomEvent('device-response', {
          detail: { 
            key: detail.key, 
            originalName: commandName, 
            payload: detail.payload 
          }
        });
        document.dispatchEvent(deviceEvent);

        // Call the callback if provided
        if (onDeviceResponse) {
          onDeviceResponse({
            key: detail.key,
            name: commandName,
            payload: detail.payload
          });
        }
      }
    };

    // Handle device connections from SignalR
    const handleSignalRDeviceConnected = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail || !detail.key) return;

      // Extract commands from the payload
      let commands = [];
      if (detail.payload && Array.isArray(detail.payload.commands)) {
        commands = detail.payload.commands;
      } else if (detail.commands && Array.isArray(detail.commands)) {
        commands = detail.commands;
      }

      // Create a device connected event
      const deviceEvent = new CustomEvent('device-connected', {
        detail: { 
          key: detail.key, 
          name: detail.name || detail.key,
          isConnected: detail.isConnected !== undefined ? detail.isConnected : true,
          payload: {
            commands: commands
          }
        }
      });
      document.dispatchEvent(deviceEvent);

      // Call the callback if provided
      if (onDeviceConnected) {
        console.log('Calling onDeviceConnected callback with device:', deviceEvent.detail);
        onDeviceConnected(deviceEvent.detail);
      }
    };

    // Also handle direct device-connected events that are manually triggered
    const handleDirectDeviceConnected = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail || !detail.key) return;
      
      // Call the callback if provided - this is important for reconnected devices
      if (onDeviceConnected) {
        console.log('Calling onDeviceConnected callback from direct event with device:', detail);
        onDeviceConnected(detail);
      }
    };

    // Handle device disconnections from SignalR
    const handleSignalRDeviceDisconnected = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail || !detail.key) return;

      // Create a device disconnected event
      const deviceEvent = new CustomEvent('device-disconnected', {
        detail: { 
          key: detail.key,
          name: detail.name || detail.key
        }
      });
      document.dispatchEvent(deviceEvent);

      // Call the callback if provided
      if (onDeviceDisconnected) {
        onDeviceDisconnected(deviceEvent.detail);
      }
    };

    // Add event listeners
    document.addEventListener('signalr-response', handleSignalRResponse);
    document.addEventListener('signalr-message', handleSignalRMessage);
    document.addEventListener('signalr-device-connected', handleSignalRDeviceConnected);
    document.addEventListener('signalr-device-disconnected', handleSignalRDeviceDisconnected);
    document.addEventListener('device-connected', handleDirectDeviceConnected);

    // Return cleanup function
    return () => {
      document.removeEventListener('signalr-response', handleSignalRResponse);
      document.removeEventListener('signalr-message', handleSignalRMessage);
      document.removeEventListener('signalr-device-connected', handleSignalRDeviceConnected);
      document.removeEventListener('signalr-device-disconnected', handleSignalRDeviceDisconnected);
      document.removeEventListener('device-connected', handleDirectDeviceConnected);
    };
  }, [onDeviceConnected, onDeviceDisconnected, onDeviceResponse, onDeviceMessage]);

  // Set up event handlers
  useEffect(() => {
    const cleanup = transformSignalREvents();
    return cleanup;
  }, [transformSignalREvents]);

  // Helper to trigger a device connected event manually
  const triggerDeviceConnected = useCallback((device: { 
    key: string; 
    name?: string; 
    commands?: string[];
  }) => {
    // Try to get commands from localStorage
    try {
      const deviceCommandsKey = `device_commands_${device.key}`;
      const savedCommands = localStorage.getItem(deviceCommandsKey);
      let commands = device.commands || [];
      
      if (savedCommands) {
        commands = JSON.parse(savedCommands);
      }
      
      // Create a custom event to trigger the commands panel
      const customEvent = new CustomEvent('device-connected', {
        detail: {
          key: device.key,
          name: device.name || device.key,
          isConnected: true,
          payload: {
            commands: commands
          }
        }
      });
      
      console.log('Dispatching manual device-connected event');
      document.dispatchEvent(customEvent);
      
      // Also dispatch a manual-device-update event to ensure the name is updated in the UI
      const updateEvent = new CustomEvent('manual-device-update', {
        detail: {
          key: device.key,
          name: device.name || device.key
        }
      });
      document.dispatchEvent(updateEvent);
    } catch (err) {
      console.error('Error manually triggering device connected event:', err);
    }
  }, []);

  // Helper to update a device name
  const updateDeviceName = useCallback((deviceKey: string, deviceName: string) => {
    try {
      // Create a device name update event
      const updateEvent = new CustomEvent('manual-device-update', {
        detail: {
          key: deviceKey,
          name: deviceName
        }
      });
      document.dispatchEvent(updateEvent);
    } catch (err) {
      console.error('Error updating device name:', err);
    }
  }, []);

  return {
    triggerDeviceConnected,
    updateDeviceName
  };
}; 