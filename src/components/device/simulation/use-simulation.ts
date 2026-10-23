import { useResource } from '@/components/iam/shared-utils';
import { simulationRequest, simulationPath } from '@/api/device/simulation';

export function useSimulation<T>(projectId: string, path: string | null, fetcher?: () => Promise<T>) {
  return useResource<T>(path === null ? null : simulationPath(path), 'device:view',
    () => fetcher ? fetcher() : simulationRequest<T>(projectId, path!), `simulation:${projectId}`);
}
