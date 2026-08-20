import { http, HttpResponse } from 'msw';
import {
  REST_SUCCESS_CODE,
  type AccountView,
  type AuthorizationMetadataView,
  type CreateProjectRequest,
  type CreateProjectResult,
  type CursorResult,
  type InvitationView,
  type LoginRequest,
  type LogoutRequest,
  type ProjectKeyPairView,
  type ProjectMemberView,
  type ProjectView,
  type RefreshRequest,
  type RegisterRequest,
  type RegisterResult,
  type RestResult,
  type TokenResponse,
  type UpdateProjectRequest,
} from 'src/types/apps/open-platform';

type AccountRecord = AccountView & { password: string };

const now = Date.UTC(2026, 7, 1, 8, 0, 0);

function ok<T>(data: T): RestResult<T> {
  return { code: REST_SUCCESS_CODE, message: 'Success', data };
}

function fail(code: string, message: string, status = 400) {
  return HttpResponse.json(
    { code, message, data: null } satisfies RestResult<null>,
    { status },
  );
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function issueTokens(accountId: string): TokenResponse {
  const accessToken = `access_${accountId}_${Date.now()}`;
  const refreshToken = `refresh_${accountId}_${Date.now()}`;
  refreshTokens.set(refreshToken, accountId);
  sessions.set(accessToken, accountId);
  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: 3600,
  };
}

function toAccountView(account: AccountRecord): AccountView {
  return {
    accountId: account.accountId,
    username: account.username,
    email: account.email,
    phone: account.phone,
    status: account.status,
    securityVersion: account.securityVersion,
    createTime: account.createTime,
    updateTime: account.updateTime,
  };
}

function resolveBearerAccountId(request: Request): string | null {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return sessions.get(token) ?? null;
}

function projectViewFor(accountId: string, project: ProjectView): ProjectView {
  const membership = members.find(
    (m) =>
      m.projectId === project.projectId &&
      m.accountId === accountId &&
      m.membershipStatus !== 'REMOVED',
  );
  return {
    ...project,
    myRole: membership?.role ?? project.myRole,
  };
}

const seedAccount: AccountRecord = {
  accountId: 'acc_demo_owner',
  username: 'demo',
  email: 'demo@example.com',
  phone: null,
  status: 'ACTIVE',
  securityVersion: 1,
  createTime: now,
  updateTime: now,
  password: 'Password123!',
};

const seedProjects: ProjectView[] = [
  {
    projectId: 'proj_smart_home',
    projectName: 'Smart Home Hub',
    description: 'Demo ACTIVE project owned by demo',
    status: 'ACTIVE',
    myRole: 'OWNER',
    createTime: now,
    updateTime: now,
  },
  {
    projectId: 'proj_factory_line',
    projectName: 'Factory Line Monitor',
    description: 'Suspended project; demo is ADMIN',
    status: 'SUSPENDED',
    myRole: 'ADMIN',
    createTime: now - 86_400_000,
    updateTime: now - 3_600_000,
  },
  {
    projectId: 'proj_legacy_gate',
    projectName: 'Legacy Gate Archive',
    description: 'Archived project; demo is VIEWER',
    status: 'ARCHIVED',
    myRole: 'VIEWER',
    createTime: now - 172_800_000,
    updateTime: now - 86_400_000,
  },
];

const seedMembers: ProjectMemberView[] = [
  {
    projectId: 'proj_smart_home',
    accountId: 'acc_demo_owner',
    username: 'demo',
    email: 'demo@example.com',
    role: 'OWNER',
    membershipStatus: 'ACTIVE',
    joinedAt: now,
    createTime: now,
    updateTime: now,
  },
  {
    projectId: 'proj_factory_line',
    accountId: 'acc_demo_owner',
    username: 'demo',
    email: 'demo@example.com',
    role: 'ADMIN',
    membershipStatus: 'ACTIVE',
    joinedAt: now - 86_400_000,
    createTime: now - 86_400_000,
    updateTime: now - 86_400_000,
  },
  {
    projectId: 'proj_factory_line',
    accountId: 'acc_other_owner',
    username: 'alice',
    email: 'alice@example.com',
    role: 'OWNER',
    membershipStatus: 'ACTIVE',
    joinedAt: now - 86_400_000,
    createTime: now - 86_400_000,
    updateTime: now - 86_400_000,
  },
  {
    projectId: 'proj_legacy_gate',
    accountId: 'acc_demo_owner',
    username: 'demo',
    email: 'demo@example.com',
    role: 'VIEWER',
    membershipStatus: 'ACTIVE',
    joinedAt: now - 172_800_000,
    createTime: now - 172_800_000,
    updateTime: now - 172_800_000,
  },
];

