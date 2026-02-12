import { Socket, io } from 'socket.io-client';
import type {
  ClientToServerEvents,
  CourtroomSocketOptions,
  ServerToClientEvents,
} from './courtroom-websocket-types';

export type CourtroomSocket = Socket<
  ServerToClientEvents,
  ClientToServerEvents
>;

export interface ConnectionState {
  connected: boolean;
  recovered: boolean;
  hasConnectedBefore: boolean;
  lastError?: string;
  disconnected?: boolean;
}

export default class CourtroomWebSocketClient {
  private socket: CourtroomSocket | null = null;
  private basePath: string;
  private connectionState: ConnectionState = {
    connected: false,
    recovered: false,
    hasConnectedBefore: false,
    disconnected: false,
  };
  private lastConnectionOptions?: CourtroomSocketOptions;

  // Pending callbacks for connect and connect_error
  private pendingConnectCallback?: () => void;
  private pendingConnectErrorCallback?: (error: Error) => void;

  private connectionStateChangeCallback?: (state: ConnectionState) => void;

  constructor() {
    this.basePath = "https://objection.lol";
  }

  private updateConnectionState(partialState: Partial<ConnectionState>): void {
    this.connectionState = { ...this.connectionState, ...partialState };
    this.connectionStateChangeCallback?.(this.connectionState);
  }

