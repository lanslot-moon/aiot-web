import { states } from '@/api/ota/client';
import type { useFullPackageInput } from './use-full-package-input';
import { Choice, Failure, Field } from './shared';

export function FullPackagePicker({ input, title, empty }: {
  input: ReturnType<typeof useFullPackageInput>;
  title: string;
  empty: string;
}) {
  let errorMessage: string | undefined;
  if (!input.loading && !input.error) {
    if (!input.packages.length) errorMessage = empty;
    else if (input.selected && !input.files.length) errorMessage = '所选全量包没有可用镜像，请重新选择。';
  }
  return <Field title={title} required>
    <Choice label={title} required={!input.error} errorMessage={errorMessage} value={input.selected?.id ?? null} disabled={!input.packages.length}
      placeholder={input.loading ? '正在读取…' : `选择${title}`}
      options={input.packages.map((pkg) => ({
        value: pkg.id, label: `全量包 ${pkg.id} · ${states[pkg.state]}`,
      }))}
      onValueChange={input.selectPackage}
    />
    {input.files.length > 1 && <Choice key={input.selected?.id} label={title + '镜像'} required value={input.file?.fileId ?? null}
      placeholder="选择包内的完整固件镜像"
      options={input.files.map((file) => ({ value: file.fileId, label: `${file.fileRole} · ${file.fileId}` }))}
      onValueChange={input.setFileId}
    />}
    <Failure error={input.error} retry={input.retry} />
  </Field>;
}
