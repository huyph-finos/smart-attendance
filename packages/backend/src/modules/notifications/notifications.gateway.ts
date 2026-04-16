import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * WebSocket gateway for real-time notifications.
 *
 * Clients connect with a JWT token (via handshake auth, query param, or header).
 * On successful auth, the client joins a user-specific room (`user:<id>`),
 * allowing targeted event delivery.
 *
 * We avoid importing socket.io types directly since pnpm does not hoist them.
 * Instead we use the `any` type for Server and Socket, which is safe because
 * @nestjs/platform-socket.io provides the concrete implementation at runtime.
 */
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: any; // socket.io Server instance provided by NestJS at runtime

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Authenticate the client on connection using the JWT token
   * passed in the handshake query or auth header.
   * On success, join the client to a user-specific room.
   */
  async handleConnection(client: any) {
    try {
      const handshake = client.handshake;
      const token =
        handshake?.auth?.token ||
        handshake?.query?.token ||
        handshake?.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn('WebSocket connection rejected: no token');
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Attach user info to the socket for later use
      client.userId = payload.sub;
      client.userRole = payload.role;

      // Join the user's private room
      client.join(`user:${payload.sub}`);

      this.logger.log(`Client connected: ${payload.sub} (socket ${client.id})`);
    } catch (err) {
      this.logger.warn(
        `WebSocket connection rejected: invalid token (${(err as Error).message})`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: any) {
    const userId = client.userId;
    if (userId) {
      this.logger.log(`Client disconnected: ${userId} (socket ${client.id})`);
    }
  }

  // ---------------------------------------------------------------------------
  // Public methods for other services to emit events to specific users
  // ---------------------------------------------------------------------------

  /**
   * Emit an event to a specific user's room.
   * All connected devices/tabs for that user will receive it.
   */
  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Emit a new notification event to a user.
   */
  sendNotification(userId: string, notification: any) {
    this.emitToUser(userId, 'notification:new', notification);
  }

  /**
   * Emit an attendance check-in event.
   */
  sendCheckInEvent(userId: string, attendance: any) {
    this.emitToUser(userId, 'attendance:checkin', attendance);
  }

  /**
   * Emit an anomaly detection event.
   */
  sendAnomalyEvent(userId: string, anomaly: any) {
    this.emitToUser(userId, 'anomaly:detected', anomaly);
  }

  /**
   * Broadcast an event to all connected clients.
   */
  broadcastEvent(event: string, data: any) {
    this.server.emit(event, data);
  }
}
