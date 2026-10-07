import type { AuthResultVO, TokenVO } from './contracts';

const SESSION_KEY = 'aiot:iam:session';
export const SESSION_EVENT = 'aiot:iam:session-changed';
// The console keeps tokens within this tab. Passwords and developer secrets are never persisted.
function readSession(): TokenVO | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null');
    if (
      value &&
      typeof value === 'object' &&
      'accessToken' in value &&
      typeof value.accessToken === 'string' &&
      'refreshToken' in value &&
      typeof value.refreshToken === 'string' &&
      'sessionId' in value &&
      typeof value.sessionId === 'string'
    )
      return value as TokenVO;
  } catch {
    /* A disabled storage area must not prevent signing in. */
  }
  return null;
}
let session = readSession();
let revision = 0;
let renewal: Promise<TokenVO> | null = null;
export function getSession() {
  return session;
}
export function setSession(value: TokenVO | null) {
  revision += 1;
  session = value;
  try {
    if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(SESSION_KEY);
    // Remove obsolete demo sessions so they cannot authenticate a real request.
    sessionStorage.removeItem('open-platform:accessToken');
    sessionStorage.removeItem('open-platform:refreshToken');
  } catch {
    /* The current tab still has its in-memory session. */
  }
  window.dispatchEvent(new Event(SESSION_EVENT));
}
export class OpenPlatformApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 0,
    public errors: { field: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'OpenPlatformApiError';
  }
}
const errorCopy: Record<string, string> = {
  UNAUTHENTICATED: '登录已失效，请重新登录。',
  FORBIDDEN: '当前账号没有执行此操作的权限。',
  NOTIFICATION_PROVIDER_UNAVAILABLE: '邮件或短信服务尚未配置，暂时无法发送验证码。',
  ROUTE_NOT_ENABLED: '网关尚未开放此接口，请检查路由配置。',
};
export async function parseResponse<T>(response: Response): Promise<T> {
  let payload: {
    code?: string;
    message?: string;
    data: T;
    errors?: { field: string; message: string }[];
  };
  try {
    payload = await response.json();
  } catch {
    throw new OpenPlatformApiError(
      'INVALID_RESPONSE',
      `接口响应格式异常（HTTP ${response.status}），请检查网关入口。`,
      response.status,
    );
  }
  if (!response.ok || payload.code !== '200') {
    const code = payload.code ?? String(response.status);
    throw new OpenPlatformApiError(
      code,
      errorCopy[code] ?? payload.message ?? `请求失败（HTTP ${response.status}）`,
      response.status,
      payload.errors ?? [],
    );
  }
  return payload.data;
}
// 同源标签页只同步同一个登录会话的轮换结果，令牌仍只保存在各自的 sessionStorage。
const sessionChannel = typeof BroadcastChannel === 'function'
  ? new BroadcastChannel('aiot:iam:session-renewal')
  : null;
import.meta.hot?.dispose(() => sessionChannel?.close());
sessionChannel?.addEventListener('message', (event: MessageEvent) => {
  const message = event.data;
  const current = session;
  if (!message || !current || message.sessionId !== current.sessionId) return;
  if (message.type === 'query') {
    sessionChannel.postMessage({ type: 'snapshot', sessionId: current.sessionId, token: current });
  } else if ((message.type === 'snapshot' || message.type === 'renewed') &&
    message.previousRefreshToken === current.refreshToken && message.token?.sessionId === current.sessionId) {
    setSession(message.token);
  }
});

