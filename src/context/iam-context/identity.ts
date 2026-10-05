import { get, getSession, remove, SESSION_EVENT, setSession } from '@/api/iam/client';
import type { AccountVO, CurrentAuthorizationVO } from '@/api/iam/contracts';
import { getCurrentAuthorization } from '@/api/iam/authorization';
import { createContext, useContext, useSyncExternalStore } from 'react';
import useSWR from 'swr';

export function subscribe(listener: () => void) {
  window.addEventListener(SESSION_EVENT, listener);
  return () => window.removeEventListener(SESSION_EVENT, listener);
}

export function useIdentity() {
  const session = useSyncExternalStore(subscribe, getSession, () => null);
  const account = useSWR(
    session ? ['/api/v1/authenticated-account', session.sessionId] : null,
    ([path]) => get<AccountVO>(path),
    { shouldRetryOnError: false },
  );
  const authorization = useSWR<CurrentAuthorizationVO>(
    session ? ['/api/v1/current-authorization', session.sessionId] : null,
    () => getCurrentAuthorization(),
    { shouldRetryOnError: false },
  );
  return { session, account, authorization, platformAuthorization: authorization };
}

export const IdentityContext = createContext<ReturnType<typeof useIdentity> | null>(null);

export function useIam() {
  const context = useContext(IdentityContext);
  if (!context) throw new Error('IamProvider is required');
  return context;
}

export function permissionAuthorization(identity: ReturnType<typeof useIdentity>, permission?: string) {
  const resource = permission?.split(':')[0];
  const platform = ['account', 'session', 'file', 'project', 'platform-member', 'platform-role', 'platform-setting', 'developer-credential', 'audit', 'menu'];
  return resource && platform.includes(resource) ? identity.platformAuthorization : identity.authorization;
}

export function usePermission(permission?: string) {
  const identity = useIam();
  const authorization = permissionAuthorization(identity, permission);
  return !permission || !!authorization.data?.permissionCodes.includes(permission);
}

export async function logout() {
  const session = getSession();
  await remove('/api/v1/authentication-sessions/current', {
    refreshToken: session?.refreshToken,
    sessionId: session?.sessionId,
  });
  setSession(null);
}
