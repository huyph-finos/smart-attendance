/**
 * Tool Registry - Gemini Function Declaration Definitions
 *
 * Defines all tools available to the AI agents in the Gemini Function Calling format.
 * Each tool has a name, description, and parameters (JSON Schema).
 */

import { SchemaType } from '@google/generative-ai';

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: SchemaType;
    properties: Record<string, any>;
    required?: string[];
  };
}

const queryAttendance: FunctionDeclaration = {
  name: 'query_attendance',
  description:
    'Query attendance records from the database. Returns a list of attendance entries with user info, check-in/out times, status, and hours worked. Use this to look up specific attendance data.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      startDate: {
        type: SchemaType.STRING,
        description: 'Start date in ISO 8601 format (YYYY-MM-DD)',
      },
      endDate: {
        type: SchemaType.STRING,
        description: 'End date in ISO 8601 format (YYYY-MM-DD)',
      },
      branchId: {
        type: SchemaType.STRING,
        description: 'Filter by branch ID (UUID)',
      },
      userId: {
        type: SchemaType.STRING,
        description: 'Filter by specific user ID (UUID)',
      },
      status: {
        type: SchemaType.STRING,
        description:
          'Filter by attendance status. One of: ON_TIME, LATE, EARLY_LEAVE, ABSENT, ON_LEAVE',
      },
      limit: {
        type: SchemaType.NUMBER,
        description: 'Max records to return (default 50, max 200)',
      },
    },
    required: ['startDate', 'endDate'],
  },
};

const queryEmployees: FunctionDeclaration = {
  name: 'query_employees',
  description:
    'Query employee records. Returns user details including name, email, role, branch, and department.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      branchId: {
        type: SchemaType.STRING,
        description: 'Filter by branch ID',
      },
      departmentId: {
        type: SchemaType.STRING,
        description: 'Filter by department ID',
      },
      role: {
        type: SchemaType.STRING,
        description:
          'Filter by role. One of: ADMIN, MANAGER, EMPLOYEE',
      },
      search: {
        type: SchemaType.STRING,
        description:
          'Search by name or email (partial match, case-insensitive)',
      },
      limit: {
        type: SchemaType.NUMBER,
        description: 'Max records to return (default 50, max 200)',
      },
    },
    required: [],
  },
};

const aggregateStats: FunctionDeclaration = {
  name: 'aggregate_stats',
  description:
    'Get aggregated attendance statistics. Returns computed metrics grouped by the specified dimension. Use this for summary reports and dashboards.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      metric: {
        type: SchemaType.STRING,
        description:
          'The metric to compute. One of: attendance_rate, late_count, avg_hours, overtime',
      },
      groupBy: {
        type: SchemaType.STRING,
        description:
          'How to group the results. One of: branch, department, day, week, month',
      },
      startDate: {
        type: SchemaType.STRING,
        description: 'Start date (YYYY-MM-DD)',
      },
      endDate: {
        type: SchemaType.STRING,
        description: 'End date (YYYY-MM-DD)',
      },
      branchId: {
        type: SchemaType.STRING,
        description: 'Optional branch filter',
      },
    },
    required: ['metric', 'groupBy', 'startDate', 'endDate'],
  },
};

const detectPatterns: FunctionDeclaration = {
  name: 'detect_patterns',
  description:
    'Analyze attendance data for patterns and anomalies. Returns detected patterns with confidence scores.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      userId: {
        type: SchemaType.STRING,
        description: 'Analyze patterns for a specific user',
      },
      branchId: {
        type: SchemaType.STRING,
        description: 'Analyze patterns for a specific branch',
      },
      dateRange: {
        type: SchemaType.STRING,
        description: 'Date range as "YYYY-MM-DD/YYYY-MM-DD"',
      },
      patternType: {
        type: SchemaType.STRING,
        description:
          'Type of pattern to detect. One of: time (check-in/out timing), frequency (absence patterns), location (geo anomalies), anomaly (fraud signals)',
      },
    },
    required: ['dateRange', 'patternType'],
  },
};

const getBranchInfo: FunctionDeclaration = {
  name: 'get_branch_info',
  description:
    'Get details about branches including address, work hours, wifi configs, and employee count.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      branchId: {
        type: SchemaType.STRING,
        description:
          'Specific branch ID. If omitted, returns all active branches.',
      },
    },
    required: [],
  },
};

const calculateOvertime: FunctionDeclaration = {
  name: 'calculate_overtime',
  description:
    'Calculate total overtime hours for a specific employee in a given month.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      userId: {
        type: SchemaType.STRING,
        description: 'The employee user ID',
      },
      month: {
        type: SchemaType.NUMBER,
        description: 'Month number (1-12)',
      },
      year: {
        type: SchemaType.NUMBER,
        description: 'Year (e.g. 2026)',
      },
    },
    required: ['userId', 'month', 'year'],
  },
};

const getLeaveBalance: FunctionDeclaration = {
  name: 'get_leave_balance',
  description:
    'Get leave records and balance for an employee, including approved, pending, and used leave days by type.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      userId: {
        type: SchemaType.STRING,
        description: 'The employee user ID',
      },
    },
    required: ['userId'],
  },
};

const sendNotification: FunctionDeclaration = {
  name: 'send_notification',
  description:
    'Send a notification to a specific user. Use this to alert users about important findings or actions needed.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      userId: {
        type: SchemaType.STRING,
        description: 'The target user ID',
      },
      title: {
        type: SchemaType.STRING,
        description: 'Notification title',
      },
      body: {
        type: SchemaType.STRING,
        description: 'Notification body text',
      },
      type: {
        type: SchemaType.STRING,
        description:
          'Notification type (e.g. "info", "warning", "alert", "anomaly")',
      },
    },
    required: ['userId', 'title', 'body', 'type'],
  },
};

/**
 * Returns the complete array of function declarations for the Gemini API.
 */
export function getToolDefinitions(): FunctionDeclaration[] {
  return [
    queryAttendance,
    queryEmployees,
    aggregateStats,
    detectPatterns,
    getBranchInfo,
    calculateOvertime,
    getLeaveBalance,
    sendNotification,
  ];
}
