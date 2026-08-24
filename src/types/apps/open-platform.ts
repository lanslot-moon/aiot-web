export interface RestResult<T> {
  code: string;
  message: string;
  data: T;
}
export const REST_SUCCESS_CODE = "200";

export interface CursorResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}

export interface AccountView {
  accountId: string;
  username: string;
  email: string | null;
  phone: string | null;
  status: string;
  securityVersion: number;
  createTime: number;
  updateTime: number;
}

export interface RegisterRequest {
  username: string;
  email?: string;
  phone?: string;
  password: string;
}

export interface RegisterResult {
  registered: boolean;
  accountId: string;
  status: string;
}

export interface LoginRequest {
  identifier: string;
  password: string;
  clientType: "CONSOLE";
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken?: string;
}

export interface ProjectView {
  projectId: string;
  projectName: string;
  description: string | null;
  status: string;
  myRole: string;
  createTime: number;
  updateTime: number;
}

export interface ProjectSummaryView {
  projectId: string;
  resourceCounts: {
    products: number;
    devices: number;
    rules: number;
    groups: number;
  };
  memberCount: number;
  productCount: number;
  deviceCount: number;
  lastActivityAt: number | null;
}

export interface CreateProjectRequest {
  projectName: string;
  description?: string;
}

export interface CreateProjectResult {
  project: ProjectView;
  ownerMember: ProjectMemberView;
  keyPair: ProjectKeyPairView;
}

export interface UpdateProjectRequest {
  projectName?: string;
  description?: string;
}

export interface ProductCreateRequest {
  productName: string;
  /** CUSTOM products intentionally omit categoryCode and start with an empty model draft. */
  categoryType?: 'STANDARD' | 'CUSTOM';
  categoryCode?: string;
  productModel?: string;
  nodeType: string;
  transport: string;
  authModes: string[];
  customAuthProviderId?: string | null;
  dataMode: string;
  bootstrapMode: string;
  protocolProfile?: ProtocolProfileRefView | null;
  topicTemplates?: Record<string, string>;
}

/** Product metadata and connection contract update for DRAFT products. */
export interface ProductUpdateRequest {
  version: string;
  productName?: string;
  productModel?: string;
  description?: string;
  manufacturer?: string;
  iconUrl?: string;
  nodeType?: string;
  transport?: string;
  authModes?: string[];
  customAuthProviderId?: string | null;
  dataMode?: string;
  bootstrapMode?: string;
  protocolProfile?: ProtocolProfileRefView | null;
  topicTemplates?: Record<string, string>;
}

export interface CategoryBriefView {
  categoryCode: string;
  names: Record<string, string>;
}

export interface CategoryTemplateProperty {
  code: string;
  title: string;
  access: string;
  schema: unknown;
  required: boolean;
}

export interface CategoryTemplateAction {
  code: string;
  title: string;
  inputSchema: unknown;
  outputSchema: unknown;
  invokeMode: string;
}

export interface CategoryTemplateEvent {
  code: string;
  title: string;
  outputSchema: unknown;
  eventType: string;
}

export interface CategoryTemplateView {
  properties: CategoryTemplateProperty[];
  actions: CategoryTemplateAction[];
  events: CategoryTemplateEvent[];
}

export interface CategoryVersionView {
  categoryCode: string;
  categoryVersion: string;
  versionStatus: string;
  template: CategoryTemplateView;
  versionDigest: string;
  publishedAt: number | null;
  createdAt: number | null;
}

export interface CategoryView {
  categoryCode: string;
  parentCode: string | null;
  level: number;
  names: Record<string, string>;
  status: string;
  leaf: boolean;
  parentPath: CategoryBriefView[];
  sort: number;
}

export interface ProjectMemberView {
  projectId: string;
  accountId: string;
  username: string;
  email: string | null;
  role: string;
  membershipStatus: string;
  joinedAt: number;
  createTime: number;
  updateTime: number;
}

export interface InvitationView {
  invitationId: string;
  projectId: string;
  inviteeEmail: string | null;
  inviteeAccountId: string | null;
  role: string;
  status: string;
  expiresAt: number;
  invitedBy: string;
  acceptedAt: number | null;
  createTime: number;
}

export interface AcceptInvitationRequest {
  token: string;
}

export interface AuthorizationMetadataView {
  projectId: string;
  status: string;
  ipAllowlist: string[];
  networkPolicyEnabled: boolean;
  createTime: number;
  lastRotatedAt: number | null;
  lastUsedAt: number | null;
}

export interface ProjectKeyPairView {
  projectId: string;
  clientId: string;
  clientSecret: string;
}

/**
 * Product row for Project-scoped product list (thing-model).
 * `categoryCode` remains the stable identity; `categoryName` is the UI label
 * that backend should return (see list-display-labels CR).
 */
