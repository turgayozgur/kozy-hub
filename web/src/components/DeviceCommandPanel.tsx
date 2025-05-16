import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Loader2, MoreHorizontal, ImageIcon, PinIcon, Camera } from 'lucide-react';
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
  const [showScreenshot, setShowScreenshot] = useState(false);
  
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

  // When a new screenshot is received, show it
  useEffect(() => {
    if (imageData) {
      setShowScreenshot(true);
    }
  }, [imageData]);

  // Handler for screenshot button
  const handleScreenshotRequest = () => {
    executeCommand('screenshot');
  };

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
            {/* Command navigation */}
            <div className="w-full border-b overflow-x-auto">
              <div className="flex w-full">
                {/* Pinned Screenshot Command */}
                <div className="flex-shrink-0 border-r">
                  <button
                    onClick={() => executeCommand('screenshot')}
                    disabled={isCommandInProgress('screenshot', commandStatus)}
                    className={`px-6 py-4 flex items-start gap-2 hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors bg-gray-50/50 dark:bg-gray-900/30 ${
                      isCommandInProgress('screenshot', commandStatus) ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-center mt-1 text-blue-500">
                      <PinIcon className="h-3 w-3 mr-1" />
                      <Camera className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Screenshot</span>
                      <span className={`text-xs ${commandStatus.has('screenshot') ? 'text-blue-500 opacity-80' : 'text-muted-foreground opacity-40'}`}>
                        {commandStatus.has('screenshot') ? getCommandStatusInfo('screenshot', commandStatus).label : "Capture screen"}
                      </span>
                    </div>
                  </button>
                </div>

                {/* Regular Commands */}
                {commands
                  .filter(cmd => cmd !== 'screenshot') // Filter out screenshot if present in device commands
                  .map((cmd, index) => {
                  const { icon, color, label } = getCommandStatusInfo(cmd, commandStatus);
                  const isDisabled = isCommandInProgress(cmd, commandStatus);
                  const isLastItem = index === commands.filter(c => c !== 'screenshot').length - 1;
                  
                  return (
                    <div 
                      key={cmd} 
                      className={`flex-shrink-0 ${index !== 0 ? 'border-l' : ''} ${isLastItem ? 'border-r' : ''}`}
                    >
                      <button
                        onClick={() => executeCommand(cmd)}
                        disabled={isDisabled}
                        className={`px-6 py-4 flex items-start gap-2 hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors ${
                          isDisabled ? 'opacity-50' : ''
                        }`}
                      >
                        <div className={`${color} mt-1`}>
                          {icon}
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{cmd}</span>
                          <span className={`text-xs ${color} ${commandStatus.has(cmd) ? 'opacity-80' : 'opacity-40'}`}>
                            {commandStatus.has(cmd) ? label : "..."}
                          </span>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Content frame - fixed aspect ratio container */}
            <div className="flex-1 w-full min-h-0 overflow-hidden">
              {showScreenshot && imageData ? (
                <ContentFrame imageData={imageData} />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-black border-r border-b overflow-hidden">
                  <div className="relative w-[70%] h-[70%] mx-auto bg-background border shadow-md overflow-hidden">
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <Camera className="h-12 w-12 text-muted-foreground opacity-30 mb-4" />
                      <p className="text-muted-foreground mb-2">Ready to see your device screen?</p>
                      <p className="text-xs text-muted-foreground mb-6">Click the button below to take a screenshot</p>
                      <Button 
                        onClick={handleScreenshotRequest}
                        variant="outline"
                        className="bg-transparent"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Capture Screen
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 