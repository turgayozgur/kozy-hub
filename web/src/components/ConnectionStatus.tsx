import { useSignalR } from '../lib/SignalRContext';
import { useEffect, useState, useRef, useCallback } from 'react';
import { signalRService } from '../lib/signalrService';
import type { ConnectionState } from '../lib/signalrService';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Button } from './ui/button';
import { Circle, CircleDot, CircleDashed } from 'lucide-react';

// Choose your preferred icons from Lucide
const iconSet = {
  connected: CircleDot,
  connecting: CircleDashed,
  disconnected: Circle
};

export function ConnectionStatus() {
  const { connectionState, connectSignalR } = useSignalR();
  const [displayState, setDisplayState] = useState<ConnectionState>('connecting');
  const hasRegisteredHandler = useRef(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const shouldReconnectRef = useRef(false);
  
  // Update display state based on connection state changes
  useEffect(() => {
    // Update the display state based on the connection state
    setDisplayState(connectionState);
    
    // Reset reconnecting state when connection state changes
    if (connectionState !== 'connecting') {
      setIsReconnecting(false);
    }
    
    // Only register handler once
    if (!hasRegisteredHandler.current) {
      hasRegisteredHandler.current = true;
      
      signalRService.onConnectionStateChanged((state) => {
        setDisplayState(state);
        if (state !== 'connecting') {
          setIsReconnecting(false);
        }
      });
    }
    
    return () => {};
  }, [connectionState]);

  // Handle manual reconnection
  const handleManualReconnect = useCallback(async () => {
    if (isReconnecting) return; // Prevent multiple reconnection attempts
    
    setIsReconnecting(true);
    
    // Get the stored hub URL from localStorage
    const hubUrl = localStorage.getItem('hubUrl');
    if (hubUrl) {
      try {
        await connectSignalR(hubUrl);
      } catch (error) {
        console.error('Manual reconnection failed:', error);
        setIsReconnecting(false);
      }
    } else {
      console.error('No hub URL found in localStorage');
      setIsReconnecting(false);
    }
  }, [connectSignalR, isReconnecting]);

  // Add page visibility change handler to reconnect when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Only attempt reconnect if currently disconnected
        if (displayState === 'disconnected' && !isReconnecting) {
          shouldReconnectRef.current = true;
          // We use a setTimeout to break the potential render cycle
          setTimeout(() => {
            if (shouldReconnectRef.current) {
              handleManualReconnect();
              shouldReconnectRef.current = false;
            }
          }, 0);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      shouldReconnectRef.current = false;
    };
  }, [displayState, isReconnecting, handleManualReconnect]);

  // Get icon size and style
  const getIconStyles = () => {
    return 'h-3 w-3'; // Small dots for circle icons
  };

  // Get icon color based on connection state
  const getIconColor = () => {
    switch (displayState) {
      case 'connected': return 'text-green-500';
      case 'connecting': 
      case 'reconnecting': return 'text-yellow-500';
      case 'disconnected': return 'text-red-500';
      default: return 'text-zinc-400';
    }
  };

  // Get animation class if needed
  const getAnimationClass = () => {
    if (displayState === 'connecting' || displayState === 'reconnecting') {
      return 'animate-pulse';
    }
    return '';
  };

  // Get the appropriate icon and tooltip based on connection state
  const getConnectionDisplay = () => {
    const colorClass = getIconColor();
    const sizeClass = getIconStyles();
    const animationClass = getAnimationClass();
    const className = `${sizeClass} ${colorClass} ${animationClass}`;
    
    const Icon = (() => {
      switch (displayState) {
        case 'connected': return iconSet.connected;
        case 'connecting':
        case 'reconnecting': return iconSet.connecting;
        case 'disconnected': return iconSet.disconnected;
        default: return iconSet.disconnected;
      }
    })();
    
    return {
      icon: <Icon className={className} />,
      tooltip: displayState === 'connected' ? 'Connected' :
              displayState === 'disconnected' ? 'Click to reconnect' : 'Connecting...',
      clickable: displayState === 'disconnected'
    };
  };

  const { icon, tooltip, clickable } = getConnectionDisplay();
  
  // Button class for the circle icon style
  const buttonClass = "h-8 w-8 rounded-full flex items-center justify-center";
  
  // Render the icon with tooltip
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {clickable && displayState === 'disconnected' ? (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleManualReconnect}
              disabled={isReconnecting}
              className={buttonClass}
            >
              {isReconnecting ? (
                <CircleDashed 
                  className={`${getIconStyles()} text-yellow-500 animate-pulse`} 
                />
              ) : icon}
            </Button>
          ) : (
            <div className="h-8 w-8 flex items-center justify-center">
              {icon}
            </div>
          )}
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
} 