import { useCallback, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import type { FileUploaderHandle } from '@/components/iam/file-uploader';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProductIconPicker } from './product-icon-picker';

export function ProductIconSaveProgress({ stage, busy }: {
  stage: 'uploading' | 'confirming' | 'saving';
  busy: boolean;
}) {
  const current = ['uploading', 'confirming', 'saving'].indexOf(stage);
  return <ol aria-label="图片保存进度" aria-live="polite" className="flex min-w-0 items-center text-xs">
    {(['上传图片', '确认上传', '保存图片'] as const).map((label, index) => <li key={label}
      aria-current={index === current ? 'step' : undefined}
      className={cn('flex min-w-0 items-center', index < 2 && 'flex-1', index > current && 'text-muted-foreground')}>
      <span className="flex shrink-0 items-center gap-1.5">
        {index < current ? <Check className="size-3.5 text-primary" aria-hidden />
          : index === current && busy ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
          : <span>{index + 1}</span>}
        <span>{label}</span>
        <span className="sr-only">{index < current ? '已完成' : index === current ? busy ? '处理中' : '未完成，请重试' : '等待中'}</span>
      </span>
      {index < 2 && <span aria-hidden className={cn('mx-2 h-px min-w-2 flex-1', index < current ? 'bg-primary' : 'bg-border')} />}
    </li>)}
  </ol>;
}

export function ProductIconEditor({ iconUrl, productName, onClose, onSave }: {
  iconUrl?: string | null;
  productName: string;
  onClose: () => void;
  onSave: (iconUrl: string) => Promise<void>;
}) {
  const [value, setValue] = useState(iconUrl ?? '');
  const [, setPending] = useState(false);
  const [selected, setSelected] = useState(false);
  const uploader = useRef<FileUploaderHandle>(null);
  const saveLock = useRef(false);
  const [stage, setStage] = useState<'uploading' | 'confirming' | 'saving' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iconChanged = useCallback((next: string) => {
    setValue(next || iconUrl || '');
  }, [iconUrl]);
  const selectionChanged = useCallback((next: boolean) => {
    setSelected(next); setStage(null); setError(null);
  }, []);

  async function save() {
    if (!selected || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setError(null);
    try {
      const file = await uploader.current?.upload();
      if (!file) return;
      const url = file.downloadUrl;
      if (!url || !/^https?:\/\/\S+$/.test(url) || url.length > 512) {
        throw new Error('上传返回的图标地址不可用，请更换图片后重试。');
      }
      setStage('saving');
      await onSave(url);
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '产品图标保存失败，请重试。');
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
    <DialogContent className="max-h-[85dvh] grid-cols-1 overflow-y-auto max-w-[min(calc(100%-2rem),28rem)]!">
      <DialogHeader>
        <DialogTitle>修改产品图标</DialogTitle>
        <DialogDescription className="break-words">为「{productName}」选择并裁剪图片，点击保存图片即可完成上传和保存。</DialogDescription>
      </DialogHeader>
      <ProductIconPicker value={value} onChange={iconChanged} onPendingChange={setPending} disabled={saving}
        uploadRef={uploader} onSelectionChange={selectionChanged} onUploadStageChange={setStage} />
      {stage && <ProductIconSaveProgress stage={stage} busy={saving} />}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={saving} onClick={onClose}>取消</Button>
        <Button type="button" disabled={saving || !selected} onClick={() => void save()}>
          {saving && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
          {saving ? '正在保存…' : stage ? '重试保存' : '保存图片'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
