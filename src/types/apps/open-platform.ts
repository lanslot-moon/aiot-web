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
  categoryCode: string;
  productModel?: string;
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
