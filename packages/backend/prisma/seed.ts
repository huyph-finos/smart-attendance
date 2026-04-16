import { PrismaClient, Prisma, Role, AttendanceStatus, ShiftType, AnomalyType, AnomalySeverity, LeaveType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Vietnam city data for realistic branches
const cities = [
  { city: 'HCM', districts: ['Q1', 'Q2', 'Q3', 'Q7', 'QB', 'QTD', 'QGV', 'QPN', 'QTP', 'QBT'], lat: 10.7769, lng: 106.7009 },
  { city: 'HN', districts: ['CG', 'HBT', 'BD', 'TX', 'HK', 'LB', 'TL', 'HD', 'NTL', 'BTL'], lat: 21.0285, lng: 105.8542 },
  { city: 'DN', districts: ['HC', 'TK', 'ST', 'NK', 'LCH', 'CL', 'HV', 'NG'], lat: 16.0544, lng: 108.2022 },
  { city: 'HP', districts: ['HB', 'LC', 'NK', 'LK', 'DK'], lat: 20.8449, lng: 106.6881 },
  { city: 'CT', districts: ['NK', 'BT', 'CK', 'OD'], lat: 10.0452, lng: 105.7469 },
];

const departments = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations', 'Support', 'Management'];
const firstNames = ['Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Vu', 'Vo', 'Dang', 'Bui', 'Do', 'Ho', 'Ngo', 'Duong', 'Ly'];
const lastNames = ['Anh', 'Binh', 'Chi', 'Dung', 'Em', 'Giang', 'Hoa', 'Khoa', 'Linh', 'Minh', 'Nam', 'Phuc', 'Quang', 'Son', 'Tuan', 'Van', 'Xuan', 'Yen'];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function generateWifiBssid(): string {
  const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  return `${hex()}:${hex()}:${hex()}:${hex()}:${hex()}:${hex()}`;
}

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data (safe deletion in dependency order)
  await prisma.aiConversation.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.dailySummary.deleteMany();
  await prisma.anomaly.deleteMany();
  await prisma.shiftAssignment.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.leave.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.userDevice.deleteMany();
  await prisma.branchManager.deleteMany();
  await prisma.branchWifi.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.branch.deleteMany();

  // Create admin user
  const adminHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@smartattendance.com',
      passwordHash: adminHash,
      firstName: 'Admin',
      lastName: 'System',
      role: Role.ADMIN,
      phone: '0900000000',
    },
  });
  console.log(`✅ Admin created: ${admin.email}`);

  // Create 100 branches
  const branches: Array<{ id: string; latitude: number; longitude: number; code: string; workStartTime: string; lateThreshold: number }> = [];
  let branchIndex = 0;
  for (const cityData of cities) {
    const numBranches = cityData.city === 'HCM' ? 30 : cityData.city === 'HN' ? 30 : cityData.city === 'DN' ? 20 : 10;
    for (let i = 0; i < numBranches; i++) {
      const district = cityData.districts[i % cityData.districts.length];
      const branch = await prisma.branch.create({
        data: {
          name: `Chi nhánh ${cityData.city} - ${district} ${Math.floor(i / cityData.districts.length) + 1}`,
          code: `${cityData.city}-${district}-${Math.floor(i / cityData.districts.length) + 1}`,
          address: `${100 + i} Đường ${district}, ${cityData.city}`,
          latitude: cityData.lat + randomFloat(-0.05, 0.05),
          longitude: cityData.lng + randomFloat(-0.05, 0.05),
          radius: [100, 150, 200, 250, 300][Math.floor(Math.random() * 5)],
          workStartTime: ['07:30', '08:00', '08:30', '09:00'][Math.floor(Math.random() * 4)],
          workEndTime: ['16:30', '17:00', '17:30', '18:00'][Math.floor(Math.random() * 4)],
          lateThreshold: [10, 15, 20][Math.floor(Math.random() * 3)],
          allowedIpRanges: ['127.0.0.0/8', '::1/128', '10.0.0.0/8', '192.168.0.0/16'],
        },
      });
      branches.push(branch);
      branchIndex++;
    }
  }
  console.log(`✅ ${branches.length} branches created`);

  // Create WiFi configs for each branch (2-3 APs per branch)
  for (const branch of branches) {
    const apCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < apCount; i++) {
      await prisma.branchWifi.create({
        data: {
          branchId: branch.id,
          ssid: `SmartAttend-${branch.code}`,
          bssid: generateWifiBssid(),
          floor: `Floor ${i + 1}`,
        },
      });
    }
  }
  console.log('✅ WiFi configs created');

  // Create departments for each branch
  const allDepts: { id: string; branchId: string }[] = [];
  for (const branch of branches) {
    const deptCount = 3 + Math.floor(Math.random() * 4);
    const selectedDepts = departments.slice(0, deptCount);
    for (const deptName of selectedDepts) {
      const dept = await prisma.department.create({
        data: {
          name: deptName,
          code: deptName.toUpperCase().slice(0, 4),
          branchId: branch.id,
        },
      });
      allDepts.push({ id: dept.id, branchId: branch.id });
    }
  }
  console.log(`✅ ${allDepts.length} departments created`);

  // Create 5000 employees (50 per branch on average)
  const passwordHash = await bcrypt.hash('employee123', 10);
  const allUsers: Array<{ id: string; branchId: string }> = [];

  // Create managers first (1-2 per branch)
  for (const branch of branches) {
    const managerCount = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < managerCount; i++) {
      const branchDepts = allDepts.filter(d => d.branchId === branch.id);
      const user = await prisma.user.create({
        data: {
          email: `manager.${branch.code.toLowerCase().replace(/[^a-z0-9]/g, '')}.${i}@smartattendance.com`,
          passwordHash,
          firstName: randomElement(firstNames),
          lastName: `${randomElement(lastNames)} (Manager)`,
          role: Role.MANAGER,
          branchId: branch.id,
          departmentId: branchDepts.length > 0 ? branchDepts[0].id : undefined,
          phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
        },
      });
      await prisma.branchManager.create({
        data: { userId: user.id, branchId: branch.id },
      });
      allUsers.push({ id: user.id, branchId: branch.id });
    }
  }
  console.log('✅ Managers created');

  // Create regular employees (distribute ~48 per branch to reach ~5000 total)
  const employeesPerBranch = Math.floor(4800 / branches.length);
  for (const branch of branches) {
    const branchDepts = allDepts.filter(d => d.branchId === branch.id);
    for (let i = 0; i < employeesPerBranch; i++) {
      const user = await prisma.user.create({
        data: {
          email: `emp.${branch.code.toLowerCase().replace(/[^a-z0-9]/g, '')}.${i}@smartattendance.com`,
          passwordHash,
          firstName: randomElement(firstNames),
          lastName: randomElement(lastNames),
          role: Role.EMPLOYEE,
          branchId: branch.id,
          departmentId: branchDepts.length > 0 ? randomElement(branchDepts).id : undefined,
          phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
        },
      });
      allUsers.push({ id: user.id, branchId: branch.id });
    }
  }
  console.log(`✅ ${allUsers.length} employees created`);

  // Create attendance records for the last 30 days
  const today = new Date();
  console.log('📊 Creating 30 days of attendance data...');

  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const date = new Date(today);
    date.setDate(date.getDate() - dayOffset);
    date.setHours(0, 0, 0, 0);

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    // Process in batches per branch
    for (const branch of branches) {
      const branchUsers = allUsers.filter(u => u.branchId === branch.id);
      const attendanceData: Prisma.AttendanceCreateManyInput[] = [];

      for (const user of branchUsers) {
        // 90% attendance rate
        if (Math.random() > 0.9) continue;

        const isLateToday = Math.random() < 0.12; // 12% late rate
        const checkInHour = isLateToday
          ? 8 + Math.floor(Math.random() * 2)
          : 7 + Math.floor(Math.random() * 2);
        const checkInMin = Math.floor(Math.random() * 60);
        const checkIn = new Date(date);
        checkIn.setHours(checkInHour, checkInMin, 0, 0);

        const workHours = 7.5 + Math.random() * 2;
        const checkOut = new Date(checkIn.getTime() + workHours * 60 * 60 * 1000);
        const overtime = Math.max(0, workHours - 8);

        attendanceData.push({
          userId: user.id,
          branchId: branch.id,
          date,
          checkInTime: checkIn,
          checkOutTime: checkOut,
          status: isLateToday ? AttendanceStatus.LATE : AttendanceStatus.ON_TIME,
          totalHours: Math.round(workHours * 100) / 100,
          overtimeHours: Math.round(overtime * 100) / 100,
          checkInLat: branch.latitude + randomFloat(-0.001, 0.001),
          checkInLng: branch.longitude + randomFloat(-0.001, 0.001),
          checkOutLat: branch.latitude + randomFloat(-0.001, 0.001),
          checkOutLng: branch.longitude + randomFloat(-0.001, 0.001),
          fraudScore: Math.random() < 0.05 ? Math.floor(Math.random() * 40) + 20 : Math.floor(Math.random() * 15),
          isVerified: true,
        });
      }

      if (attendanceData.length > 0) {
        await prisma.attendance.createMany({ data: attendanceData, skipDuplicates: true });
      }
    }

    if (dayOffset % 5 === 0) {
      console.log(`  📅 Day -${dayOffset} done`);
    }
  }
  console.log('✅ Attendance data created');

  // Create shifts
  for (const branch of branches) {
    await prisma.shift.createMany({
      data: [
        { branchId: branch.id, name: 'Ca sáng', type: ShiftType.MORNING, startTime: '06:00', endTime: '14:00' },
        { branchId: branch.id, name: 'Ca chiều', type: ShiftType.AFTERNOON, startTime: '14:00', endTime: '22:00' },
        { branchId: branch.id, name: 'Ca linh hoạt', type: ShiftType.FLEXIBLE, startTime: '08:00', endTime: '17:00' },
      ],
    });
  }
  console.log('✅ Shifts created');

  // Create anomalies for suspicious attendance records
  console.log('🔍 Creating anomaly records...');
  const suspiciousAttendances = await prisma.attendance.findMany({
    where: { fraudScore: { gte: 20 } },
    take: 200,
    orderBy: { fraudScore: 'desc' },
  });

  const anomalyTypes = [AnomalyType.SPEED_ANOMALY, AnomalyType.DEVICE_MISMATCH, AnomalyType.LOCATION_SPOOF, AnomalyType.WIFI_MISMATCH, AnomalyType.TIME_PATTERN];
  const anomalyDescs = [
    'Tốc độ di chuyển bất thường giữa hai lần check-in',
    'Thiết bị không khớp với thiết bị thường dùng',
    'Phát hiện dấu hiệu giả mạo vị trí GPS',
    'WiFi BSSID không khớp với danh sách chi nhánh',
    'Pattern thời gian check-in bất thường so với lịch sử',
  ];

  for (const att of suspiciousAttendances) {
    const idx = Math.floor(Math.random() * anomalyTypes.length);
    const severity = att.fraudScore > 60 ? AnomalySeverity.CRITICAL
      : att.fraudScore > 40 ? AnomalySeverity.HIGH
      : att.fraudScore > 25 ? AnomalySeverity.MEDIUM
      : AnomalySeverity.LOW;

    await prisma.anomaly.create({
      data: {
        attendanceId: att.id,
        type: anomalyTypes[idx],
        severity,
        description: anomalyDescs[idx],
        isResolved: Math.random() < 0.3,
        resolvedNote: Math.random() < 0.3 ? 'Đã xác minh với quản lý chi nhánh' : undefined,
      },
    });
  }
  console.log(`✅ ${suspiciousAttendances.length} anomalies created`);

  // Create leave records
  console.log('📋 Creating leave records...');
  const leaveTypes = [LeaveType.ANNUAL, LeaveType.SICK, LeaveType.PERSONAL];
  const leaveReasons = ['Nghỉ phép năm', 'Khám bệnh', 'Việc cá nhân', 'Du lịch gia đình', 'Nghỉ ốm'];
  const sampleUsers = allUsers.slice(0, 300);

  for (const user of sampleUsers) {
    const numLeaves = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numLeaves; i++) {
      const startOffset = Math.floor(Math.random() * 25) + 1;
      const duration = 1 + Math.floor(Math.random() * 3);
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - startOffset);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + duration - 1);

      await prisma.leave.create({
        data: {
          userId: user.id,
          type: randomElement(leaveTypes),
          startDate,
          endDate,
          reason: randomElement(leaveReasons),
          isApproved: Math.random() < 0.6 ? true : Math.random() < 0.5 ? false : null,
        },
      });
    }
  }
  console.log('✅ Leave records created');

  // Create daily summaries for dashboard performance
  console.log('📊 Creating daily summaries...');
  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const date = new Date(today);
    date.setDate(date.getDate() - dayOffset);
    date.setHours(0, 0, 0, 0);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    for (const branch of branches) {
      const branchEmployeeCount = allUsers.filter(u => u.branchId === branch.id).length;
      const presentCount = Math.floor(branchEmployeeCount * (0.85 + Math.random() * 0.1));
      const lateCount = Math.floor(presentCount * (0.08 + Math.random() * 0.08));

      await prisma.dailySummary.create({
        data: {
          branchId: branch.id,
          date,
          totalEmployees: branchEmployeeCount,
          presentCount,
          lateCount,
          absentCount: branchEmployeeCount - presentCount,
          onLeaveCount: Math.floor(Math.random() * 3),
          avgCheckInTime: `08:${String(Math.floor(Math.random() * 20)).padStart(2, '0')}`,
          avgHoursWorked: 7.5 + Math.random() * 1.5,
          totalOvertimeHrs: Math.random() * 10,
          anomalyCount: Math.floor(Math.random() * 3),
        },
      });
    }
  }
  console.log('✅ Daily summaries created');

  // Create sample notifications
  console.log('🔔 Creating notifications...');
  const notifTemplates = [
    { title: 'Nhắc nhở chấm công', body: 'Bạn chưa check-in hôm nay', type: 'reminder' },
    { title: 'Anomaly phát hiện', body: 'Phát hiện bất thường trong chấm công', type: 'anomaly' },
    { title: 'Đơn nghỉ phép được duyệt', body: 'Đơn nghỉ phép của bạn đã được phê duyệt', type: 'leave' },
    { title: 'Ca làm mới', body: 'Bạn được phân ca mới cho tuần tới', type: 'shift' },
    { title: 'Báo cáo tháng', body: 'Báo cáo chấm công tháng này đã sẵn sàng', type: 'report' },
  ];

  for (const user of allUsers.slice(0, 500)) {
    const notif = randomElement(notifTemplates);
    await prisma.notification.create({
      data: {
        userId: user.id,
        title: notif.title,
        body: notif.body,
        type: notif.type,
        isRead: Math.random() < 0.4,
      },
    });
  }
  console.log('✅ Notifications created');

  console.log('\n🎉 Seeding completed!');
  console.log(`   - 1 Admin: admin@smartattendance.com / admin123`);
  console.log(`   - ${branches.length} Branches`);
  console.log(`   - ~${allUsers.length} Users (password: employee123)`);
  console.log(`   - 30 days of attendance data`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