const seedInvitations: InvitationView[] = [
  {
    invitationId: 'inv_pending_dev',
    projectId: 'proj_smart_home',
    inviteeEmail: 'invitee@example.com',
    inviteeAccountId: null,
    role: 'DEVELOPER',
    status: 'PENDING',
    expiresAt: now + 7 * 86_400_000,
    invitedBy: 'acc_demo_owner',
    acceptedAt: null,
    createTime: now,
  },
];

const seedAuthz: AuthorizationMetadataView[] = [
  {
    projectId: 'proj_smart_home',
    status: 'ACTIVE',
    ipAllowlist: [],
    networkPolicyEnabled: false,
    createTime: now,
    lastRotatedAt: null,
    lastUsedAt: null,
  },
  {
    projectId: 'proj_factory_line',
    status: 'DISABLED',
    ipAllowlist: ['10.0.0.0/8'],
    networkPolicyEnabled: true,
    createTime: now - 86_400_000,
    lastRotatedAt: now - 43_200_000,
    lastUsedAt: now - 3_600_000,
  },
  {
    projectId: 'proj_legacy_gate',
    status: 'REVOKED',
    ipAllowlist: [],
    networkPolicyEnabled: false,
    createTime: now - 172_800_000,
    lastRotatedAt: now - 100_000_000,
    lastUsedAt: now - 90_000_000,
  },
];

const seedKeyPairs: ProjectKeyPairView[] = [
  {
    projectId: 'proj_smart_home',
    clientId: 'cli_smart_home_001',
    clientSecret: 'sec_smart_home_demo_secret',
  },
  {
    projectId: 'proj_factory_line',
    clientId: 'cli_factory_line_001',
    clientSecret: 'sec_factory_line_demo_secret',
  },
  {
    projectId: 'proj_legacy_gate',
    clientId: 'cli_legacy_gate_001',
    clientSecret: 'sec_legacy_gate_demo_secret',
  },
];

let accounts: AccountRecord[] = [seedAccount];
let projects: ProjectView[] = [...seedProjects];
let members: ProjectMemberView[] = [...seedMembers];
let invitations: InvitationView[] = [...seedInvitations];
let authorizations: AuthorizationMetadataView[] = [...seedAuthz];
let keyPairs: ProjectKeyPairView[] = [...seedKeyPairs];

/** accessToken → accountId */
const sessions = new Map<string, string>();
/** refreshToken → accountId */
const refreshTokens = new Map<string, string>();

function findAccountByIdentifier(identifier: string): AccountRecord | undefined {
  const value = identifier.trim().toLowerCase();
  return accounts.find(
    (a) =>
      a.username.toLowerCase() === value ||
      a.email?.toLowerCase() === value ||
      a.phone === identifier.trim(),
  );
}

function setProjectStatus(projectId: string, status: string): ProjectView | null {
  const idx = projects.findIndex((p) => p.projectId === projectId);
  if (idx < 0) return null;
  const updated: ProjectView = {
    ...projects[idx],
    status,
    updateTime: Date.now(),
  };
  projects[idx] = updated;
  return updated;
}

