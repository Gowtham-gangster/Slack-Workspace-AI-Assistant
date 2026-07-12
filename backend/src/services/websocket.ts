import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../middleware/auth.js';

let io: Server | null = null;

export function initWebSocketServer(server: HttpServer) {
  const IS_PRODUCTION = process.env.NODE_ENV === 'production';
  const ALLOWED_ORIGINS: string[] = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (!IS_PRODUCTION) {
    ALLOWED_ORIGINS.push(
      'http://localhost:3000', 'http://127.0.0.1:3000',
      'http://localhost:3001', 'http://127.0.0.1:3001',
      'http://localhost:7505', 'http://127.0.0.1:7505',
      'http://localhost:4000', 'http://localhost:5000',
      'http://localhost:8080', 'http://localhost:8000',
    );
  }

  io = new Server(server, {
    cors: {
      origin: ALLOWED_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST']
    },
    pingInterval: 25000,
    pingTimeout: 60000,
    transports: ['websocket', 'polling']
  });

  // JWT Authentication middleware for Socket.IO connection
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      console.warn('[WebSocket] Connection rejected: Token missing');
      return next(new Error('Unauthorized: Token missing'));
    }

    if (!JWT_SECRET) {
      console.error('[WebSocket] JWT_SECRET is not configured on server');
      return next(new Error('Unauthorized: Server configuration error'));
    }

    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
      if (err) {
        console.warn('[WebSocket] Connection rejected: Invalid or expired token');
        return next(new Error('Unauthorized: Token invalid'));
      }
      socket.data.user = decoded;
      next();
    });
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    console.log(`[WebSocket] Socket Connected (ID: ${socket.id}, User: ${user?.username || 'Unknown'})`);
    console.log('[WebSocket] Socket Authenticated');

    socket.on('join_channel', (channelId: string) => {
      socket.join(channelId);
      console.log(`[WebSocket] Joined Room: ${channelId}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[WebSocket] Disconnected (ID: ${socket.id}, Reason: ${reason})`);
    });
  });

  console.log('[WebSocket] WebSocket Server (Socket.IO) attached to Express HTTP server.');
}

export function broadcastReactionUpdate(messageId: string, channelId: string, reactions: any[]) {
  if (!io) {
    console.error('[WebSocket] Cannot broadcast: Socket.IO server is not initialized.');
    return;
  }

  const payload = {
    messageId,
    channelId,
    reactions
  };

  console.log(`[WebSocket] WebSocket emitted - reaction_update for message ${messageId} in room ${channelId}`);
  // Emit to all clients (server-wide broadcast) or targeted to room
  io.emit('reaction_update', payload);
}

export function broadcastNewMessage(channelId: string, message: any) {
  if (!io) return;
  console.log(`[WebSocket] WebSocket emitted - message for room ${channelId}`);
  io.emit('message', { channelId, message });
}

export function broadcastMessageChanged(channelId: string, message: any) {
  if (!io) return;
  console.log(`[WebSocket] WebSocket emitted - message_changed for room ${channelId}`);
  io.emit('message_changed', { channelId, message });
}

export function broadcastMessageDeleted(channelId: string, deletedTs: string) {
  if (!io) return;
  console.log(`[WebSocket] WebSocket emitted - message_deleted for room ${channelId}`);
  io.emit('message_deleted', { channelId, deletedTs });
}

export function broadcastReminderFired(userId: number, reminder: any) {
  if (!io) return;
  const sockets = io.sockets.sockets;
  for (const [id, socket] of sockets.entries()) {
    if (socket.data.user && Number(socket.data.user.id) === Number(userId)) {
      console.log(`[WebSocket] Sending reminder_fired to User ${userId} on socket ${id}`);
      socket.emit('reminder_fired', reminder);
    }
  }
}
