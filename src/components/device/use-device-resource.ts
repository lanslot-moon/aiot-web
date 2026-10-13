import { request } from '@/api/iam/client';
import { gatewayPath } from '@/api/device/client';
import { useResource } from '@/components/iam/shared-utils';

export function useDeviceResource<T>(projectId: string, path: string | null) {
  const resource = useResource<T>(
    path === null ? null : gatewayPath(projectId, path),
    'device:view',
    url => request<T>(url, 'GET', undefined, { projectId }),
    `device-manager:${projectId}`,
  );
  return { ...resource, isLoading: resource.isLoading && !resource.error };
}
