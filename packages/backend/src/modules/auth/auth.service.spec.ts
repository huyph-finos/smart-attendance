import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import * as bcrypt from 'bcrypt';

vi.mock('bcrypt', () => ({
  default: { compare: vi.fn() },
  compare: vi.fn(),
}));

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
};

const mockJwtService = {
  sign: vi.fn().mockReturnValue('mock-token'),
};

const mockConfigService = {
  getOrThrow: vi.fn().mockReturnValue('test-refresh-secret'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  const mockUser = {
    id: 'user-1',
    email: 'admin@smartattendance.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN',
    branchId: 'branch-1',
    passwordHash: '$2b$10$hashed',
    isActive: true,
  };

  describe('login', () => {
    it('should return tokens on successful login', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(true);

      const result = await service.login('admin@smartattendance.com', 'admin123');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('admin@smartattendance.com');
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for wrong email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login('wrong@email.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(false);

      await expect(
        service.login('admin@smartattendance.com', 'wrong'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException for inactive account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(
        service.login('admin@smartattendance.com', 'admin123'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('refresh', () => {
    it('should return new tokens on valid refresh', async () => {
      mockRedis.get.mockResolvedValue('valid');
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.refresh('user-1', 'token-id-1');

      expect(result).toHaveProperty('accessToken');
      expect(mockRedis.del).toHaveBeenCalled(); // old token deleted (rotation)
      expect(mockRedis.set).toHaveBeenCalled(); // new token stored
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(
        service.refresh('user-1', 'invalid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      mockRedis.get.mockResolvedValue('valid');
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(
        service.refresh('user-1', 'token-id-1'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should delete refresh token from Redis', async () => {
      await service.logout('user-1', 'token-id-1');

      expect(mockRedis.del).toHaveBeenCalledWith('refresh:user-1:token-id-1');
    });
  });

  describe('getMe', () => {
    it('should return user data', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'admin@smartattendance.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        branchId: 'branch-1',
      });

      const result = await service.getMe('user-1');
      expect(result.email).toBe('admin@smartattendance.com');
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe('non-existent')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
