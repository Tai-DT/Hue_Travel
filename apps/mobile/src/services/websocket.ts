import * as SecureStore from 'expo-secure-store';
import { getWSBase } from './api';

export type WSMessagePayload = {
  type: string;
  room_id: string;
  sender_id: string;
  content: string;
  data?: any; // The full message object serialized
};

type WSListener = (payload: WSMessagePayload) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private listeners: WSListener[] = [];
  private isConnecting: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private token: string | null = null;
  private shouldReconnect: boolean = true;

  public async connect() {
    if (this.ws || this.isConnecting) return;

    this.isConnecting = true;
    this.shouldReconnect = true;

    try {
      this.token = await SecureStore.getItemAsync('user_token');
      if (!this.token) {
        console.warn('No token found, skipping WS connect');
        this.isConnecting = false;
        return;
      }

      const wsUrl = `${getWSBase()}?token=${this.token}`;
      if (__DEV__) {
        console.log('[WS] Connecting to:', wsUrl);
      }

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (__DEV__) {
          console.log('[WS] Connected');
        }
        this.isConnecting = false;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const payload: WSMessagePayload = JSON.parse(event.data);
          if (__DEV__) {
            console.log('[WS] Received:', payload.type, 'for room:', payload.room_id);
          }
          this.notifyListeners(payload);
        } catch (error) {
          console.warn('[WS] Error parsing message:', error);
        }
      };

      this.ws.onerror = (error) => {
        if (__DEV__) {
          console.log('[WS] Error:', error);
        }
        // Connection error handled by onclose
      };

      this.ws.onclose = (event) => {
        if (__DEV__) {
          console.log('[WS] Closed:', event.code, event.reason);
        }
        // Only nullify and try to reconnect if this event corresponds to our current active WebSocket instance
        if (this.ws === event.target) {
          this.ws = null;
          this.isConnecting = false;

          if (this.shouldReconnect) {
            this.scheduleReconnect();
          }
        }
      };
    } catch (error) {
      if (__DEV__) {
        console.error('[WS] Connect error:', error);
      }
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    // Attempt reconnect after 3 seconds
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  public disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public addListener(listener: WSListener) {
    this.listeners.push(listener);
  }

  public removeListener(listener: WSListener) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  private notifyListeners(payload: WSMessagePayload) {
    this.listeners.forEach((listener) => listener(payload));
  }
}

// Export singleton instance
export const wsService = new WebSocketService();