export async function renewSession(): Promise<TokenVO> {
  if (renewal) return renewal;
  const previous = session;
  if (!previous?.refreshToken)
    throw new OpenPlatformApiError('UNAUTHENTICATED', errorCopy.UNAUTHENTICATED, 401);
  const refresh = async (): Promise<TokenVO> => {
    if (session?.sessionId !== previous.sessionId)
      throw new OpenPlatformApiError('SESSION_CHANGED', '登录状态已发生变化，请重试。');
    // 锁等待期间其他标签页可能已完成轮换；请求其当前令牌，避免消费旧的单次刷新令牌。
    if (sessionChannel && session.refreshToken === previous.refreshToken) {
      await new Promise<void>((resolve) => {
        const receive = (event: MessageEvent) => {
          const message = event.data;
          if (message?.type === 'snapshot' && message.sessionId === previous.sessionId &&
            message.token?.refreshToken && message.token.refreshToken !== previous.refreshToken &&
            session?.refreshToken === previous.refreshToken) {
            setSession(message.token);
          }
        };
        sessionChannel.addEventListener('message', receive);
        sessionChannel.postMessage({ type: 'query', sessionId: previous.sessionId });
        // 仅给本机标签页通信留一个收集窗口，不改变任何 HTTP 连接或响应预算。
        setTimeout(() => { sessionChannel.removeEventListener('message', receive); resolve(); }, 100);
      });
    }
    if (session?.sessionId !== previous.sessionId)
      throw new OpenPlatformApiError('SESSION_CHANGED', '登录状态已发生变化，请重试。');
    if (session.refreshToken !== previous.refreshToken) return session;
    const initialRevision = revision;
    try {
      const result = await request<AuthResultVO>(
        '/api/v1/authentication-session-renewals', 'POST',
        { refreshToken: previous.refreshToken }, { anonymous: true },
      );
      if (revision !== initialRevision)
        throw new OpenPlatformApiError('SESSION_CHANGED', '登录状态已发生变化，请重试。');
      setSession(result.token);
      sessionChannel?.postMessage({ type: 'renewed', sessionId: previous.sessionId,
        previousRefreshToken: previous.refreshToken, token: result.token });
      return result.token;
    } catch (error) {
      // 仅认证明确失效才退出；路由、限流和依赖故障保留会话供重试。
      if (revision === initialRevision && error instanceof OpenPlatformApiError &&
        ((error.status === 401 && ['REFRESH_INVALID', 'TOKEN_INVALID', 'UNAUTHENTICATED'].includes(error.code)) ||
          (error.status === 403 && error.code === 'ACCOUNT_DISABLED')))
        setSession(null);
      throw error;
    }
  };
  renewal = (async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.locks && sessionChannel)
        return await navigator.locks.request(`aiot:iam:renew:${previous.sessionId}`, refresh);
      return await refresh();
    } finally {
      renewal = null;
    }
  })();
  return renewal;
}
export async function request<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  options: { anonymous?: boolean; signal?: AbortSignal; projectId?: string } = {},
): Promise<T> {
  if (!path.startsWith('/api/v1/')) throw new Error('Only gateway API paths are accepted');
  // 项目协作与凭证接口同时传递路径项目和候选项目头，供网关与 IAM 核对。
  // 项目基本资料属于平台作用域，加入申请创建发生在入项前，不附带项目授权上下文。
  const projectPath = path.match(
    /^\/api\/v1\/projects\/([^/?]+)\/(current-authorization|available-roles|members|invitations|api-credentials|api-credential-rotations|api-credential-usage|api-network-policy|access-requests)(?:[/?]|$)/,
  );
  const pathProjectId = projectPath && !(method === 'POST' && projectPath[2] === 'access-requests')
    ? decodeURIComponent(projectPath[1])
    : undefined;
  if (options.projectId && pathProjectId && options.projectId !== pathProjectId)
    throw new OpenPlatformApiError('PARAM_INVALID', '路径项目与选择的项目不一致。');
  const projectId = options.projectId ?? pathProjectId;
  const send = () =>
    fetch(path, {
      method,
      signal: options.signal,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(projectId ? { 'X-Project-Id': projectId } : {}),
        ...(!options.anonymous && session?.accessToken
          ? { Authorization: `Bearer ${session.accessToken}` }
          : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  try {
    const initialToken = session?.accessToken;
    let response = await send();
    if (response.status === 401 && !options.anonymous && session?.refreshToken) {
      if (session.accessToken === initialToken) await renewSession();
      response = await send();
    }
    if (response.status === 401 && !options.anonymous) setSession(null);
    return await parseResponse<T>(response);
  } catch (error) {
    if (
      error instanceof OpenPlatformApiError ||
      (error instanceof DOMException && error.name === 'AbortError')
    )
      throw error;
    throw new OpenPlatformApiError('NETWORK_ERROR', '无法连接服务，请检查网络后重试。');
  }
}
export const get = <T>(path: string) => request<T>(path);
export const post = <T>(path: string, body?: unknown) => request<T>(path, 'POST', body);
export const put = <T>(path: string, body: unknown) => request<T>(path, 'PUT', body);
export const remove = <T>(path: string, body?: unknown) => request<T>(path, 'DELETE', body);
export const segment = (id: string) => encodeURIComponent(id);
