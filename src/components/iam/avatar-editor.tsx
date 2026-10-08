import { put } from '@/api/iam/client';
import type { AccountVO } from '@/api/iam/contracts';
import { Camera, Check, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useIam } from '../../context/iam-context/identity';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { AvatarCropper } from './avatar-cropper';
import { useDraftRegistration } from './drafts';
import { IamFileUploader, type FileUploaderHandle } from './file-uploader';
import { ErrorNotice } from './shared';

export function AvatarEditor({ account: current }: { account: AccountVO }) {
  const { account, platformAuthorization: authorization } = useIam();
  const [cropping, setCropping] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const cropResult = useRef<((file: File | null) => void) | null>(null);
  const [open, setOpen] = useState(false);
  const [candidate, setCandidate] = useState<string | null>(null);
  const uploader = useRef<FileUploaderHandle>(null);
  const saveLock = useRef(false);
  const [selected, setSelected] = useState(false);
  const [stage, setStage] = useState<'uploading' | 'confirming' | 'saving' | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const codes = authorization.data?.permissionCodes ?? [];
  const canUpload = ['account:update', 'file:upload'].every((code) => codes.includes(code));
  const busy = saving;
  useDraftRegistration(open && dirty);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (!open) { cropResult.current?.(null); cropResult.current = null; setCropping(null); setPreview(null); }
  }, [open]);
  useEffect(() => () => { cropResult.current?.(null); }, []);
  const prepareFile = useCallback((file: File) => {
    setCandidate(null); setStage(null); setError(null); setDirty(true); setCropping(file);
    return new Promise<File | null>((resolve) => { cropResult.current = resolve; });
  }, []);
  const finishCrop = (file: File | null) => {
    cropResult.current?.(file); cropResult.current = null; setCropping(null);
  };
  const fileChanged = useCallback((file: File | null) => {
    setCandidate(null); setStage(null); setError(null); setSelected(!!file); setDirty(!!file); setPreview(file ? URL.createObjectURL(file) : null);
  }, []);
  const close = () => {
    if (busy) return;
    if (dirty) setDiscard(true);
    else setOpen(false);
  };
  async function save() {
    if (!selected || saveLock.current || !canUpload) return;
    saveLock.current = true;
    setSaving(true); setError(null);
    try {
      // 已上传或已确认的文件由上传器复用，重试从失败阶段继续。
      const file = await uploader.current?.upload();
      if (!file) return;
      setStage('saving');
      const avatarUrl = file.downloadUrl;
      if (!avatarUrl || !/^https:\/\/[^\s]+$/.test(avatarUrl) || avatarUrl.length > 1024) {
        throw new Error('上传返回的头像地址不可用，请更换图片后重新上传。');
      }
      setCandidate(avatarUrl);
      const updated = await put<AccountVO>('/api/v1/accounts/current/profile', { avatarUrl });
      await account.mutate(updated, { revalidate: false });
      setDirty(false); setOpen(false); toast.success('头像保存成功');
    } catch (failure) { setError(failure); }
    finally { saveLock.current = false; setSaving(false); }
  }
  return <>
    <Button type="button" variant="outline" disabled={!canUpload}
      title={!canUpload ? '需要资料修改和文件上传权限' : undefined}
      onClick={() => { setCandidate(null); setStage(null); setSelected(false); setDirty(false); setError(null); setOpen(true); }}>
      <Camera className="size-4" />更换头像
    </Button>
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>更换头像</DialogTitle><DialogDescription>选择 JPG、PNG 或 WebP 图片，最大 5 MB。框选后点击保存头像，将自动完成上传、确认和保存。</DialogDescription></DialogHeader>
        {!cropping && <Avatar className="mx-auto size-20!">
          <AvatarImage src={preview ?? candidate ?? current.avatarUrl ?? undefined} alt="头像预览" />
          <AvatarFallback>{(current.displayName || current.username).slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>}
        {cropping && <AvatarCropper key={cropping.name + cropping.lastModified} file={cropping} onComplete={finishCrop} onCancel={() => finishCrop(null)} />}
        <div hidden={!!cropping}>
        <IamFileUploader storageType="public" directory="/avatars"
          accept={{ 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'] }}
          maxSize={5 * 1024 * 1024} prepareFile={prepareFile} uploadRef={uploader} managed externalBusy={busy} onStageChange={setStage} onFileChange={fileChanged} />
        </div>
        {stage && <ol aria-label="头像保存进度" aria-live="polite" className="flex py-2 text-xs">
          {(['uploading', 'confirming', 'saving'] as const).map((step, index) => {
            const activeIndex = ['uploading', 'confirming', 'saving'].indexOf(stage);
            const complete = index < activeIndex;
            const active = index === activeIndex;
            return <li key={step} aria-current={active ? 'step' : undefined} className="relative flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
              {index < 2 && <span aria-hidden="true" className={cn('absolute left-1/2 top-3.5 h-px w-full', complete ? 'bg-primary' : 'bg-border')} />}
              <span aria-hidden="true" className={cn('relative z-10 flex size-7 items-center justify-center rounded-full ring-4 ring-background', complete ? 'bg-primary text-primary-foreground' : active ? 'border-2 border-primary bg-background text-primary' : 'border border-border bg-background text-muted-foreground')}>
                {complete ? <Check className="size-4" /> : active && busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : index + 1}
              </span>
              <span className={cn('font-medium', !active && !complete && 'text-muted-foreground')}>{['上传图片', '确认上传', '保存头像'][index]}</span>
              <span className="text-muted-foreground">{complete ? '已完成' : active ? busy ? '处理中…' : '未完成，请重试' : '等待中'}</span>
            </li>;
          })}
        </ol>}
        <ErrorNotice error={error} />
        {!cropping && <DialogFooter>
          <Button type="button" variant="ghost" disabled={busy} onClick={close}>取消</Button>
          <Button type="button" disabled={!!cropping || !selected || busy || !canUpload} onClick={() => void save()}>{saving && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}{saving ? '正在保存…' : stage ? '重试保存' : '保存头像'}</Button>
        </DialogFooter>}
      </DialogContent>
    </Dialog>
    <Dialog open={discard} onOpenChange={setDiscard}>
      <DialogContent>
        <DialogHeader><DialogTitle>放弃头像修改？</DialogTitle><DialogDescription>关闭后，本次选择的头像不会保存到账号。</DialogDescription></DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" autoFocus onClick={() => setDiscard(false)}>继续编辑</Button>
          <Button type="button" variant="destructive" onClick={() => { setDiscard(false); setDirty(false); setOpen(false); }}>放弃修改</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
