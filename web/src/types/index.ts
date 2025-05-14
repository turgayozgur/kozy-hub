// Device types
export interface DeviceSession {
  key: string;
  name: string;
  isConnected: boolean;
}

// Command types
export type CommandStatus = 'idle' | 'sending' | 'accepted' | 'running' | 'completed' | 'failed' | 'timeout' | 'no-response';

export interface DeviceCommand {
  name: string;
  status: CommandStatus;
  timestamp: number;
}

// Device management types
export interface Device {
  key: string;
  label: string;
  displayName?: string;
  isConnected?: boolean;
}

// Image handling types
export interface ImageSize {
  width: number;
  height: number;
}

// Status display helpers
export interface CommandStatusInfo {
  icon: React.ReactNode;
  color: string;
  label: string;
} 