export const OpenPlatformHandlers = [
  http.post('/api/v1/auth/register', async ({ request }) => {
    try {
      const body = (await request.json()) as RegisterRequest;
      if (!body?.username?.trim() || !body?.password) {
        return fail('400', 'username and password are required');
      }
      const exists = accounts.some(
        (a) => a.username.toLowerCase() === body.username.trim().toLowerCase(),
      );
      if (exists) {
        return fail('409', 'username already registered', 409);
      }
      const ts = Date.now();
      const account: AccountRecord = {
        accountId: newId('acc'),
        username: body.username.trim(),
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        status: 'ACTIVE',
        securityVersion: 1,
        createTime: ts,
        updateTime: ts,
        password: body.password,
      };
      accounts.push(account);
      const result: RegisterResult = {
        registered: true,
        accountId: account.accountId,
        status: account.status,
      };
      return HttpResponse.json(ok(result));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/auth/login', async ({ request }) => {
    try {
      const body = (await request.json()) as LoginRequest;
      if (!body?.identifier || !body?.password || body.clientType !== 'CONSOLE') {
        return fail('400', 'identifier, password, and clientType CONSOLE are required');
      }
      const account = findAccountByIdentifier(body.identifier);
      if (!account || account.password !== body.password) {
        return fail('401', 'Invalid credentials', 401);
      }
      if (account.status !== 'ACTIVE') {
        return fail('403', 'Account is not active', 403);
      }
      return HttpResponse.json(ok(issueTokens(account.accountId)));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/auth/token/refresh', async ({ request }) => {
    try {
      const body = (await request.json()) as RefreshRequest;
      if (!body?.refreshToken) {
        return fail('400', 'refreshToken is required');
      }
      const accountId = refreshTokens.get(body.refreshToken);
      if (!accountId) {
        return fail('401', 'Invalid refresh token', 401);
      }
      refreshTokens.delete(body.refreshToken);
      return HttpResponse.json(ok(issueTokens(accountId)));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/auth/logout', async ({ request }) => {
    try {
      let refreshToken: string | undefined;
      try {
        const body = (await request.json()) as LogoutRequest;
        refreshToken = body?.refreshToken;
      } catch {
        refreshToken = undefined;
      }
      if (refreshToken) {
        refreshTokens.delete(refreshToken);
      }
      const accountId = resolveBearerAccountId(request);
      if (accountId) {
        for (const [token, id] of sessions.entries()) {
          if (id === accountId) sessions.delete(token);
        }
      }
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.get('/api/v1/auth/me', ({ request }) => {
    try {
      const accountId = resolveBearerAccountId(request);
      // Mock convenience: if no Bearer, return the seed demo account.
      const account =
        accounts.find((a) => a.accountId === (accountId ?? seedAccount.accountId)) ??
        accounts[0];
      if (!account) {
        return fail('401', 'Unauthorized', 401);
      }
      return HttpResponse.json(ok(toAccountView(account)));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/projects', async ({ request }) => {
    try {
      const body = (await request.json()) as CreateProjectRequest;
      if (!body?.projectName?.trim()) {
        return fail('400', 'projectName is required');
      }
      const accountId = resolveBearerAccountId(request) ?? seedAccount.accountId;
      const account =
        accounts.find((a) => a.accountId === accountId) ?? seedAccount;
      const ts = Date.now();
      const projectId = newId('proj');
      const project: ProjectView = {
        projectId,
        projectName: body.projectName.trim(),
        description: body.description?.trim() || null,
        status: 'ACTIVE',
        myRole: 'OWNER',
        createTime: ts,
        updateTime: ts,
      };
      const ownerMember: ProjectMemberView = {
        projectId,
        accountId: account.accountId,
        username: account.username,
        email: account.email,
        role: 'OWNER',
        membershipStatus: 'ACTIVE',
        joinedAt: ts,
        createTime: ts,
        updateTime: ts,
      };
      const keyPair: ProjectKeyPairView = {
        projectId,
        clientId: newId('cli'),
        clientSecret: newId('sec'),
      };
      const authz: AuthorizationMetadataView = {
        projectId,
        status: 'ACTIVE',
        ipAllowlist: [],
        networkPolicyEnabled: false,
        createTime: ts,
        lastRotatedAt: null,
        lastUsedAt: null,
      };
      projects = [project, ...projects];
      members = [ownerMember, ...members];
      keyPairs = [keyPair, ...keyPairs];
      authorizations = [authz, ...authorizations];
      const result: CreateProjectResult = { project, ownerMember, keyPair };
      return HttpResponse.json(ok(result));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.get('/api/v1/projects', ({ request }) => {
    try {
      const url = new URL(request.url);
      const cursor = url.searchParams.get('cursor');
      const pageSizeRaw = url.searchParams.get('pageSize');
      const keyword = url.searchParams.get('keyword')?.trim().toLowerCase() ?? '';
      const status = url.searchParams.get('status')?.trim() ?? '';
      const pageSize = Math.min(Math.max(Number(pageSizeRaw) || 20, 1), 100);

      const accountId = resolveBearerAccountId(request) ?? seedAccount.accountId;
      const memberProjectIds = new Set(
        members
          .filter(
            (m) => m.accountId === accountId && m.membershipStatus !== 'REMOVED',
          )
          .map((m) => m.projectId),
      );

      let filtered = projects
        .filter((p) => memberProjectIds.has(p.projectId))
        .map((p) => projectViewFor(accountId, p));

      if (keyword) {
        filtered = filtered.filter(
          (p) =>
            p.projectName.toLowerCase().includes(keyword) ||
            p.projectId.toLowerCase().includes(keyword),
        );
      }
      if (status) {
        filtered = filtered.filter((p) => p.status === status);
      }

      const start = cursor ? Number(cursor) || 0 : 0;
      const slice = filtered.slice(start, start + pageSize);
      const nextIndex = start + slice.length;
      const hasMore = nextIndex < filtered.length;
      const data: CursorResult<ProjectView> = {
        items: slice,
        nextCursor: hasMore ? String(nextIndex) : null,
        hasMore,
      };
      return HttpResponse.json(ok(data));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.get('/api/v1/projects/:projectId', ({ params, request }) => {
    try {
      const projectId = String(params.projectId);
      const project = projects.find((p) => p.projectId === projectId);
      if (!project) {
        return fail('404', 'Project not found', 404);
      }
      const accountId = resolveBearerAccountId(request) ?? seedAccount.accountId;
      return HttpResponse.json(ok(projectViewFor(accountId, project)));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.put('/api/v1/projects/:projectId', async ({ params, request }) => {
    try {
      const projectId = String(params.projectId);
      const idx = projects.findIndex((p) => p.projectId === projectId);
      if (idx < 0) {
        return fail('404', 'Project not found', 404);
      }
      const body = (await request.json()) as UpdateProjectRequest;
      const current = projects[idx];
      const updated: ProjectView = {
        ...current,
        projectName:
          body.projectName !== undefined
            ? body.projectName.trim()
            : current.projectName,
        description:
          body.description !== undefined
            ? body.description?.trim() || null
            : current.description,
        updateTime: Date.now(),
      };
      projects[idx] = updated;
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/projects/:projectId/activate', ({ params }) => {
    try {
      const projectId = String(params.projectId);
      const project = projects.find((p) => p.projectId === projectId);
      if (!project) {
        return fail('404', 'Project not found', 404);
      }
      if (project.status === 'CLOSED') {
        return fail('409', 'Closed projects cannot be activated', 409);
      }
      setProjectStatus(projectId, 'ACTIVE');
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/projects/:projectId/suspend', ({ params }) => {
    try {
      const projectId = String(params.projectId);
      const project = projects.find((p) => p.projectId === projectId);
      if (!project) {
        return fail('404', 'Project not found', 404);
      }
      if (project.status !== 'ACTIVE') {
        return fail('409', 'Only ACTIVE projects can be suspended', 409);
      }
      setProjectStatus(projectId, 'SUSPENDED');
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/projects/:projectId/archive', ({ params }) => {
    try {
      const projectId = String(params.projectId);
      const project = projects.find((p) => p.projectId === projectId);
      if (!project) {
        return fail('404', 'Project not found', 404);
      }
      if (project.status === 'CLOSED' || project.status === 'ARCHIVED') {
        return fail('409', `Cannot archive project in status ${project.status}`, 409);
      }
      setProjectStatus(projectId, 'ARCHIVED');
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/projects/:projectId/close', ({ params }) => {
    try {
      const projectId = String(params.projectId);
      const project = projects.find((p) => p.projectId === projectId);
      if (!project) {
        return fail('404', 'Project not found', 404);
      }
      if (project.status === 'CLOSED') {
        return fail('409', 'Project already closed', 409);
      }
      setProjectStatus(projectId, 'CLOSED');
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),
];

/** Seed snapshots for later tasks (members / invitations / authz handlers). */
export const openPlatformSeed = {
  accounts: () => accounts.map(toAccountView),
  projects: () => projects,
  members: () => members,
  invitations: () => invitations,
  authorizations: () => authorizations,
  keyPairs: () => keyPairs,
};
