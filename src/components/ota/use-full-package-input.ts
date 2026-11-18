import { useState } from 'react';
import useSWR from 'swr';
import { otaRequest, type Package, type Page } from '@/api/ota/client';
import { by } from './hooks';

function isBuildInput(pkg: Package, versionId: string | undefined, digest?: string) {
  return (
    pkg.targetVersionId === versionId &&
    pkg.packageType === 'FULL' &&
    ['SEALED', 'VERIFIED'].includes(pkg.state) &&
    !!pkg.targetImageSha256 &&
    (!digest || pkg.targetImageSha256.toLowerCase() === digest.toLowerCase())
  );
}

async function listFullPackages(projectId: string, versionId: string) {
  const items: Package[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const path = by('packages', { targetVersionId: versionId, packageType: 'FULL', pageSize: 200, cursor });
    const page: Page<Package> = await otaRequest(projectId, path);
    items.push(...page.items);
    if (!page.hasMore) break;
    if (!page.nextCursor || seen.has(page.nextCursor)) throw new Error('全量包列表读取不完整，请重试。');
    cursor = page.nextCursor;
    seen.add(cursor);
  } while (cursor);
  return items;
}

export function useFullPackageInput(
  projectId: string,
  versionId: string | undefined,
  autoSelect: boolean,
  digest?: string,
) {
  const list = useSWR(
    versionId ? [projectId, 'ota-full-inputs', versionId] : null,
    ([project, , version]) => listFullPackages(project, version),
  );
  const packages = (list.data ?? []).filter((pkg) => isBuildInput(pkg, versionId, digest));
  const [packageId, setPackageId] = useState('');
  const [fileId, setFileId] = useState('');
  const selected = packages.find((pkg) => pkg.id === packageId) ??
    (autoSelect && packages.length === 1 ? packages[0] : undefined);
  const detail = useSWR(
    selected ? [projectId, 'ota-package', selected.id] : null,
    ([project, , id]) => otaRequest<Package>(project, `packages/${id}`),
  );
  const pkg = detail.data;
  const files = pkg && isBuildInput(pkg, versionId, digest) ? pkg.files ?? [] : [];
  const file = files.length === 1 ? files[0] : files.find((item) => item.fileId === fileId);
  return {
    packages, selected, files, file, setFileId,
    selectPackage: (id: string) => {
      setPackageId(id);
      setFileId('');
    },
    image: !list.error && !detail.error && file && pkg?.targetImageSha256
      ? { fileId: file.fileId, sha256: pkg.targetImageSha256 } : undefined,
    loading: list.isLoading || detail.isLoading,
    error: list.error || detail.error,
    retry: () => Promise.all([list.mutate(), detail.mutate()]),
  };
}
