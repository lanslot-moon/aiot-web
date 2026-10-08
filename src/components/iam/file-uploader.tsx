function hasControlCharacters(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

import { request, segment } from '@/api/iam/client';
import type { FileUploadVO, FileVO } from '@/api/iam/contracts';
import { CheckCircle2, FileIcon, Loader2, RefreshCw, UploadCloud, X } from 'lucide-react';
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { useDropzone, type Accept } from 'react-dropzone';
import { toast } from 'sonner';
import { permissionAuthorization, useIam } from '../../context/iam-context/identity';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useDraftRegistration } from './drafts';
import { ErrorNotice } from './shared';

type Phase = 'idle' | 'requesting' | 'uploading' | 'confirming' | 'success' | 'upload-error' | 'confirm-error' | 'cancelled';
const stages: Record<Phase, string> = {
  idle: '选择文件后开始上传', requesting: '正在准备上传…', uploading: '正在上传文件…',
  confirming: '文件传输成功，正在云端确认…', success: '上传完成，云端已确认',
  'upload-error': '上传未完成，请重试', 'confirm-error': '文件已传输成功，云端确认失败', cancelled: '上传已取消',
};
function sizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
export interface FileUploaderHandle {
  upload: () => Promise<(FileVO & { downloadUrl: string | null }) | null>;
}

export interface IamFileUploaderProps {
  uploadRef?: Ref<FileUploaderHandle>;
  managed?: boolean;
  showProgress?: boolean;
  compact?: boolean;
  embedded?: boolean;
  externalBusy?: boolean;
  onStageChange?: (stage: 'uploading' | 'confirming') => void;
  storageType?: 'private' | 'public';
  directory?: string;
  accept?: Accept;
  maxSize?: number;
  onUploaded?: (file: FileVO, downloadUrl: string | null) => void;
  onBusyChange?: (busy: boolean) => void;
  onFileChange?: (file: File | null) => void;
  prepareFile?: (file: File) => Promise<File | null>;
}

