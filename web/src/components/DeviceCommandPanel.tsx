import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Loader2, MoreHorizontal } from 'lucide-react';
import { ContentFrame } from './ContentFrame';
import { useDeviceCommands } from '../hooks/useDeviceCommands';
import { getCommandStatusInfo, isCommandInProgress } from '../utils';
import type { Device } from '../types';

interface DeviceCommandPanelProps {
  device: Device;
  isConnected: boolean;
}

export function DeviceCommandPanel({ device, isConnected }: DeviceCommandPanelProps) {
  const [localIsConnected, setLocalIsConnected] = useState(isConnected);
  
  // Use the device commands hook
  const {
    commands,
    commandStatus, 
    imageData,
    isLoading,
    executeCommand
  } = useDeviceCommands(device.key);

  // Update local connection state when prop changes
  useEffect(() => {
    setLocalIsConnected(isConnected);
    console.log(`DeviceCommandPanel: isConnected prop changed to ${isConnected} for device ${device.key}`);
  }, [isConnected, device.key]);

  // If device is not connected, show disconnected message
  if (!localIsConnected) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <p className="text-sm text-muted-foreground text-center">
          Device is disconnected. Connect the device to view available commands.
        </p>
      </div>
    );
  }

  // Skip loading state for already connected devices
  const shouldShowLoader = isLoading && commands.length === 0;

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <div className="flex-1 w-full overflow-hidden flex flex-col">
        {shouldShowLoader ? (
          <div className="h-full w-full flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : commands.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground text-center py-4 px-3 border rounded-lg">
              No commands available for this device.
            </p>
          </div>
        ) : (
          <div className="flex flex-col h-full w-full">
            {/* Command buttons */}
            <div className="flex flex-wrap gap-4 px-4 py-4 w-full">
              {commands.map(cmd => {
                const { icon, color, label } = getCommandStatusInfo(cmd, commandStatus);
                const isDisabled = isCommandInProgress(cmd, commandStatus);
                
                return (
                  <Button
                    key={cmd}
                    variant="outline"
                    size="sm"
                    className={`flex items-start justify-start gap-2 h-14 py-2 px-4 min-w-[130px] shadow-sm hover:shadow`}
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
            
            {/* Content frame - fixed aspect ratio container */}
            <div className="flex-1 w-full min-h-0 overflow-hidden">
              <ContentFrame imageData={imageData} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 