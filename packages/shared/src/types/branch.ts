export interface IBranch {
  id: string;
  name: string;
  code: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number;
  timezone: string;
  isActive: boolean;
  workStartTime: string;
  workEndTime: string;
  lateThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBranchWifi {
  id: string;
  branchId: string;
  ssid: string;
  bssid: string;
  floor?: string;
  isActive: boolean;
}

export interface IDepartment {
  id: string;
  name: string;
  code: string;
  branchId: string;
}