export interface ProductListItem {
  productId: string;
  productName: string;
  productModel: string | null;
  categoryCode: string;
  /** zh-CN (or current locale) display name — backend to add */
  categoryName: string;
  /** optional multilingual map — backend optional */
  categoryNames?: Record<string, string>;
  /** 自定义品类产品不继承平台品类能力；旧数据可能没有该字段。 */
  categoryType?: 'STANDARD' | 'CUSTOM';
  lifecycleStatus: string;
  createdAt: number;
  updatedAt: number;
}

/** Product detail contract aligned with the thing-model ProductVO. */
export interface ProductDetailView extends ProductListItem {
  projectId: string;
  description: string | null;
  manufacturer: string | null;
  iconUrl?: string | null;
  categoryCatalogVersion: string | null;
  nodeType: string | null;
  transport: string | null;
  authModes: string[];
  customAuthProviderId: string | null;
  dataMode: string | null;
  bootstrapMode: string | null;
  protocolProfile: ProtocolProfileRefView | null;
  topicTemplates: Record<string, string>;
  version: number;
}

export interface ProtocolProfileRefView {
  profileId: string;
  profileVersion: string;
}

/** Non-sensitive credential summary returned by the credential service. */
export type CredentialKind = 'PRODUCT_SECRET' | 'DEVICE_SECRET';
export type CredentialStatus = 'ACTIVE' | 'EXPIRED' | 'RETIRING' | 'REVOKED';
export type CredentialAccessState = 'ENABLED' | 'FROZEN';

export interface CredentialSummaryView {
  credentialId: string;
  credentialFamilyId: string;
  versionNo: number;
  productId: string;
  hardwareUuid: string | null;
  deviceId: string | null;
  kind: CredentialKind;
  credentialStatus: CredentialStatus;
  accessState: CredentialAccessState;
  fingerprint: string;
  validFrom: number;
  expiresAt: number | null;
  graceUntil: number | null;
  createTime: number;
  updateTime: number;
  securityVersion: number;
}

export type ManufacturingBatchStatus =
  | 'ISSUING'
  | 'AVAILABLE'
  | 'PARTIALLY_AVAILABLE'
  | 'EXPIRED';

export interface CredentialManufacturingBatchView {
  grantId: string;
  batchId: string;
  productId: string;
  status: ManufacturingBatchStatus;
  targetQuantity: number;
  availableCount: number;
  boundCount: number;
  revokedCount: number;
  expiredCount: number;
  voidCount: number;
  expiresAt: number | null;
  allocatedQuantity: number;
  createTime: number;
  updateTime: number;
}

export type ManufacturingItemStatus = 'AVAILABLE' | 'BOUND' | 'EXPIRED' | 'REVOKED' | 'VOID';

export interface CredentialManufacturingItemView {
  itemId: string;
  batchId: string;
  productId: string;
  hardwareUuid: string;
  credentialFamilyId: string;
  credentialId: string;
  credentialVersion: number;
  boundDeviceId: string | null;
  status: ManufacturingItemStatus;
  expiresAt: number | null;
  distributionId: string | null;
  allocatedAt: number | null;
  boundAt: number | null;
  version: number;
  createTime: number;
  updateTime: number;
}

export type CredentialDistributionStatus = 'CREATING' | 'FROZEN' | 'CANCELLED' | 'EXPIRED';

export interface CredentialDistributionView {
  distributionId: string;
  productId: string;
  batchId: string;
  requestReference: string;
  requestedQuantity: number;
  allocatedQuantity: number;
  allocationHash: string;
  status: CredentialDistributionStatus;
  frozenAt: number | null;
  expiresAt: number | null;
  version: number;
  createTime: number;
  updateTime: number;
}

export type CredentialExportFormat = 'JSON' | 'EXCEL';
export type CredentialExportStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'PARTIALLY_SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface CredentialExportTaskView {
  exportId: string;
  batchId: string;
  distributionId: string;
  productId: string;
  format: CredentialExportFormat;
  status: CredentialExportStatus;
  expectedCount: number;
  successCount: number;
  failureCode: string | null;
  version: number;
  createTime: number;
  updateTime: number;
}

export interface CredentialSecretDeliveryView {
  credential: CredentialSummaryView;
  secret: string;
  deliveryId: string;
  deliveryExpiresAt: number;
  remainingDeliveries: number;
}

export type PreRegistrationStatus = 'PENDING' | 'BOUND' | 'EXPIRED' | 'REMOVED';

export interface CredentialPreRegistrationView {
  preRegistrationId: string;
  productId: string;
  hardwareUuid: string;
  status: PreRegistrationStatus;
  registrationGeneration: number;
  note: string | null;
  expiresAt: number;
  consumedAt: number | null;
  boundDeviceId: string | null;
  issuedCredentialFamilyId: string | null;
  importBatchId: string;
  version: number;
  createTime: number;
  updateTime: number;
}

export type CredentialRotationStatus =
  | 'REQUESTED'
  | 'NEW_CREDENTIAL_ISSUED'
  | 'WAITING_DEVICE_CLAIM'
  | 'WAITING_DEVICE_SWITCH'
  | 'GRACE_PERIOD'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';

