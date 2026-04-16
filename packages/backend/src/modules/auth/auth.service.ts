import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
const uuidv4 = randomUUID;
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { User } from '../../generated/prisma';
import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  private readonly refreshSecret: string;
  private readonly refreshExpiresIn: number = 7 * 24 * 60 * 60; // 7 days in seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {
    this.refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  async login(email: string, password: string): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is deactivated');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.generateTokens(user);
  }

  async refresh(
    userId: string,
    tokenId: string,
  ): Promise<AuthResponseDto> {
    // Check if the refresh token exists in Redis
    const redisKey = `refresh:${userId}:${tokenId}`;
    const stored = await this.redis.get(redisKey);

    if (!stored) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    // Delete the old refresh token (rotation)
    await this.redis.del(redisKey);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return this.generateTokens(user);
  }

  async logout(userId: string, tokenId: string): Promise<void> {
    const redisKey = `refresh:${userId}:${tokenId}`;
    await this.redis.del(redisKey);
  }

  async getMe(userId: string): Promise<AuthUserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        branchId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  private async generateTokens(user: User): Promise<AuthResponseDto> {
    const tokenId = uuidv4();

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        tokenId,
      },
      {
        secret: this.refreshSecret,
        expiresIn: '7d',
      },
    );

    // Store refresh token in Redis with 7-day TTL
    const redisKey = `refresh:${user.id}:${tokenId}`;
    await this.redis.set(redisKey, 'valid', 'EX', this.refreshExpiresIn);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        branchId: user.branchId,
      },
    };
  }
}
