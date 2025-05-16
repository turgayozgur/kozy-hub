import { useState, useCallback, useEffect } from 'react';
import { useSignalR } from '../lib/SignalRContext';
import type { CommandStatus, DeviceCommand } from '../types';

export const useDeviceCommands = (deviceKey: string) => {
  const { sendToDevice } = useSignalR();
  const [commands, setCommands] = useState<string[]>([]);
  const [commandStatus, setCommandStatus] = useState<Map<string, DeviceCommand>>(new Map());
  const [imageData, setImageData] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved commands from localStorage
  useEffect(() => {
    try {
      const deviceCommandsKey = `device_commands_${deviceKey}`;
      const savedCommands = localStorage.getItem(deviceCommandsKey);
      
      if (savedCommands) {
        const parsedCommands = JSON.parse(savedCommands);
        console.log(`Loaded saved commands for device ${deviceKey}:`, parsedCommands);
        setCommands(parsedCommands);
        
        // Immediately stop loading if we have commands from localStorage
        setIsLoading(false);
      } else {
        console.log(`No saved commands found for device ${deviceKey} in localStorage`);
        
        // Short delay to finalize loading state only if we don't have commands
        setTimeout(() => setIsLoading(false), 300);
      }
    } catch (err) {
      console.error('Error loading device commands from localStorage:', err);
      setIsLoading(false);
    }
  }, [deviceKey]);

  // Listen for device connection events
  useEffect(() => {
    const handleDeviceInfo = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      
      if (detail && detail.key === deviceKey) {
        // If payload contains commands, save them
        if (detail.payload && Array.isArray(detail.payload.commands)) {
          console.log(`Setting commands for device ${deviceKey}:`, detail.payload.commands);
          setCommands(detail.payload.commands);
          
          // Save commands to localStorage
          try {
            const deviceCommandsKey = `device_commands_${deviceKey}`;
            localStorage.setItem(deviceCommandsKey, JSON.stringify(detail.payload.commands));
          } catch (err) {
            console.error('Error saving device commands to localStorage:', err);
          }
        }
        
        setIsLoading(false);
      }
    };
    
    // Listen for device connected event
    document.addEventListener('device-connected', handleDeviceInfo);
    
    return () => {
      document.removeEventListener('device-connected', handleDeviceInfo);
    };
  }, [deviceKey]);

  // Listen for device command responses
  useEffect(() => {
    const handleResponse = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail && detail.key === deviceKey && detail.originalName) {
        const commandName = detail.originalName;
        const status = detail.payload?.status || 'failed';
        
        console.log(`Device ${deviceKey} command ${commandName} status update:`, status, detail.payload);
        
        // Update command status
        setCommandStatus(prev => {
          const newMap = new Map(prev);
          const existingCommand = newMap.get(commandName);
          
          if (existingCommand) {
            newMap.set(commandName, {
              ...existingCommand,
              status: status as CommandStatus
            });
          } else {
            newMap.set(commandName, {
              name: commandName,
              status: status as CommandStatus,
              timestamp: Date.now()
            });
          }
          
          return newMap;
        });
        
        // Remove completed or failed commands after a delay
        if (['completed', 'failed', 'timeout', 'no-response'].includes(status)) {
          setTimeout(() => {
            setCommandStatus(prev => {
              const newMap = new Map(prev);
              const current = newMap.get(commandName);
              if (current && ['completed', 'failed', 'timeout', 'no-response'].includes(current.status)) {
                newMap.delete(commandName);
              }
              return newMap;
            });
          }, 2000);
        }
      }
    };
    
    // Listen for device response event
    document.addEventListener('device-response', handleResponse);
    
    return () => {
      document.removeEventListener('device-response', handleResponse);
    };
  }, [deviceKey]);

  // Listen for image data from device
  useEffect(() => {
    const handleDeviceMessage = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      
      if (detail && detail.key === deviceKey) {
        // If message contains image data, save it
        if (detail.payload && detail.payload.image) {
          console.log('Received image data from device');
          setImageData(detail.payload.image);
        }
      }
    };
    
    // Listen for SignalR messages
    document.addEventListener('signalr-message', handleDeviceMessage);
    
    return () => {
      document.removeEventListener('signalr-message', handleDeviceMessage);
    };
  }, [deviceKey]);

  // Execute a command
  const executeCommand = useCallback(async (commandName: string) => {
    // Skip if command is already in progress
    const currentCommand = commandStatus.get(commandName);
    if (currentCommand && ['sending', 'accepted', 'running'].includes(currentCommand.status)) {
      return;
    }
    
    const executionTimestamp = Date.now();
    
    // Set initial status to 'sending'
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
      // Send command to device
      await sendToDevice(deviceKey, commandName, null);
      
      // Handle no-response after 5 seconds
      const noResponseTimeout = setTimeout(() => {
        setCommandStatus(prev => {
          const newMap = new Map(prev);
          const command = newMap.get(commandName);
          
          if (command && command.timestamp === executionTimestamp && command.status === 'sending') {
            newMap.set(commandName, {
              ...command,
              status: 'no-response'
            });
            
            // Reset after 2 seconds
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
      }, 5000);
      
      // Handle timeout after 10 seconds
      setTimeout(() => {
        setCommandStatus(prev => {
          const newMap = new Map(prev);
          const command = newMap.get(commandName);
          
          if (command && command.timestamp === executionTimestamp && command.status === 'sending') {
            newMap.set(commandName, {
              ...command,
              status: 'timeout'
            });
            
            // Reset after 2 seconds
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
      
      // Set status to 'failed'
      setCommandStatus(prev => {
        const newMap = new Map(prev);
        newMap.set(commandName, {
          name: commandName,
          status: 'failed',
          timestamp: executionTimestamp
        });
        return newMap;
      });
      
      // Reset after 2 seconds
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
  }, [deviceKey, sendToDevice, commandStatus]);

  return {
    commands,
    commandStatus,
    imageData,
    isLoading,
    executeCommand
  };
}; 