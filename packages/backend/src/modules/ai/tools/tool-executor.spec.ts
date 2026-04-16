import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeTool } from './tool-executor';

const mockPrisma = {
  attendance: {
    findMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  user: { findMany: vi.fn(), findUnique: vi.fn() },
  branch: { findMany: vi.fn() },
  anomaly: { findMany: vi.fn() },
  leave: { findMany: vi.fn() },
  notification: { create: vi.fn() },
} as any;

const adminContext = { userId: 'admin-1', role: 'ADMIN', branchId: undefined };
const managerContext = { userId: 'mgr-1', role: 'MANAGER', branchId: 'branch-1' };

describe('executeTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error for unknown tool', async () => {
    const result = await executeTool('unknown_tool', {}, mockPrisma, adminContext);
    expect(JSON.parse(result)).toEqual({ error: 'Unknown tool: unknown_tool' });
  });

  describe('query_attendance', () => {
    it('should query attendance records with date range', async () => {
      mockPrisma.attendance.findMany.mockResolvedValue([
        {
          id: 'att-1',
          userId: 'user-1',
          date: new Date('2024-01-15'),
          checkInTime: new Date('2024-01-15T08:00:00Z'),
          checkOutTime: new Date('2024-01-15T17:00:00Z'),
          status: 'ON_TIME',
          totalHours: 9,
          overtimeHours: 1,
          fraudScore: 0,
          user: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@test.com' },
          branch: { id: 'branch-1', name: 'HCM Q1' },
        },
      ]);

      const result = JSON.parse(
        await executeTool(
          'query_attendance',
          { startDate: '2024-01-01', endDate: '2024-01-31' },
          mockPrisma,
          adminContext,
        ),
      );

      expect(result.count).toBe(1);
      expect(result.records[0].userName).toBe('John Doe');
      expect(result.records[0].status).toBe('ON_TIME');
    });

    it('should scope to manager branch when no branchId provided', async () => {
      mockPrisma.attendance.findMany.mockResolvedValue([]);

      await executeTool(
        'query_attendance',
        { startDate: '2024-01-01', endDate: '2024-01-31' },
        mockPrisma,
        managerContext,
      );

      expect(mockPrisma.attendance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ branchId: 'branch-1' }),
        }),
      );
    });
  });

  describe('query_employees', () => {
    it('should return employee list', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'u1',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@test.com',
          role: 'EMPLOYEE',
          phone: '0909123456',
          branch: { id: 'b1', name: 'HCM Q1' },
          department: { id: 'd1', name: 'Engineering' },
        },
      ]);

      const result = JSON.parse(
        await executeTool('query_employees', {}, mockPrisma, adminContext),
      );
      expect(result.count).toBe(1);
      expect(result.employees[0].firstName).toBe('Jane');
    });
  });

  describe('aggregate_stats', () => {
    it('should calculate attendance_rate', async () => {
      mockPrisma.attendance.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(80)  // onTime
        .mockResolvedValueOnce(15)  // late
        .mockResolvedValueOnce(5);  // absent

      const result = JSON.parse(
        await executeTool(
          'aggregate_stats',
          { startDate: '2024-01-01', endDate: '2024-01-31', metric: 'attendance_rate' },
          mockPrisma,
          adminContext,
        ),
      );

      expect(result.metric).toBe('attendance_rate');
      expect(result.total).toBe(100);
      expect(result.rate).toBe(95); // (80+15)/100 * 100
    });

    it('should return error for unknown metric', async () => {
      const result = JSON.parse(
        await executeTool(
          'aggregate_stats',
          { startDate: '2024-01-01', endDate: '2024-01-31', metric: 'unknown' },
          mockPrisma,
          adminContext,
        ),
      );
      expect(result.error).toContain('Unknown metric');
    });
  });

  describe('get_branch_info', () => {
    it('should return branch information', async () => {
      mockPrisma.branch.findMany.mockResolvedValue([
        {
          id: 'b1',
          name: 'HCM Q1',
          code: 'HCM-Q1',
          address: '123 Street',
          latitude: 10.77,
          longitude: 106.70,
          radius: 200,
          timezone: 'Asia/Ho_Chi_Minh',
          workStartTime: '08:00',
          workEndTime: '17:00',
          lateThreshold: 15,
          wifiConfigs: [{ ssid: 'OfficeWifi', bssid: 'AA:BB:CC', floor: '1' }],
          _count: { employees: 50, departments: 3 },
        },
      ]);

      const result = JSON.parse(
        await executeTool('get_branch_info', { branchId: 'b1' }, mockPrisma, adminContext),
      );

      expect(result.branches).toHaveLength(1);
      expect(result.branches[0].employeeCount).toBe(50);
    });
  });

  describe('send_notification', () => {
    it('should create notification and return success', async () => {
      mockPrisma.notification.create.mockResolvedValue({ id: 'notif-1' });

      const result = JSON.parse(
        await executeTool(
          'send_notification',
          { userId: 'user-1', title: 'Test', body: 'Hello', type: 'INFO' },
          mockPrisma,
          adminContext,
        ),
      );

      expect(result.success).toBe(true);
      expect(result.notificationId).toBe('notif-1');
    });
  });

  describe('get_leave_balance', () => {
    it('should return leave balance summary', async () => {
      mockPrisma.leave.findMany.mockResolvedValue([
        {
          id: 'l1',
          type: 'ANNUAL',
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-03'),
          reason: 'Vacation',
          isApproved: true,
        },
      ]);
      mockPrisma.user.findUnique.mockResolvedValue({
        firstName: 'John',
        lastName: 'Doe',
      });

      const result = JSON.parse(
        await executeTool(
          'get_leave_balance',
          { userId: 'user-1' },
          mockPrisma,
          adminContext,
        ),
      );

      expect(result.annualAllowance).toBe(12);
      expect(result.totalUsed).toBe(3); // 3 days
      expect(result.remaining).toBe(9); // 12 - 3
    });
  });
});
