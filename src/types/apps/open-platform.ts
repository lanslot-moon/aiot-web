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
