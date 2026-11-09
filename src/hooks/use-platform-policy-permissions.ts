import useSWR from 'swr';
import { listPlatformPermissions } from '@/api/policy/client';

export function usePlatformPolicyPermissions(projectId: string, enabled: boolean) {
  return useSWR(enabled ? [projectId, 'policy-permission-catalog'] : null,
    () => listPlatformPermissions(projectId), { shouldRetryOnError: false });
}