/** Shared upload control; its owning feature saves the confirmed file reference. */
export function IamFileUploader({ storageType: visibility = 'private', directory = '/uploads', accept, maxSize, onUploaded, onBusyChange, onFileChange, prepareFile, uploadRef, managed = false, showProgress = true, compact = false, embedded = false, externalBusy = false, onStageChange }: IamFileUploaderProps) {
  const identity = useIam();
  const authorization = permissionAuthorization(identity, 'file:upload');
  const allowed = authorization.data?.permissionCodes.includes('file:upload') ?? false;
  const [preparing, setPreparing] = useState(false);
  const selection = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<FileVO | null>(null);
  const receipt = useRef<FileUploadVO | null>(null);
  const notified = useRef<string | null>(null);
  useEffect(() => {
    if (result && notified.current !== result.fileId) {
      notified.current = result.fileId;
      onUploaded?.(result, receipt.current?.downloadUrl ?? null);
    }
  }, [result, onUploaded]);
  const transferred = useRef(false);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const busy = ['requesting', 'uploading', 'confirming'].includes(phase);
  const needsConfirmation = phase === 'confirm-error';
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  const path = `${directory.trim().replace(/\/$/, '')}/${file?.name ?? ''}`;
  useDraftRegistration(!!file && phase !== 'success');
  useEffect(() => () => { selection.current++; controller.current?.abort(); xhrRef.current?.abort(); }, []);

  function reset(next: File | null) {
    if (lock.current || transferred.current && !result) return;
    receipt.current = null;
    notified.current = null;
    transferred.current = false;
    onFileChange?.(next);
    setFile(next); setPhase('idle'); setProgress(0); setResult(null); setError(null);
  }
  async function selectFile(selected: File) {
    if (!prepareFile) { reset(selected); return; }
    const ticket = ++selection.current;
    setPreparing(true); setError(null);
    try {
      const prepared = await prepareFile(selected);
      if (ticket === selection.current && prepared) reset(prepared);
    } catch (failure) { if (ticket === selection.current) setError(failure); }
    finally { if (ticket === selection.current) setPreparing(false); }
  }
  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    multiple: false, noClick: true, noKeyboard: true, accept, maxSize,
    disabled: externalBusy || preparing || busy || needsConfirmation || !allowed,
    onDropAccepted: ([selected]) => void selectFile(selected),
    onDropRejected: () => setError(new Error('请选择一个符合类型和大小要求的文件。')),
  });

  useImperativeHandle(uploadRef, () => ({ upload: run }));

  async function run(): Promise<(FileVO & { downloadUrl: string | null }) | null> {
    if (preparing || !file || !allowed || lock.current) return null;
    if (result) return { ...result, downloadUrl: receipt.current?.downloadUrl ?? null };
    if (!transferred.current && (!file.name || file.name.length > 255 || /[\\/]/.test(file.name) || hasControlCharacters(file.name) || path.length > 512 || /\\/.test(path) || hasControlCharacters(path) || path.replace(/^\//, '').split('/').some((part) => !part || part === '.' || part === '..'))) {
      setError(new Error('文件名或存储目录无效：目录不能包含空路径段、反斜杠、单独的 . 或 ..，完整路径最多 512 个字符。')); return null;
    }
    lock.current = true;
    const operation = new AbortController(); controller.current = operation;
    setError(null);
    try {
      if (!transferred.current) {
        onStageChange?.('uploading');
        setPhase('requesting'); setProgress(0);
        // The selected local file is the source of truth for the filename.
        const signed = await request<FileUploadVO>(`/api/v1/${visibility}-files`, 'POST', { name: file.name, path }, { signal: operation.signal });
        if (operation.signal.aborted) throw new DOMException('上传已取消', 'AbortError');
        if (!signed.fileId || !signed.uploadUrl || !/^https?:\/\//i.test(signed.uploadUrl)) throw new Error('上传地址不可用，请重新尝试。');
        receipt.current = signed;
        setPhase('uploading');
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest(); xhrRef.current = xhr;
          xhr.open('PUT', signed.uploadUrl!); xhr.timeout = 120000;
          const contentType = signed['Content-Type'] ?? signed.contentType;
          if (contentType) xhr.setRequestHeader('Content-Type', contentType);
          // No IAM Authorization header, cookies, FormData or rewritten signed URL.
          xhr.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.min(99, Math.round(event.loaded / event.total * 100))); };
          xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`文件上传失败（HTTP ${xhr.status}），尚未调用云端确认。`));
          xhr.onerror = () => reject(new Error('无法上传文件，请检查网络或对象存储跨域配置。'));
          xhr.ontimeout = () => reject(new Error('上传超时，请检查网络后重试。'));
          xhr.onabort = () => reject(new DOMException('上传已取消', 'AbortError'));
          if (operation.signal.aborted) { reject(new DOMException('上传已取消', 'AbortError')); return; }
          xhr.send(file);
        });
        if (operation.signal.aborted) throw new DOMException('上传已取消', 'AbortError');
        transferred.current = true; setProgress(100);
      }
      const signed = receipt.current;
      if (!transferred.current || !signed?.fileId) throw new Error('文件尚未传输成功，不能确认。');
      onStageChange?.('confirming');
      setPhase('confirming');
      const confirmed = await request<FileVO>(`/api/v1/files/${segment(signed.fileId)}/confirmation`, 'POST', undefined, { signal: operation.signal });
      if (operation.signal.aborted) throw new DOMException('上传已取消', 'AbortError');
      if (confirmed.status !== 'UPLOADED') throw new Error('云端尚未确认上传完成，请重试确认。');
      setResult(confirmed); setPhase('success');
      if (!managed) toast.success('文件上传完成');
      return { ...confirmed, downloadUrl: signed.downloadUrl };
    } catch (failure) {
      if (operation.signal.aborted) { setPhase(transferred.current ? 'confirm-error' : 'cancelled'); }
      else { setError(failure); setPhase(transferred.current ? 'confirm-error' : 'upload-error'); }
      return null;
    } finally {
      lock.current = false; xhrRef.current = null;
      if (controller.current === operation) controller.current = null;
    }
  }
  function cancel() {
    if (phase === 'confirming') return;
    controller.current?.abort(); xhrRef.current?.abort();
  }
  return <div className="min-w-0 space-y-4">
    <div {...getRootProps()} className={cn('rounded-lg transition-colors', embedded ? 'flex min-h-9 flex-wrap items-center gap-2' : compact ? 'flex min-h-20 items-center gap-3 border border-dashed px-3 py-2' : 'border border-dashed p-6 text-center', isDragActive ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : !embedded && 'border-border bg-background', compact && file && 'hidden')}>
      <input {...getInputProps({ 'aria-label': '选择本地文件' })} />
      {!embedded && <UploadCloud className={cn('shrink-0 text-muted-foreground', compact ? 'size-7' : 'mx-auto mb-3 size-8')} aria-hidden="true" />}
      <div className={compact ? 'min-w-0 flex-1' : undefined}>
        <p className={cn('text-sm', embedded ? 'text-muted-foreground' : 'font-medium')}>{isDragActive ? '松开以选择文件' : embedded ? '拖拽图片到此处，或' : compact ? '拖拽图片到此处' : '将文件拖到这里，或选择本地文件'}</p>
        {compact && !embedded && <p className="mt-1 text-xs text-muted-foreground">或选择本地文件</p>}
        {!compact && <p className="mt-1 text-xs text-muted-foreground">每次上传一个文件，文件名自动读取</p>}
      </div>
      <Button type="button" variant="outline" size={compact ? 'sm' : 'default'} className={compact ? 'shrink-0' : 'mt-4'} disabled={externalBusy || preparing || busy || needsConfirmation || !allowed} onClick={open}>{file ? '更换文件' : embedded ? '选择图片' : '选择文件'}</Button>
    </div>
    {!allowed && authorization.data && <p className="text-sm text-muted-foreground">当前账号没有上传文件的权限。</p>}
    {file && <>
      <div className={cn('flex w-full min-w-0 flex-wrap items-center gap-3 rounded-lg', embedded ? 'border bg-background/70 px-3 py-2' : 'max-w-xl border p-3')}>
        <div className="flex min-w-0 flex-1 basis-40 items-center gap-2">
        {phase === 'success' ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" /> : <FileIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />}
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium" title={file.name}>{file.name}</p><p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">{sizeLabel(file.size)}</p></div>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        {compact && <Button type="button" size="icon-sm" variant="ghost" className="shrink-0" aria-label="更换图片" title="更换图片" disabled={externalBusy || preparing || busy || needsConfirmation || !allowed} onClick={open}><RefreshCw className="size-4" /></Button>}
        {!managed && phase !== 'success' && <Button type="button" size="sm" className="shrink-0" disabled={externalBusy || preparing || busy || !allowed} onClick={() => void run()}>{busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}{needsConfirmation ? '重试云端确认' : phase === 'upload-error' || phase === 'cancelled' ? '重新上传' : '开始上传'}</Button>}
        {!managed && (phase === 'requesting' || phase === 'uploading') && <Button type="button" size="icon-sm" variant="outline" className="shrink-0" aria-label="取消上传" title="取消上传" onClick={cancel}><X className="size-4" /></Button>}
        {!(phase === 'requesting' || phase === 'uploading') && <Button type="button" size="icon-sm" variant="ghost" className="shrink-0" aria-label="移除所选文件" disabled={externalBusy || preparing || busy || needsConfirmation} onClick={() => reset(null)}><X className="size-4" /></Button>}
        </div>
      </div>
      {showProgress && <p role="status" className="text-sm text-muted-foreground">{managed && phase === 'idle' ? '头像已选好，点击保存头像即可完成上传和保存。' : stages[phase]}</p>}
      {showProgress && ['uploading', 'confirming', 'success'].includes(phase) && <Progress value={progress} aria-label="文件上传进度" />}
      <ErrorNotice error={error} />

    </>}
  </div>;
}
