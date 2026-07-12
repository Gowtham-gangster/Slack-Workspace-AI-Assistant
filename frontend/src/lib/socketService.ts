import { io, Socket } from 'socket.io-client';
import { attemptTokenRefresh, getAuthToken } from './api';

class SocketService {
  private static instance: SocketService | null = null;
  private socket: Socket | null = null;
  private token: string | null = null;
  private onConnectCallback: (() => void) | null = null;
  private onDisconnectCallback: (() => void) | null = null;
  private onReconnectingCallback: ((attempt: number) => void) | null = null;
  private isRefreshingToken = false;

  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  public initialize(token: string, callbacks?: {
    onConnect?: () => void;
    onDisconnect?: () => void;
    onReconnecting?: (attempt: number) => void;
  }) {
    if (this.socket) {
      // If token changed, update auth and reconnect
      if (this.token !== token) {
        console.log('[WebSocket] Token updated. Re-authenticating...');
        this.token = token;
        this.socket.auth = { token };
        this.socket.disconnect().connect();
      }
      return;
    }

    this.token = token;
    if (callbacks) {
      this.onConnectCallback = callbacks.onConnect || null;
      this.onDisconnectCallback = callbacks.onDisconnect || null;
      this.onReconnectingCallback = callbacks.onReconnecting || null;
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    console.log('[WebSocket] Socket Connecting to:', backendUrl);

    this.socket = io(backendUrl, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 20000,
      transports: ['websocket', 'polling'],
      autoConnect: true
    });

    this.socket.on('connect', () => {
      console.log('[WebSocket] Socket Connected');
      if (this.onConnectCallback) this.onConnectCallback();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      if (this.onDisconnectCallback) this.onDisconnectCallback();
    });

    this.socket.on('connect_error', async (err: any) => {
      // In development, minimize console spam for network errors, but capture details
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[WebSocket] Connection failed. Retrying...');
      }

      // Handle expired/invalid JWT token
      if (err.message && err.message.includes('Unauthorized') && !this.isRefreshingToken) {
        this.isRefreshingToken = true;
        console.log('[WebSocket] JWT expired or invalid. Attempting silent token refresh...');
        try {
          const newToken = await attemptTokenRefresh();
          if (newToken && this.socket) {
            console.log('[WebSocket] Token refreshed successfully. Reconnecting...');
            this.token = newToken;
            this.socket.auth = { token: newToken };
            this.socket.connect();
          } else {
            console.error('[WebSocket] Token refresh failed. User must log in again.');
            this.disconnect();
          }
        } catch (refreshErr) {
          console.error('[WebSocket] Silent token refresh failed:', refreshErr);
        } finally {
          this.isRefreshingToken = false;
        }
      }
    });

    this.socket.io.on('reconnect_attempt', (attempt) => {
      console.log(`[WebSocket] Reconnecting (attempt ${attempt})`);
      if (this.onReconnectingCallback) this.onReconnectingCallback(attempt);
    });

    this.socket.io.on('reconnect', () => {
      console.log('[WebSocket] Reconnected');
      if (this.onConnectCallback) this.onConnectCallback();
    });

    this.socket.io.on('reconnect_failed', () => {
      console.error('[WebSocket] Connection Failed');
    });
  }

  public joinChannel(channelId: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('join_channel', channelId);
      console.log(`[WebSocket] Joined Room: ${channelId}`);
    }
  }

  public onReactionUpdate(callback: (payload: any) => void) {
    if (this.socket) {
      this.socket.off('reaction_update');
      this.socket.on('reaction_update', callback);
    }
  }

  public offReactionUpdate() {
    if (this.socket) {
      this.socket.off('reaction_update');
    }
  }

  public disconnect() {
    if (this.socket) {
      console.log('[WebSocket] Disconnecting socket singleton and clearing listeners.');
      this.socket.disconnect();
      this.socket = null;
      this.token = null;
      this.onConnectCallback = null;
      this.onDisconnectCallback = null;
      this.onReconnectingCallback = null;
    }
  }
}

export const socketService = SocketService.getInstance();
