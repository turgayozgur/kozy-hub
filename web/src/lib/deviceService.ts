import { HubConnection, HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';

export interface DeviceConnectionOptions {
  hubUrl: string;
  deviceKey: string;
  deviceName: string;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  onReceiveFromUser?: (key: string, name: string, payload: any, connectionId: string) => void;
}

export class DeviceService {
  private connection: HubConnection | null = null;
  private options: DeviceConnectionOptions | null = null;
  private connectionPromise: Promise<void> | null = null;
  private isInitialized = false;
  private reconnectTimeout: number | null = null;
  private reconnectIntervals = [0, 2000, 5000, 10000];

  constructor() {}

  public async connect(options: DeviceConnectionOptions): Promise<void> {
    if (this.connection && this.connection.state === HubConnectionState.Connected) {
      console.log('Device already connected');
      return;
    }

    this.options = options;

    try {
      // Build the connection
      const builder = new HubConnectionBuilder()
        .withUrl(options.hubUrl)
        .withAutomaticReconnect(this.reconnectIntervals)
        .configureLogging(LogLevel.Information);

      this.connection = builder.build();
      this.registerHandlers();

      // Start the connection
      await this.startConnection();

      // Initialize the device session
      await this.initializeDeviceSession();
      
      console.log(`Device ${options.deviceKey} connected and initialized`);
      
      if (options.onConnected) {
        options.onConnected();
      }
    } catch (error) {
      console.error('Failed to connect device:', error);
      if (options.onError && error instanceof Error) {
        options.onError(error);
      }
      throw error;
    }
  }

  private async startConnection(): Promise<void> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    try {
      this.connectionPromise = this.connection.start();
      await this.connectionPromise;
      console.log('Device connection established');
    } catch (error) {
      console.error('Error starting device connection:', error);
      this.connectionPromise = null;
      throw error;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async initializeDeviceSession(): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected || !this.options) {
      throw new Error('Cannot initialize device session: not connected');
    }

    if (this.isInitialized) {
      return;
    }

    try {
      // The payload can be any additional information about the device
      const payload = {
        deviceType: 'web-test-device',
        version: '1.0.0',
        capabilities: ['messaging'],
        commands: [
          'Party kabul et',
          '10 item trade et',
          'VIP\'den silah al',
          'Town at'
        ]
      };

      // Call the InitializeDeviceSession method on the hub
      await this.connection.invoke(
        'InitializeDeviceSession', 
        this.options.deviceKey, 
        this.options.deviceName, 
        payload
      );

      this.isInitialized = true;
      console.log(`Device session initialized for ${this.options.deviceKey}`);
    } catch (error) {
      console.error('Failed to initialize device session:', error);
      throw error;
    }
  }

  private registerHandlers(): void {
    if (!this.connection || !this.options) return;

    // Handle device session initialization result
    this.connection.on('DeviceSessionInitResult', (key: string, name: string, success: boolean) => {
      console.log(`Device session init result for ${key}: ${success ? 'Success' : 'Failed'}`);
      // Can trigger a callback here if needed
    });

    // Handle receiving messages from users
    this.connection.on('ReceiveFromUser', (key: string, name: string, payload: any, connectionId: string) => {
      console.log(`Device received message from user ${connectionId}:`, { key, name, payload });
      if (this.options && this.options.onReceiveFromUser) {
        this.options.onReceiveFromUser(key, name, payload, connectionId);
      }
    });

    // Handle reconnection events
    this.connection.onreconnecting(() => {
      console.log('Device connection lost, reconnecting...');
    });

    this.connection.onreconnected(() => {
      console.log('Device reconnected, reinitializing session...');
      this.initializeDeviceSession().catch(err => {
        console.error('Failed to reinitialize device session after reconnect:', err);
      });
    });

    this.connection.onclose((error) => {
      console.log('Device connection closed', error);
      this.isInitialized = false;
      if (this.options && this.options.onDisconnected) {
        this.options.onDisconnected();
      }
    });
  }

  public async sendToUsers(name: string, payload: any): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      throw new Error('Cannot send to users: device not connected');
    }

    if (!this.isInitialized) {
      throw new Error('Cannot send to users: device session not initialized');
    }

    try {
      await this.connection.invoke('SendToUsers', name, payload);
      console.log(`Device sent message to users:`, { name, payload });
    } catch (error) {
      console.error('Error sending message to users:', error);
      throw error;
    }
  }

  public async sendResponseToUser(initiatorWebConnectionId: string, originalName: string, payload: any): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      throw new Error('Cannot send response: device not connected');
    }

    if (!this.isInitialized) {
      throw new Error('Cannot send response: device session not initialized');
    }

    try {
      // Kullanıcıya yanıt gönderirken SendToUsers kullan
      // Yanıt payload'ına özel bilgiler ekle
      const responsePayload = {
        ...payload,
        _responseType: 'deviceResponse',
        _originalRequest: originalName,
        _targetConnectionId: initiatorWebConnectionId // Hangi kullanıcıya yanıt olduğunu belirtmek için
      };
      
      // Hub metodu olarak SendToUsers kullan
      await this.connection.invoke(
        'SendToUsers', 
        originalName, // Mesaj tipi (command için "command")
        responsePayload // Genişletilmiş payload
      );
      
      console.log(`Device sent response to user ${initiatorWebConnectionId}:`, { originalName, payload });
    } catch (error) {
      console.error('Error sending response to user:', error);
      throw error;
    }
  }

  public isConnected(): boolean {
    return !!this.connection && this.connection.state === HubConnectionState.Connected && this.isInitialized;
  }

  public async disconnect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.connection) {
      try {
        await this.connection.stop();
        console.log('Device connection stopped');
      } catch (error) {
        console.error('Error stopping device connection:', error);
      } finally {
        this.connection = null;
        this.isInitialized = false;
        if (this.options?.onDisconnected) {
          this.options.onDisconnected();
        }
      }
    }
  }

  public dispose(): void {
    this.disconnect().catch(err => {
      console.error('Error during device service disposal:', err);
    });
  }
}

// Create a singleton instance
export const deviceService = new DeviceService(); 