export interface CredentialRotationTaskView {
  taskId: string;
  productId: string;
  hardwareUuid: string | null;
  deviceId: string | null;
  credentialFamilyId: string;
  currentCredentialId: string;
  currentCredentialVersion: number;
  replacementCredentialId: string | null;
  replacementCredentialVersion: number | null;
  status: CredentialRotationStatus;
  gracePeriodSeconds: number;
  graceUntil: number | null;
  switchDeadline: number;
  newExpiresAt: number | null;
  enforcementMode: 'NORMAL' | 'SECURITY_ENFORCED';
  forceRevokeAt: number | null;
  failureReason: string | null;
  reasonCode: string;
  version: number;
  createTime: number;
  updateTime: number;
}

/** Tenant-scoped protocol payload parser profile metadata. */
export interface ParserProfileView {
  profileId: string;
  tenantId: string;
  profileName: string;
  protocolCode: string;
  currentVersion: string | null;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export type ParserProfileVersionStatus = 'DRAFT' | 'PUBLISHED' | 'DEPRECATED' | string;
export type ParserProfileMappingType =
  | 'BOOLEAN'
  | 'INTEGER'
  | 'NUMBER'
  | 'STRING'
  | 'BINARY'
  | 'OBJECT'
  | 'ARRAY';
export type ParserProfileDirection = 'UPLINK' | 'DOWNLINK' | 'BIDIRECTIONAL';

export interface ParserProfileConversion {
  scale?: number | null;
  offset?: number | null;
}

export interface ParserProfileMappingRule {
  code: string;
  type?: ParserProfileMappingType;
  sourcePath?: string | null;
  direction?: ParserProfileDirection | null;
  conversion?: ParserProfileConversion | null;
}

export interface ParserProfileMapping {
  mappings: Record<string, ParserProfileMappingRule>;
  codec?: Record<string, unknown> | null;
}

export interface ParserProfileVersionView {
  profileId: string;
  profileVersion: string;
  versionStatus: ParserProfileVersionStatus;
  mapping: ParserProfileMapping;
  versionDigest: string;
  publishedAt: number | null;
  createdAt?: number | null;
  updatedAt?: number | null;
}

export interface ParserProfileDiffItemView {
  source: string;
  code: string;
  kind: 'ADDED' | 'REMOVED' | 'MODIFIED' | string;
  changedField?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}

export interface ParserProfileDiffView {
  added: ParserProfileDiffItemView[];
  removed: ParserProfileDiffItemView[];
  modified: ParserProfileDiffItemView[];
}

export interface ParserProfileValidationView {
  valid: boolean;
  details?: Array<{
    instanceLocation?: string;
    message: string;
    keyword?: string;
  }>;
}

export interface ParserProfileTestIssueView {
  code: string;
  message: string;
}

export interface ParserProfileTestView {
  success: boolean;
  mapped: Record<string, unknown>;
  issues: ParserProfileTestIssueView[];
  unparsedFields: string[];
  failureSampleId?: string | null;
}

export interface ThingModelProperty {
  code: string;
  title: string;
  access: string;
  schema: unknown;
  required: boolean;
}

export interface ThingModelAction {
  code: string;
  title: string;
  inputSchema: unknown;
  outputSchema: unknown;
  invokeMode: string;
}

export interface ThingModelEvent {
  code: string;
  title: string;
  outputSchema: unknown;
  eventType: string;
}

/** Published or draft definition aligned with ThingModelDefinitionVO. */
export interface ThingModelDefinition {
  productId: string;
  modelRevision: number;
  modelDigest: string;
  status: string;
  properties: ThingModelProperty[];
  actions: ThingModelAction[];
  events: ThingModelEvent[];
}

export interface ModelDraftView {
  definition: ThingModelDefinition;
  status: 'DRAFT' | 'VALIDATED' | string;
  version: number | null;
}

export interface ModelVersionView {
  modelRevision: number;
  modelDigest: string;
  status: 'PUBLISHED' | 'DEPRECATED' | string;
  /** 发布时间（毫秒时间戳），历史版本保留原发布时间。 */
  publishedAt?: number | null;
}

export interface ModelCapabilitySummaryView {
  type: 'PROPERTY' | 'ACTION' | 'EVENT' | string;
  code: string;
  title: string;
  required: boolean;
}

export interface ModelDiffView {
  added: ModelCapabilitySummaryView[];
  removed: ModelCapabilitySummaryView[];
  modified: ModelCapabilitySummaryView[];
}

export interface SchemaValidationView {
  valid: boolean;
  evaluationPath?: string;
  schemaLocation?: string;
  instanceLocation?: string;
  errors?: unknown;
  annotations?: unknown;
  droppedAnnotations?: unknown;
  details?: SchemaValidationView[];
}

export interface CategoryMergeView {
  diffItems: ModelCapabilitySummaryView[];
  mergedDefinition?: ThingModelDefinition | null;
  status?: string;
  version?: number | null;
}
