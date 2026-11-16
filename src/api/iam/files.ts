import { get, segment } from './client';
import type { FileDownloadVO } from './contracts';

export async function downloadPrivateFile(fileId: string) {
  const { downloadUrl } = await get<FileDownloadVO>(
    `/api/v1/private-files/${segment(fileId)}/download-url`,
  );
  if (!downloadUrl || !/^https?:\/\/\S+$/i.test(downloadUrl)) {
    throw new Error('文件下载地址不可用，请重试。');
  }

  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = '';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.click();
}
