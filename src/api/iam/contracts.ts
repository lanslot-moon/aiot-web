// Formal IAM REST contracts. Source: aiot-cloud/aiot-iam/aiot-iam-api.

export interface CursorResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface AccountVO {
  accountId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  securityVersion: number | null;
  createTime: number;
  updateTime: number;
}

export interface AuthResultVO {
  token: TokenVO;
}

export interface AuthorizationInitializedVO {
  keyPair: AuthorizationKeyPairVO;
  authorization: AuthorizationMetadataVO;
}

export interface AuthorizationKeyPairVO {
  projectId: string;
  clientId: string | null;
  clientSecret: string | null;
}

export interface AuthorizationLastUsedVO {
  projectId: string;
  lastUsedAt: number | null;
  sourceIp: string | null;
  userAgent: string | null;
  requestCount: number | null;
}

export interface AuthorizationMetadataVO {
  projectId: string;
  clientId: string | null;
  status: string;
  ipAllowlist: string[];
  networkPolicyEnabled: boolean | null;
  createTime: number;
  lastRotatedAt: number | null;
  lastUsedAt: number | null;
}

export interface CurrentAuthorizationVO {
  projectId: string | null;
  roles: RoleVO[];
  permissionCodes: string[];
  menus: MenuItemVO[];
}

export interface FileDownloadVO {
  fileId: string;
  downloadUrl: string | null;
  expireTime: number | null;
}

export interface FileUploadVO {
  fileId: string;
  uploadUrl: string | null;
  downloadUrl: string | null;
  contentType?: string | null;
  'Content-Type'?: string | null;
  expireTime: number | null;
}

export interface FileVO {
  fileId: string;
  fileName: string | null;
  filePath: string | null;
  status: string;
  expiresTime: number | null;
  fileSize: number | null;
  etag: string | null;
  uploadedTime: number | null;
}

export interface MenuItemVO {
  menuId: string;
  parentMenuId: string | null;
  menuCode: string;
  menuName: string;
  menuType: string | null;
  route: string | null;
  icon: string | null;
  permissionCode: string | null;
  sortOrder: number | null;
  children: MenuItemVO[];
}

export interface MenuVO {
  menuId: string;
  parentMenuId: string | null;
  menuCode: string;
  menuName: string;
  menuType: string | null;
  route: string | null;
  icon: string | null;
  permissionCode: string | null;
  sortOrder: number | null;
  status: string;
  path: string | null;
  level: number | null;
  createTime: number;
  updateTime: number;
}

export interface PasswordResetConfirmVO {
  reset: boolean | null;
  accountId: string;
  securityVersion: number | null;
  revokedSessionCount: number | null;
}

export interface PasswordResetResultVO {
  resetId: string;
  token: string;
  deliveryMethod: string | null;
  maskedTarget: string | null;
  expiresAt: number | null;
  resendAfterSeconds: number | null;
}

export interface PermissionDescriptorVO {
  permissionCode: string;
  permissionName: string | null;
  resourceTypeCode: string;
  action: string;
  sortOrder: number;
  description: string | null;
}

export interface ProjectAccessRequestVO {
  requestId: string;
  projectId: string;
  applicantAccountId: string | null;
  message: string | null;
  requestedRoleId: string | null;
  approvedRoleId: string | null;
  status: string;
  reviewedBy: string | null;
  reviewReason: string | null;
  reviewedAt: number | null;
  createTime: number;
  updateTime: number;
}

export interface ProjectCreateVO {
  project: ProjectVO;
  ownerMember: ProjectMemberVO;
}

export interface ProjectDetailVO {
  project: ProjectVO;
  myMember: ProjectMemberVO;
}

export interface ProjectInvitationVO {
  invitationId: string;
  projectId: string;
  inviteeEmail: string | null;
  inviteeAccountId: string | null;
  roleId: string;
  status: string;
  expiresAt: number | null;
  invitedBy: string | null;
  acceptedAt: number | null;
  createTime: number;
  invitationToken: string | null;
}

export interface ProjectMemberVO {
  roles: RoleVO[];
  projectId: string;
  accountId: string;
  membershipStatus: string | null;
  username: string;
  email: string | null;
  joinedAt: number | null;
  createTime: number;
  updateTime: number;
}

export interface ProjectVO {
  projectId: string;
  projectName: string;
  description: string | null;
  status: string;
  createTime: number;
  updateTime: number;
}

export interface RoleBindingVO {
  id: string;
  projectId: string;
  ownerAccountId: string;
  subjectId: string;
  roleId: string;
  status: string;
  grantedBy: string | null;
  createTime: number;
  updateTime: number;
}

export interface RoleVO {
  roleId: string;
  ownerAccountId: string;
  roleCode: string;
  roleName: string;
  description: string | null;
  builtIn: boolean | null;
  status: string;
  revision: number | null;
  permissionCodes: string[] | null;
  createTime: number;
  updateTime: number;
}

export interface SessionRevokeAllVO {
  revokedCount: number | null;
  exceptSessionId: string | null;
}

