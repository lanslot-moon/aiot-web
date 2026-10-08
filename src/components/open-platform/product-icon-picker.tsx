import type { FileVO } from '@/api/iam/contracts';
import { IamFileUploader, type FileUploaderHandle } from '@/components/iam/file-uploader';
import { AvatarCropper } from '@/components/iam/avatar-cropper';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, Loader2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCallback, useEffect, useRef, useState, type Ref } from 'react';

export function ProductIconPicker({ value, onChange, onPendingChange, disabled = false, uploadRef, onSelectionChange, onUploadStageChange }: {
  value: string;
  onChange: (value: string) => void;
  onPendingChange: (pending: boolean) => void;
  disabled?: boolean;
  uploadRef?: Ref<FileUploaderHandle>;
  onSelectionChange?: (selected: boolean) => void;
  onUploadStageChange?: (stage: 'uploading' | 'confirming') => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [stage, setStage] = useState<'uploading' | 'confirming' | 'preparing' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cropping, setCropping] = useState<File | null>(null);
  const cropResult = useRef<((file: File | null) => void) | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => () => { cropResult.current?.(null); }, []);

  const prepareFile = useCallback((file: File) => {
    setCropping(file); onPendingChange(true); onSelectionChange?.(false);
    return new Promise<File | null>((resolve) => { cropResult.current = resolve; });
  }, [onPendingChange, onSelectionChange]);

  const finishCrop = (file: File | null) => {
    cropResult.current?.(file); cropResult.current = null; setCropping(null);
    if (!file) { onPendingChange(!!preview && !value); onSelectionChange?.(!!preview); }
  };

  const select = useCallback((file: File | null) => {
    setPreview(file ? URL.createObjectURL(file) : null);
    setError(null);
    setStage(null); setUploading(false);
    onChange(''); onPendingChange(!!file); onSelectionChange?.(!!file);
  }, [onChange, onPendingChange, onSelectionChange]);

  const acceptIcon = useCallback((_file: FileVO, downloadUrl: string | null) => {
    setError(null);
    setStage('preparing');
    // Reuse the public URL issued with the upload; only publish it after confirmation.
    if (!downloadUrl || !/^https?:\/\/\S+$/.test(downloadUrl) || downloadUrl.length > 512) {
      setError('上传返回的图标地址不可用，请更换图片后重新上传。');
      return;
    }
    onChange(downloadUrl); onPendingChange(false);
  }, [onChange, onPendingChange]);

  return <section className="grid w-full min-w-0 max-w-3xl grid-cols-[4rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-xl border bg-muted/10 p-4" aria-label="产品图标">
      <Avatar className="size-16! rounded-xl! ring-1 ring-border after:rounded-xl!">
        <AvatarImage src={preview ?? (value || undefined)} alt="产品图标预览" className="rounded-lg! object-contain" />
        <AvatarFallback className="rounded-xl! bg-muted/60"><Package className="size-7 text-muted-foreground/60 sm:size-9" aria-hidden /></AvatarFallback>
      </Avatar>
    <div className="min-w-0">
      <div><p className="flex items-center gap-2 text-sm font-medium">产品图标{!uploadRef && <span className="text-xs font-normal text-muted-foreground">选填</span>}{!uploadRef && value && <span className="ml-auto flex items-center gap-1 text-xs font-normal text-emerald-600 dark:text-emerald-400"><Check className="size-3.5" aria-hidden />已上传</span>}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">JPG / PNG / WebP · 最大 5 MB · 裁剪为正方形</p>
      </div>
    </div>
    <div className="col-span-2 min-w-0 space-y-3">
    <IamFileUploader compact embedded storageType="public" directory="/product-icons" externalBusy={disabled}
      managed={!!uploadRef} uploadRef={uploadRef}
      accept={{ 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'] }}
      maxSize={5 * 1024 * 1024}
      showProgress={false} onStageChange={(next) => { setStage(next); onUploadStageChange?.(next); }} onBusyChange={setUploading}
      prepareFile={prepareFile}
      onFileChange={select} onUploaded={acceptIcon} />
    {!uploadRef && stage && <ol aria-label="产品图标上传进度" aria-live="polite" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
      {(['uploading', 'confirming', 'preparing'] as const).map((step, index) => {
        const activeIndex = ['uploading', 'confirming', 'preparing'].indexOf(stage);
        const complete = !!value || index < activeIndex;
        const active = !complete && index === activeIndex;
        const busy = uploading;
        return <li key={step} aria-current={active ? 'step' : undefined} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn('flex size-4 shrink-0 items-center justify-center rounded-full text-[10px]', complete ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : active ? 'text-primary' : 'border border-border text-muted-foreground')}>
            {complete ? <Check className="size-3" /> : active && busy ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" /> : index + 1}
          </span>
          <span className={cn('font-medium', !active && !complete && 'text-muted-foreground')}>{['上传图片', '确认上传', '准备图标'][index]}</span>
          <span className="sr-only">{complete ? '已完成' : active ? busy ? '处理中…' : error ? '地址不可用' : '未完成，请重试' : '等待中'}</span>
        </li>;
      })}
    </ol>}
    {error && <div role="alert" className="text-sm text-destructive">{error}</div>}
    </div>
    <Dialog open={!!cropping} onOpenChange={(open) => { if (!open) finishCrop(null); }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>裁剪产品图标</DialogTitle>
          <DialogDescription>拖动和缩放图片，选择正方形区域。确认后预览并上传图标。</DialogDescription>
        </DialogHeader>
        {cropping && <AvatarCropper key={cropping.name + cropping.lastModified} file={cropping}
          shape="rect" label="图标" onComplete={finishCrop} onCancel={() => finishCrop(null)} />}
      </DialogContent>
    </Dialog>
  </section>;
}
