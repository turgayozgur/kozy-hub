import { HubConnection, HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';

export interface DeviceSession {
  key: string;
  name: string;
  isConnected: boolean;
}

export type ConnectionState = 'connected' | 'disconnected' | 'connecting' | 'reconnecting';

class SignalRService {
  private connection: HubConnection | null = null;
  private deviceSessions: Map<string, DeviceSession> = new Map();
  private onDeviceConnectedCallbacks: ((device: DeviceSession) => void)[] = [];
  private onDeviceDisconnectedCallbacks: ((device: DeviceSession) => void)[] = [];
  private onReceiveFromDeviceCallbacks: ((key: string, name: string, payload: any) => void)[] = [];
  private onReceiveResponseFromDeviceCallbacks: ((key: string, name: string, payload: any) => void)[] = [];
  private onConnectionStateChangedCallbacks: ((state: ConnectionState) => void)[] = [];
  private currentState: ConnectionState = 'connecting';
  private reconnectTimeout: number | null = null;
  private lastHubUrl: string | null = null;
  private lastToken: string | null = null;
  private visibilityHandler: ((event: Event) => void) | null = null;
  private reconnectIntervals = [0, 2000, 5000, 10000]; // Simplified retry policy

  constructor() {
    // Register document visibility change handler
    this.setupVisibilityChangeHandler();
  }

  private setupVisibilityChangeHandler() {
    this.visibilityHandler = () => {
      // When page becomes visible again and we're disconnected, try to reconnect
      if (document.visibilityState === 'visible' && 
         (this.currentState === 'disconnected' || this.currentState === 'reconnecting') && 
          this.lastHubUrl) {
        console.log('Page became visible again, attempting to reconnect...');
        this.start(this.lastHubUrl, this.lastToken || undefined).catch(err => {
          console.error('Failed to reconnect on visibility change:', err);
        });
      }
    };

    // Listen for visibility changes
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  public async start(hubUrl: string, token?: string): Promise<void> {
    // Store connection details for potential reconnection
    this.lastHubUrl = hubUrl;
    this.lastToken = token || null;

    // Clear existing connection first if there is one
    if (this.connection) {
      await this.stop();
    }

    // Clear any existing reconnect timeouts
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Update state to connecting
    this.updateConnectionState('connecting');

    // Build the connection with standard automatic reconnect
    let builder = new HubConnectionBuilder()
      .withUrl(hubUrl, token ? { accessTokenFactory: () => token } : {})
      .withAutomaticReconnect(this.reconnectIntervals)
      .configureLogging(LogLevel.Information);

    this.connection = builder.build();
    this.registerHandlers();
    this.registerConnectionEvents();

    try {
      await this.connection.start();
      this.updateConnectionState('connected');
      console.log('SignalR connection established');
      return Promise.resolve();
    } catch (error) {
      console.error('Failed to start SignalR connection:', error);
      this.updateConnectionState('disconnected');
      throw error;
    }
  }

  public async stop(): Promise<void> {
    // Clear any reconnect timeouts
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.connection) {
      try {
        await this.connection.stop();
        console.log('SignalR connection stopped');
      } catch (error) {
        console.error('Error stopping SignalR connection:', error);
      } finally {
        this.connection = null;
        this.updateConnectionState('disconnected');
      }
    }
  }

  private registerConnectionEvents(): void {
    if (!this.connection) return;

    this.connection.onreconnecting((error) => {
      console.log('SignalR connection lost, reconnecting...', error);
      this.updateConnectionState('connecting'); // Use 'connecting' instead of 'reconnecting'
      
      // Set a failsafe timeout to ensure we don't get stuck in 'connecting' state
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }
      
      // If reconnection doesn't complete within 30 seconds, force to disconnected state
      this.reconnectTimeout = window.setTimeout(() => {
        // Only update if we're still in the connecting state after 30 seconds
        if (this.currentState === 'connecting' || this.currentState === 'reconnecting') {
          console.log('Reconnection taking too long, setting state to disconnected');
          this.updateConnectionState('disconnected');
          this.reconnectTimeout = null;
          
          // Try to reconnect once more after a brief pause if page is visible
          if (document.visibilityState === 'visible' && this.lastHubUrl) {
            setTimeout(() => {
              if (this.currentState === 'disconnected' && this.lastHubUrl) {
                console.log('Attempting additional reconnection after timeout...');
                this.start(this.lastHubUrl, this.lastToken || undefined).catch(err => {
                  console.error('Failed to reconnect after timeout:', err);
                });
              }
            }, 5000);
          }
        }
      }, 30000); // 30 seconds timeout
    });

    this.connection.onreconnected((connectionId) => {
      console.log('SignalR reconnected with connection ID:', connectionId);
      
      // Clear reconnect timeout
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      
      this.updateConnectionState('connected');
    });

    this.connection.onclose((error) => {
      console.log('SignalR connection closed permanently', error);
      
      // Clear reconnect timeout
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      
      this.updateConnectionState('disconnected');
      
      // Attempt to reconnect one more time after a delay if page is visible
      if (document.visibilityState === 'visible' && this.lastHubUrl) {
        setTimeout(() => {
          if (this.currentState === 'disconnected' && this.lastHubUrl) {
            console.log('Attempting to reconnect after connection closed...');
            this.start(this.lastHubUrl, this.lastToken || undefined).catch(err => {
              console.error('Failed to reconnect after connection close:', err);
            });
          }
        }, 5000);
      }
    });
  }

  private updateConnectionState(state: ConnectionState): void {
    console.log(`SignalR connection state changing: ${this.currentState} -> ${state}`);
    this.currentState = state;
    this.notifyConnectionStateChanged(state);
  }

  private notifyConnectionStateChanged(state: ConnectionState): void {
    this.onConnectionStateChangedCallbacks.forEach(callback => callback(state));
  }

  private registerHandlers(): void {
    if (!this.connection) return;

    this.connection.on('DeviceConnected', (key: string, name: string, payload: any) => {
      // Device session kaydı
      const device = { key, name, isConnected: true };
      this.deviceSessions.set(key, device);
      this.onDeviceConnectedCallbacks.forEach(callback => callback(device));
      
      // Global olay olarak da yayınla (payload ile birlikte)
      if (typeof window !== 'undefined' && document) {
        // device-connected olayı tüm potansiyel dinleyiciler için
        const deviceEvent = new CustomEvent('signalr-device-connected', {
          detail: { key, name, isConnected: true, payload }
        });
        document.dispatchEvent(deviceEvent);
        
        // Özel olarak tanımladığımız device-connected olayı (DeviceList.tsx için)
        const customEvent = new CustomEvent('device-connected', {
          detail: { 
            key, 
            name, 
            isConnected: true,
            payload: payload // Use the original payload from the device
          }
        });
        document.dispatchEvent(customEvent);
      }
    });

    this.connection.on('DeviceDisconnected', (key: string, name: string, status: boolean) => {
      const device = this.deviceSessions.get(key);
      if (device) {
        device.isConnected = false;
        this.onDeviceDisconnectedCallbacks.forEach(callback => callback(device));
      }
    });

    this.connection.on('ReceiveFromDevice', (key: string, name: string, payload: any) => {
      this.onReceiveFromDeviceCallbacks.forEach(callback => callback(key, name, payload));
      
      // Global olay olarak da yayınla
      if (typeof window !== 'undefined' && document) {
        const event = new CustomEvent('signalr-message', {
          detail: { key, name, payload }
        });
        document.dispatchEvent(event);
        
        // Command mesaj tipini kontrol et, command bilgisi artık payload içinde
        if (name === 'command' && payload) {
          console.log(`Processing command status update for device ${key}:`, payload);
          
          // Command adını ve status bilgisini payload'dan al
          const commandName = payload.command || payload.name || 'unknown';
          const status = payload.status || 'idle';
          
          // Create a device-response event for the UI components
          const responseEvent = new CustomEvent('device-response', {
            detail: { 
              key, 
              originalName: commandName, // Komut adı artık payload içinden geliyor
              payload // Komutla ilgili tüm bilgiler payload içinde
            }
          });
          
          // Dispatch the response event for command components to listen for
          document.dispatchEvent(responseEvent);
          
          // Also dispatch a general response event
          const generalEvent = new CustomEvent('signalr-response', {
            detail: { 
              key, 
              name: commandName, 
              payload 
            }
          });
          document.dispatchEvent(generalEvent);
        }
      }
    });

    this.connection.on('ReceiveResponseFromDevice', (key: string, name: string, payload: any) => {
      this.onReceiveResponseFromDeviceCallbacks.forEach(callback => callback(key, name, payload));
      
      // Global olay olarak da yayınla
      if (typeof window !== 'undefined' && document) {
        const event = new CustomEvent('signalr-response', {
          detail: { key, name, payload }
        });
        document.dispatchEvent(event);
      }
    });
  }

  public getConnectionState(): ConnectionState {
    if (!this.connection) return 'disconnected';
    
    // Return the tracked state rather than translating from connection.state
    return this.currentState;
  }
  
  public isConnected(): boolean {
    return this.connection?.state === HubConnectionState.Connected;
  }

  public async subscribeToDevices(keys: string[]): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      throw new Error('Connection not established or not in Connected state');
    }

    try {
      await this.connection.invoke('SubscribeToDevices', keys.join(','));
    } catch (error) {
      console.error('Error subscribing to devices:', error);
      throw error;
    }
  }

  public async sendToDevice(key: string, name: string, payload: any): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      throw new Error('Connection not established or not in Connected state');
    }

    try {
      // Eğer bu bir komut ise, name ve payload yapısını yeni formata dönüştür
      if (name && !payload && typeof name === 'string') {
        // Bu durumda name parametresi gerçekte komut adı, payload null
        // Yeni yapıya dönüştür: name="command", payload={command: eskiName}
        console.log(`Sending command to device ${key}: ${name}`);
        await this.connection.invoke('SendToDevice', key, 'command', { command: name });
      } else {
        // Standard message sending
        await this.connection.invoke('SendToDevice', key, name, payload);
      }
    } catch (error) {
      console.error('Error sending message to device:', error);
      throw error;
    }
  }

  public onDeviceConnected(callback: (device: DeviceSession) => void): void {
    this.onDeviceConnectedCallbacks.push(callback);
  }

  public onDeviceDisconnected(callback: (device: DeviceSession) => void): void {
    this.onDeviceDisconnectedCallbacks.push(callback);
  }

  public onReceiveFromDevice(callback: (key: string, name: string, payload: any) => void): void {
    this.onReceiveFromDeviceCallbacks.push(callback);
  }

  public onReceiveResponseFromDevice(callback: (key: string, name: string, payload: any) => void): void {
    this.onReceiveResponseFromDeviceCallbacks.push(callback);
  }

  public onConnectionStateChanged(callback: (state: ConnectionState) => void): void {
    this.onConnectionStateChangedCallbacks.push(callback);
    
    // Immediately notify of current state
    callback(this.currentState);
  }

  public getConnectedDevices(): DeviceSession[] {
    return Array.from(this.deviceSessions.values()).filter(device => device.isConnected);
  }

  public getAllDevices(): DeviceSession[] {
    return Array.from(this.deviceSessions.values());
  }
  
  // Clean up when service is destroyed
  public dispose(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.stop().catch(console.error);
  }
}

export const signalRService = new SignalRService(); 