export interface SessionRevokeVO {
  revoked: boolean | null;
  session: SessionVO;
}

export interface SessionVO {
  sessionId: string;
  accountId: string;
  status: string;
  clientType: string | null;
  loginMethod: string | null;
  lastSeenAt: number | null;
  expiresAt: number | null;
  createTime: number;
}

export interface TokenVO {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number | null;
  sessionId: string;
}

export interface VerificationChallengeVO {
  verificationId: string | null;
  channel: string | null;
  target: string | null;
  purpose: string | null;
  expiresAt: number | null;
  resendAfterSeconds: number | null;
}

export interface AuthorizationNetworkPolicyRequest {
  enabled?: boolean;
  ipAllowlist?: string[];
}

export interface AuthorizationOperationRequest {
  reason?: string;
  confirm?: boolean;
}

export interface AuthorizationStatusRequest {
  enabled?: boolean;
  reason?: string;
}

export interface FileUploadRequest {
  name?: string;
  path?: string;
}

export interface InvitationCreateRequest {
  inviteeEmail?: string;
  inviteeAccountId?: string;
  roleId?: string;
  ttlMillis?: number;
}

export interface InvitationListRequest {
  status?: string;
  email?: string;
  cursor?: string;
}

export interface InvitationRevokeRequest {
  reason?: string;
}

export interface InvitationStatusRequest {
  status?: string;
  invitationToken?: string;
}

export interface LoginRequest {
  identifierType?: string;
  identifier?: string;
  password?: string;
  clientType?: string;
}

export interface LogoutRequest {
  refreshToken?: string;
  sessionId?: string;
}

export interface MemberListRequest {
  status?: string;
  cursor?: string;
}

export interface MemberRemoveRequest {
  reason?: string;
}

export interface MenuCreateRequest {
  parentMenuId?: string;
  menuCode?: string;
  menuName?: string;
  menuType?: string;
  route?: string;
  icon?: string;
  permissionCode?: string;
  sortOrder?: number;
  status?: string;
}

export interface MenuUpdateRequest {
  parentMenuId?: string;
  menuName?: string;
  menuType?: string;
  route?: string;
  icon?: string;
  permissionCode?: string;
  sortOrder?: number;
  status?: string;
}

export interface OwnershipTransferRequest {
  targetAccountId?: string;
  confirm?: boolean;
}

export interface PasswordChangeRequest {
  currentPassword?: string;
  newPassword?: string;
}

export interface PasswordResetConfirmRequest {
  identifier?: string;
  token?: string;
  verificationCode?: string;
  newPassword?: string;
}

export interface PasswordResetRequest {
  identifierType?: string;
  identifier?: string;
  deliveryMethod?: string;
}

export interface ProfileUpdateRequest {
  email?: string;
  phone?: string;
}

export interface ProjectAccessRequestCreateRequest {
  message?: string;
  requestedRoleId?: string;
}

export interface ProjectAccessRequestListRequest {
  status?: string;
  cursor?: string;
}

export interface ProjectAccessRequestReviewRequest {
  status?: string;
  approvedRoleId?: string;
  reason?: string;
}

export interface ProjectCreateRequest {
  projectName?: string;
  description?: string;
}

export interface ProjectListRequest {
  keyword?: string;
  status?: string;
  cursor?: string;
}

export interface ProjectStatusRequest {
  status?: string;
  reason?: string;
  confirm?: boolean;
}

export interface ProjectUpdateRequest {
  projectName?: string;
  description?: string;
}

export interface RefreshTokenRequest {
  refreshToken?: string;
}

export interface RegisterRequest {
  username?: string;
  email?: string;
  phone?: string;
  password?: string;
}

export interface RoleCreateRequest {
  roleCode: string;
  roleName: string;
  description?: string;
  permissionCodes: string[];
}

export interface RoleBindingCreateRequest {
  projectId: string;
  subjectId: string;
  roleId: string;
}

export interface RoleBindingListRequest {
  projectId: string;
  status?: string;
  cursor?: string;
  pageSize?: number;
}

export interface RoleListRequest {
  status?: string;
  cursor?: string;
  pageSize?: number;
}

export interface PermissionCheckRequest {
  permissionCode: string;
  tenantId?: string;
}

export interface RolePermissionReplaceRequest {
  permissionCodes?: string[];
}

export interface RoleUpdateRequest {
  roleName?: string;
  description?: string;
  status?: string;
}

export interface SessionListRequest {
  status?: string;
  cursor?: string;
}

export interface SessionRevokeAllRequest {
  exceptSessionId?: string;
  reason?: string;
}

export interface SessionRevokeRequest {
  reason?: string;
}

export interface VerificationChallengeConfirmRequest {
  target?: string;
  code?: string;
}

export interface VerificationChallengeCreateRequest {
  channel?: string;
  target?: string;
  purpose?: string;
}

export interface PermissionModuleVO {
  module: string;
  resources: { code: string; name: string; actions: PermissionDescriptorVO[] }[];
}
