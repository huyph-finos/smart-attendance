import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const cacheKey = `user:profile:${payload.sub}`;

    // Try Redis cache first (avoids DB hit on every authenticated request)
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const user = JSON.parse(cached);
        if (!user.isActive) {
          throw new UnauthorizedException('User not found or inactive');
        }
        return user;
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.warn(`JWT cache read failed: ${(err as Error).message}`);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        branchId: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Cache for 15 minutes (matches JWT access token TTL)
    try {
      await this.redis.setex(cacheKey, 900, JSON.stringify(user));
    } catch { /* non-fatal */ }

    return user;
  }
}
