import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import * as webPush from 'web-push';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    // Configure web-push VAPID keys if available
    const vapidPublicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const vapidEmail = this.configService.get<string>('VAPID_EMAIL') || 'mailto:admin@smartattendance.com';

    if (vapidPublicKey && vapidPrivateKey) {
      webPush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
    }
  }

  /**
   * Create a new notification record in the database.
   */
  async create(
    userId: string,
    title: string,
    body: string,
    type: string,
    metadata?: Record<string, any>,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title,
        body,
        type,
        metadata: metadata ?? undefined,
      },
    });

    // Attempt to send a push notification (non-blocking)
    this.sendPush(userId, title, body).catch((err) =>
      this.logger.warn(`Push notification failed for user ${userId}: ${err.message}`),
    );

    return notification;
  }

  /**
   * Get paginated notifications for a user, with unread items first.
   */
  async findAll(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return {
      data: notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Mark a single notification as read.
   */
  async markRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  /**
   * Get the count of unread notifications for a user.
   */
  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { unreadCount: count };
  }

  /**
   * Store a Web Push subscription in Redis for a user.
   * Subscriptions are stored as a JSON array so a user can have multiple devices.
   */
  async subscribe(userId: string, subscription: PushSubscriptionJSON) {
    const key = `push:subscriptions:${userId}`;
    const existing = await this.redis.get(key);
    const subscriptions: PushSubscriptionJSON[] = existing
      ? JSON.parse(existing)
      : [];

    // Avoid duplicates by checking the endpoint
    const alreadyExists = subscriptions.some(
      (s) => s.endpoint === subscription.endpoint,
    );
    if (!alreadyExists) {
      subscriptions.push(subscription);
      await this.redis.set(key, JSON.stringify(subscriptions));
    }

    return { success: true, deviceCount: subscriptions.length };
  }

  /**
   * Send a Web Push notification to all registered devices for a user.
   */
  async sendPush(userId: string, title: string, body: string): Promise<void> {
    const key = `push:subscriptions:${userId}`;
    const raw = await this.redis.get(key);
    if (!raw) return;

    const subscriptions: PushSubscriptionJSON[] = JSON.parse(raw);
    const payload = JSON.stringify({
      title,
      body,
      icon: '/icons/notification-icon.png',
      badge: '/icons/badge-icon.png',
      timestamp: Date.now(),
    });

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webPush.sendNotification(sub as any, payload),
      ),
    );

    // Remove expired subscriptions (status code 410)
    const validSubscriptions = subscriptions.filter((_, i) => {
      const result = results[i];
      if (result.status === 'rejected') {
        const statusCode = (result.reason as any)?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          this.logger.log(`Removing expired push subscription for user ${userId}`);
          return false;
        }
      }
      return true;
    });

    if (validSubscriptions.length !== subscriptions.length) {
      await this.redis.set(key, JSON.stringify(validSubscriptions));
    }
  }
}

/**
 * Type for the push subscription JSON that clients send.
 */
interface PushSubscriptionJSON {
  endpoint: string;
  keys?: {
    p256dh: string;
    auth: string;
  };
}