  connect(options: CourtroomSocketOptions): CourtroomSocket {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    // Clean up existing socket if it exists but is not connected
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    this.lastConnectionOptions = options;
    this.updateConnectionState({ connected: false, recovered: false });

    const socketOptions = {
      ...options,
      auth: options.auth,
      autoConnect: options.autoConnect ?? true,
      transports: options.transports ?? ['websocket', 'polling'],
      timeout: options.timeout ?? 5000,
      forceNew: options.forceNew ?? false,
      // Enable Socket.IO's built-in reconnection
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      // TODO: consolidate local/production?
      // The issue is `/` resolves to frontend url
      // nginx routes objection.lol/courtroom-api/ to backend:9005 so it works fine

      path: '/courtroom-api/socket.io',
    };

    console.log('Connecting to courtroom WebSocket with options:', socketOptions);

    this.socket = io(
      this.basePath.startsWith('http') ? this.basePath : '/',
      socketOptions
    );

    // Apply pending callbacks
    if (this.pendingConnectCallback) {
      this.socket.on('connect', this.pendingConnectCallback);
    }

    if (this.pendingConnectErrorCallback) {
      this.socket.on('connect_error', this.pendingConnectErrorCallback);
    }

    // Set up connection event handlers
    this.socket.on('connect', () => {
      const recovered = this.socket?.recovered ?? false;

      this.updateConnectionState({
        connected: true,
        recovered,
        hasConnectedBefore: true,
        lastError: undefined,
        disconnected: false,
      });

      if (recovered) {
        console.log(
          'Socket.IO connection recovered - any missed events will be received',
        );
      } else {
        console.log('Socket.IO connected with new session');
      }
    });

    this.socket.on('connect_error', (error) => {
      const errorDetails = [
        error.message,
        (error as Error & { description?: string }).description,
        (error as Error & { context?: unknown }).context
          ? JSON.stringify((error as Error & { context?: unknown }).context)
          : undefined,
      ]
        .filter(Boolean)
        .join(' | ');

      const detailedMessage = errorDetails || 'Unknown connection error';

      console.error('WebSocket connection error:', detailedMessage, error);

      if (error.message !== 'websocket error') {
        this.updateConnectionState({
          connected: false,
          lastError: detailedMessage,
          disconnected: true,
        });
      } else {
        this.updateConnectionState({
          connected: false,
          lastError: detailedMessage,
        });
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected:', reason);

      this.updateConnectionState({
        connected: false,
        recovered: false,
        disconnected:
          reason === 'io server disconnect' ||
          reason === 'io client disconnect',
      });
    });

    return this.socket;
  }

  /**
   * Join a room as a user
   */
  joinRoom(
    roomId: string,
    username: string,
    password?: string,
  ): CourtroomSocket {
    return this.connect({
      query: {
        roomId,
        username,
        password,
      },
    });
  }

  /**
   * Join a room as a spectator
   */
  spectateRoom(roomId: string): CourtroomSocket {
    return this.connect({
      query: {
        roomId,
      },
    });
  }

  /**
   * Disconnect from the WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      console.log('Disconnecting WebSocket...');
      // Disable reconnection before disconnecting to prevent auto-reconnect
      this.socket.io.opts.reconnection = false;
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.clearConnectionCallbacks();
      this.updateConnectionState({
        connected: false,
        disconnected: true,
      });
    }
  }

  /**
   * Get the current socket instance
   */
  getSocket(): CourtroomSocket | null {
    return this.socket;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // Message methods
  sendMessage(data: Parameters<ClientToServerEvents['message']>[0]): void {
    this.socket?.emit('message', data);
  }

  sendPlainMessage(
    data: Parameters<ClientToServerEvents['plain_message']>[0],
  ): void {
    this.socket?.emit('plain_message', data);
  }

  sendSpectatorMessage(
    data: Parameters<ClientToServerEvents['spectator_message']>[0],
  ): void {
    this.socket?.emit('spectator_message', data);
  }

  typing(): void {
    this.socket?.emit('typing');
  }

  // User methods
  me(): void {
    this.socket?.emit('me');
  }

  changeUsername(
    data: Parameters<ClientToServerEvents['change_username']>[0],
  ): void {
    this.socket?.emit('change_username', data);
  }

  // Room methods
  getRoom(): void {
    this.socket?.emit('get_room');
  }

  updateRoom(data: Parameters<ClientToServerEvents['update_room']>[0]): void {
    this.socket?.emit('update_room', data);
  }

  updateRoomAdmin(
    data: Parameters<ClientToServerEvents['update_room_admin']>[0],
  ): void {
    this.socket?.emit('update_room_admin', data);
  }

  // Pair methods
  createPair(data: Parameters<ClientToServerEvents['create_pair']>[0]): void {
    this.socket?.emit('create_pair', data);
  }

  updatePair(data: Parameters<ClientToServerEvents['update_pair']>[0]): void {
    this.socket?.emit('update_pair', data);
  }

  updatePairedUser(
    data: Parameters<ClientToServerEvents['update_paired_user']>[0],
  ): void {
    this.socket?.emit('update_paired_user', data);
  }

  respondToPair(
    data: Parameters<ClientToServerEvents['respond_to_pair']>[0],
  ): void {
    this.socket?.emit('respond_to_pair', data);
  }

  leavePair(): void {
    this.socket?.emit('leave_pair');
  }

  // Admin methods
  updateMods(data: Parameters<ClientToServerEvents['update_mods']>[0]): void {
    this.socket?.emit('update_mods', data);
  }

  kick(data: Parameters<ClientToServerEvents['kick']>[0]): void {
    this.socket?.emit('kick', data);
  }

  createBan(data: Parameters<ClientToServerEvents['create_ban']>[0]): void {
    this.socket?.emit('create_ban', data);
  }

  removeBan(banId: string): void {
    this.socket?.emit('remove_ban', banId);
  }

  ownerTransfer(userId: string): void {
    this.socket?.emit('owner_transfer', userId);
  }

  // Evidence methods
  addEvidence(data: Parameters<ClientToServerEvents['add_evidence']>[0]): void {
    this.socket?.emit('add_evidence', data);
  }

  addProfile(data: Parameters<ClientToServerEvents['add_profile']>[0]): void {
    this.socket?.emit('add_profile', data);
  }

  deleteEvidence(id: string): void {
    this.socket?.emit('delete_evidence', id);
  }

  deleteProfile(id: string): void {
    this.socket?.emit('delete_profile', id);
  }

  // Background methods
  addBackground(
    data: Parameters<ClientToServerEvents['add_background']>[0],
  ): void {
    this.socket?.emit('add_background', data);
  }

  deleteBackground(id: string): void {
    this.socket?.emit('delete_background', id);
  }

  // Event listener helpers with proper typing
  onRoomUpdate(
    callback: (
      data: Parameters<ServerToClientEvents['update_room']>[0],
    ) => void,
  ): void {
    this.socket?.on('update_room', callback);
  }

  onRoomAdminUpdate(
    callback: (
      data: Parameters<ServerToClientEvents['update_room_admin']>[0],
    ) => void,
  ): void {
    this.socket?.on('update_room_admin', callback);
  }

  onRoomModUpdate(
    callback: (
      data: Parameters<ServerToClientEvents['update_room_mod']>[0],
    ) => void,
  ): void {
    this.socket?.on('update_room_mod', callback);
  }

  onMessage(
    callback: (data: Parameters<ServerToClientEvents['message']>[0]) => void,
  ): void {
    this.socket?.on('message', callback);
  }

  onPlainMessage(
    callback: (
      data: Parameters<ServerToClientEvents['plain_message']>[0],
    ) => void,
  ): void {
    this.socket?.on('plain_message', callback);
  }

  onSpectatorMessage(
    callback: (
      data: Parameters<ServerToClientEvents['spectator_message']>[0],
    ) => void,
  ): void {
    this.socket?.on('spectator_message', callback);
  }

  onTyping(
    callback: (data: Parameters<ServerToClientEvents['typing']>[0]) => void,
  ): void {
    this.socket?.on('typing', callback);
  }

  onMe(
    callback: (data: Parameters<ServerToClientEvents['me']>[0]) => void,
  ): void {
    this.socket?.on('me', callback);
  }

  onUserJoined(
    callback: (
      data: Parameters<ServerToClientEvents['user_joined']>[0],
    ) => void,
  ): void {
    this.socket?.on('user_joined', callback);
  }

  onUserLeft(callback: (userId: string) => void): void {
    this.socket?.on('user_left', callback);
  }

  onSpectatorJoined(callback: (spectatorId: string) => void): void {
    this.socket?.on('spectator_joined', callback);
  }

  onSpectatorLeft(callback: (spectatorId: string) => void): void {
    this.socket?.on('spectator_left', callback);
  }

  onUserUpdate(
    callback: (userId: string, data: { username: string }) => void,
  ): void {
    this.socket?.on('update_user', callback);
  }

  onOwnerTransfer(callback: (newOwnerId: string) => void): void {
    this.socket?.on('owner_transfer', callback);
  }

  onPairCreated(
    callback: (
      data: Parameters<ServerToClientEvents['create_pair']>[0],
    ) => void,
  ): void {
    this.socket?.on('create_pair', callback);
  }

  onPairResponse(
    callback: (
      data: Parameters<ServerToClientEvents['pair_response']>[0],
    ) => void,
  ): void {
    this.socket?.on('pair_response', callback);
  }

  onPairUpdated(
    callback: (
      data: Parameters<ServerToClientEvents['update_pair']>[0],
    ) => void,
  ): void {
    this.socket?.on('update_pair', callback);
  }

  onPairedUserUpdated(
    callback: (
      data: Parameters<ServerToClientEvents['update_paired_user']>[0],
    ) => void,
  ): void {
    this.socket?.on('update_paired_user', callback);
  }

  onPairLeft(
    callback: (data: Parameters<ServerToClientEvents['leave_pair']>[0]) => void,
  ): void {
    this.socket?.on('leave_pair', callback);
  }

  onPairRemoved(callback: (pairId: string) => void): void {
    this.socket?.on('remove_pair', callback);
  }

  onModsUpdated(callback: (mods: string[]) => void): void {
    this.socket?.on('update_mods', callback);
  }

  onEvidenceAdded(
    callback: (
      data: Parameters<ServerToClientEvents['add_evidence']>[0],
    ) => void,
  ): void {
    this.socket?.on('add_evidence', callback);
  }

  onProfileAdded(
    callback: (
      data: Parameters<ServerToClientEvents['add_profile']>[0],
    ) => void,
  ): void {
    this.socket?.on('add_profile', callback);
  }

  onEvidenceDeleted(callback: (id: string) => void): void {
    this.socket?.on('delete_evidence', callback);
  }

  onProfileDeleted(callback: (id: string) => void): void {
    this.socket?.on('delete_profile', callback);
  }

  onBackgroundAdded(
    callback: (
      data: Parameters<ServerToClientEvents['add_background']>[0],
    ) => void,
  ): void {
    this.socket?.on('add_background', callback);
  }

  onBackgroundDeleted(callback: (id: string) => void): void {
    this.socket?.on('delete_background', callback);
  }

  onError(callback: (message: string) => void): void {
    this.socket?.on('error', callback);
  }

  onCriticalError(
    callback: (
      data: Parameters<ServerToClientEvents['critical_error']>[0],
    ) => void,
  ): void {
    this.socket?.on('critical_error', callback);
  }

  // Remove event listeners
  off(
    event: keyof ServerToClientEvents,
    callback?: (...args: unknown[]) => void,
  ): void {
    this.socket?.off(event, callback);
  }

  // Remove all event listeners
  removeAllListeners(): void {
    this.socket?.removeAllListeners();
  }

  // Update callback registration methods
  onConnect(callback: () => void): void {
    if (this.socket) {
      this.socket.on('connect', callback);
    } else {
      this.pendingConnectCallback = callback;
    }
  }

  onConnectError(callback: (error: Error) => void): void {
    if (this.socket) {
      this.socket.on('connect_error', callback);
    } else {
      this.pendingConnectErrorCallback = callback;
    }
  }

  registerConnectionStateChangeCallback(
    callback: (state: ConnectionState) => void,
  ): void {
    this.connectionStateChangeCallback = callback;
  }

  clearConnectionCallbacks(): void {
    this.pendingConnectCallback = undefined;
    this.pendingConnectErrorCallback = undefined;
    this.connectionStateChangeCallback = undefined;
  }
}
