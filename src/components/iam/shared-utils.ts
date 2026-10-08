import { get, OpenPlatformApiError } from '@/api/iam/client';
import useSWR from 'swr';
import { permissionAuthorization, useIam } from '../../context/iam-context/identity';


export type Field = {
  name: string;
  label: string;
  type?: 'password' | 'email' | 'number' | 'textarea';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  options?: { value: string; label: string }[];
  hint?: string;
  autoComplete?: string;
  validate?: (value: string, values: Record<string, string>) => string | undefined;
};

export function useResource<T>(
  path: string | null,
  permission?: string,
  fetcher: (path: string) => Promise<T> = get<T>,
  scope = 'resource',
) {
  const identity = useIam();
  const { session } = identity;
  const authorization = permissionAuthorization(identity, permission);
  const allowed = !permission || authorization.data?.permissionCodes.includes(permission);
  const resource = useSWR<T>(
    session && allowed && path ? [path, session.sessionId, scope] : null,
    ([url]) => fetcher(url),
    { shouldRetryOnError: false },
  );
  if (permission && authorization.data && !allowed)
    return {
      ...resource,
      error: new OpenPlatformApiError('FORBIDDEN', '当前账号没有访问此功能的权限。', 403),
    };
  return {
    ...resource,
    isLoading: resource.isLoading || (!!path && !!session && !!permission && !authorization.data && !authorization.error),
    error: resource.error ?? (permission ? authorization.error : undefined),
  };
}

export const statusOptions = [
  { value: 'ALL', label: '全部状态' },
  { value: 'ACTIVE', label: '启用' },
  { value: 'SUSPENDED', label: '暂停' },
  { value: 'ARCHIVED', label: '归档' },
  { value: 'CLOSED', label: '关闭' },
];

export function epoch(value?: number | null) {
  return value
    ? new Intl.DateTimeFormat('zh-CN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Shanghai',
      }).format(value)
    : '—';
}

export const optional = (value: string | undefined) => value?.trim() || undefined;

export const reasonFields: Field[] = [
  { name: 'reason', label: '操作原因', type: 'textarea', maxLength: 512 },
];
