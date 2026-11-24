export const taskStatusLabels = {
  WAIT_CONFIRM: '待确认',
  WAIT_DISPATCH: '等待下发',
  NOTIFIED: '已通知',
  RUNNING: '执行中',
  RETRY_WAIT: '等待重试',
  SUCCEEDED: '成功',
  FAILED: '失败',
  TIMED_OUT: '超时',
  CANCELED: '已取消',
} as const;

export type TaskStatus = keyof typeof taskStatusLabels;

export const taskStatusGroups = {
  waiting: ['WAIT_CONFIRM', 'WAIT_DISPATCH', 'NOTIFIED'],
  failed: ['FAILED', 'TIMED_OUT'],
} as const satisfies Record<string, readonly TaskStatus[]>;
