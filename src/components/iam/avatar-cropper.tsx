import { useEffect, useRef, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@base-ui/react/slider';
import { ErrorNotice } from './shared';

/** A circular viewport backed by the crop library's original-image pixel coordinates. */
export function AvatarCropper({ file, onComplete, onCancel }: {
  file: File; onComplete: (file: File) => void; onCancel: () => void;
}) {
  const [source, setSource] = useState('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    const url = URL.createObjectURL(file); setSource(url);
    return () => { active.current = false; URL.revokeObjectURL(url); };
  }, [file]);
  async function apply() {
    if (!area || busy || !source) return;
    setBusy(true); setError(null);
    try {
      const image = new Image(); image.src = source;
      await image.decode();
      const canvas = document.createElement('canvas');
      // Keep the output bounded and discard pixels outside the circular selection.
      const size = Math.min(512, Math.round(Math.min(area.width, area.height)));
      if (size < 1) throw new Error('请重新选择头像区域。');
      canvas.width = size; canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('当前浏览器无法裁剪图片。');
      context.beginPath(); context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); context.clip();
      context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, size, size);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('图片裁剪失败，请重试。')), 'image/png'));
      const name = `${file.name.replace(/\.[^.]*$/, '').slice(0, 200)}-avatar.png`;
      if (active.current) onComplete(new File([blob], name, { type: 'image/png' }));
    } catch (failure) { if (active.current) setError(failure); }
    finally { if (active.current) setBusy(false); }
  }
  return <div className="space-y-4">
    <div className="relative h-72 overflow-hidden rounded-lg bg-black" aria-label="头像裁剪区域">
      {source && <Cropper image={source} crop={crop} zoom={zoom} aspect={1} cropShape="round"
        showGrid={false} objectFit="cover" onCropChange={setCrop} onZoomChange={setZoom}
        onCropComplete={(_, pixels) => setArea(pixels)} onMediaLoaded={() => setError(null)}
        mediaProps={{ onError: () => setError(new Error('无法读取图片，请选择其他图片。')) }} />}
    </div>
    <p className="text-sm text-muted-foreground">拖动图片调整位置，缩放以框选头像。</p>
    <div className="flex items-center gap-4">
      <span className="text-sm">缩放</span>
      <Slider.Root min={1} max={3} step={0.01} value={zoom} disabled={busy}
        onValueChange={setZoom} className="cn-slider min-w-0 flex-1">
        <Slider.Control className="relative flex h-5 w-full touch-none items-center select-none">
          <Slider.Track className="cn-slider-track relative h-1 w-full rounded-full bg-muted">
            <Slider.Indicator className="cn-slider-range h-full bg-primary" />
            <Slider.Thumb getAriaLabel={() => '头像缩放'} className="cn-slider-thumb size-3 border bg-background focus-visible:ring-2" />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    </div>
    <ErrorNotice error={error} />
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>取消裁剪</Button>
      <Button type="button" disabled={!area || busy || !!error} onClick={() => void apply()}>
        {busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}使用此头像
      </Button>
    </div>
  </div>;
}
