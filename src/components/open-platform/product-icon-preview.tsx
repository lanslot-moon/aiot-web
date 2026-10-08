import { Loader2, Package, ZoomIn } from 'lucide-react';
import { useState } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function ProductIconPreview({ iconUrl, productName }: { iconUrl?: string | null; productName: string }) {
  const [failed, setFailed] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  if (!iconUrl || failed) {
    return <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
      <Package className="size-6" aria-hidden />
    </div>;
  }

  return <Dialog onOpenChange={(open) => {
    if (open) {
      setPreviewLoaded(false);
      setPreviewFailed(false);
    }
  }}>
    <DialogTrigger render={
      <button type="button" aria-label={`放大预览${productName}的图标`} title="点击放大预览"
        className="group relative size-14 shrink-0 cursor-zoom-in overflow-hidden rounded-lg border bg-muted outline-none transition-shadow hover:ring-2 hover:ring-primary/30 focus-visible:ring-2 focus-visible:ring-ring">
        <img src={iconUrl} alt={`${productName}的图标`} className="size-full object-contain" onError={() => setFailed(true)} />
        <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <ZoomIn className="size-5" aria-hidden />
        </span>
      </button>
    } />
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto !max-w-[min(94vw,640px)]">
      <DialogHeader>
        <DialogTitle>产品图标</DialogTitle>
        <DialogDescription>{productName}</DialogDescription>
      </DialogHeader>
      <div className="relative flex aspect-square min-h-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/20">
        {!previewLoaded && !previewFailed && <div role="status" className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />正在加载图片…
        </div>}
        {previewFailed ? <p role="alert" className="text-sm text-muted-foreground">图片加载失败，请关闭后重新打开预览。</p>
          : <img src={iconUrl} alt={`${productName}的图标大图`} className={`size-full object-contain ${previewLoaded ? '' : 'opacity-0'}`}
              onLoad={() => setPreviewLoaded(true)} onError={() => setPreviewFailed(true)} />}
      </div>
    </DialogContent>
  </Dialog>;
}
