export interface RestResult<T> {
  code: number;
  success: boolean;
  msg?: string | null;
  data: T;
  traceId?: string | null;
  errors?: FieldError[] | null;
}

export interface FieldError {
  field: string;
  message: string;
}

export const apiCode = {
  success: 200,
  invalidArgument: 400,
  unauthenticated: 401,
  forbidden: 403,
  notFound: 404,
  deviceNotFound: 40001,
  deviceDependencyTimeout: 40014,
  deviceResultUnknown: 40015,
  simulationInvalidArgument: 80000,
  simulationIdempotencyConflict: 80002,
  simulationReportInProgress: 80019,
  simulationResourceNotFound: 80022,
  simulationSessionChanged: 80025,
  refreshInvalid: 130010,
  accountDisabled: 130011,
  notificationUnavailable: 130036,
  verificationInvalid: 130038,
  policyValidationStale: 160013,
  modelNotPublished: 190011,
  productModelNotPublished: 190042,
};
