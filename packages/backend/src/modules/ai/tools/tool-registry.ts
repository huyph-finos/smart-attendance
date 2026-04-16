/**
 * Tool Registry - Claude API Tool Definitions
 *
 * Defines all tools available to the AI agents in the Claude Tool Use format.
 * Each tool has a name, description, and input_schema (JSON Schema).
 */

import type Anthropic from '@anthropic-ai/sdk';

type Tool = Anthropic.Messages.Tool;

const queryAttendance: Tool = {
  name: 'query_attendance',
  description:
    'Query attendance records from the database. Returns a list of attendance entries with user info, check-in/out times, status, and hours worked. Use this to look up specific attendance data.',
  input_schema: {
    type: 'object' as const,
    properties: {
      startDate: {
        type: 'string',
        description: 'Start date in ISO 8601 format (YYYY-MM-DD)',
      },
      endDate: {
        type: 'string',
        description: 'End date in ISO 8601 format (YYYY-MM-DD)',
      },
      branchId: {
        type: 'string',
        description: 'Filter by branch ID (UUID)',
      },
      userId: {
        type: 'string',
        description: 'Filter by specific user ID (UUID)',
      },
      status: {
        type: 'string',
        enum: ['ON_TIME', 'LATE', 'EARLY_LEAVE', 'ABSENT', 'ON_LEAVE'],
        description: 'Filter by attendance status',
      },
      limit: {
        type: 'number',
        description: 'Max records to return (default 50, max 200)',
      },
    },
    required: ['startDate', 'endDate'],
  },
};

const queryEmployees: Tool = {
  name: 'query_employees',
  description:
    'Query employee records. Returns user details including name, email, role, branch, and department.',
  input_schema: {
    type: 'object' as const,
    properties: {
      branchId: {
        type: 'string',
        description: 'Filter by branch ID',
      },
      departmentId: {
        type: 'string',
        description: 'Filter by department ID',
      },
      role: {
        type: 'string',
        enum: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
        description: 'Filter by role',
      },
      search: {
        type: 'string',
        description:
          'Search by name or email (partial match, case-insensitive)',
      },
      limit: {
        type: 'number',
        description: 'Max records to return (default 50, max 200)',
      },
    },
    required: [],
  },
};

const aggregateStats: Tool = {
  name: 'aggregate_stats',
  description:
    'Get aggregated attendance statistics. Returns computed metrics grouped by the specified dimension. Use this for summary reports and dashboards.',
  input_schema: {
    type: 'object' as const,
    properties: {
      metric: {
        type: 'string',
        enum: ['attendance_rate', 'late_count', 'avg_hours', 'overtime'],
        description: 'The metric to compute',
      },
      groupBy: {
        type: 'string',
        enum: ['branch', 'department', 'day', 'week', 'month'],
        description: 'How to group the results',
      },
      startDate: {
        type: 'string',
        description: 'Start date (YYYY-MM-DD)',
      },
      endDate: {
        type: 'string',
        description: 'End date (YYYY-MM-DD)',
      },
      branchId: {
        type: 'string',
        description: 'Optional branch filter',
      },
    },
    required: ['metric', 'groupBy', 'startDate', 'endDate'],
  },
};

const detectPatterns: Tool = {
  name: 'detect_patterns',
  description:
    'Analyze attendance data for patterns and anomalies. Returns detected patterns with confidence scores.',
  input_schema: {
    type: 'object' as const,
    properties: {
      userId: {
        type: 'string',
        description: 'Analyze patterns for a specific user',
      },
      branchId: {
        type: 'string',
        description: 'Analyze patterns for a specific branch',
      },
      dateRange: {
        type: 'string',
        description: 'Date range as "YYYY-MM-DD/YYYY-MM-DD"',
      },
      patternType: {
        type: 'string',
        enum: ['time', 'frequency', 'location', 'anomaly'],
        description:
          'Type of pattern to detect: time (check-in/out timing), frequency (absence patterns), location (geo anomalies), anomaly (fraud signals)',
      },
    },
    required: ['dateRange', 'patternType'],
  },
};

const getBranchInfo: Tool = {
  name: 'get_branch_info',
  description:
    'Get details about branches including address, work hours, wifi configs, and employee count.',
  input_schema: {
    type: 'object' as const,
    properties: {
      branchId: {
        type: 'string',
        description:
          'Specific branch ID. If omitted, returns all active branches.',
      },
    },
    required: [],
  },
};

const calculateOvertime: Tool = {
  name: 'calculate_overtime',
  description:
    'Calculate total overtime hours for a specific employee in a given month.',
  input_schema: {
    type: 'object' as const,
    properties: {
      userId: {
        type: 'string',
        description: 'The employee user ID',
      },
      month: {
        type: 'number',
        description: 'Month number (1-12)',
      },
      year: {
        type: 'number',
        description: 'Year (e.g. 2026)',
      },
    },
    required: ['userId', 'month', 'year'],
  },
};

const getLeaveBalance: Tool = {
  name: 'get_leave_balance',
  description:
    'Get leave records and balance for an employee, including approved, pending, and used leave days by type.',
  input_schema: {
    type: 'object' as const,
    properties: {
      userId: {
        type: 'string',
        description: 'The employee user ID',
      },
    },
    required: ['userId'],
  },
};

const sendNotification: Tool = {
  name: 'send_notification',
  description:
    'Send a notification to a specific user. Use this to alert users about important findings or actions needed.',
  input_schema: {
    type: 'object' as const,
    properties: {
      userId: {
        type: 'string',
        description: 'The target user ID',
      },
      title: {
        type: 'string',
        description: 'Notification title',
      },
      body: {
        type: 'string',
        description: 'Notification body text',
      },
      type: {
        type: 'string',
        description:
          'Notification type (e.g. "info", "warning", "alert", "anomaly")',
      },
    },
    required: ['userId', 'title', 'body', 'type'],
  },
};

/**
 * Returns the complete array of tool definitions for the Claude API.
 */
export function getToolDefinitions(): Tool[] {
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
