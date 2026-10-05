import type { MenuVO, PermissionDescriptorVO, PermissionModuleVO } from '@/api/iam/contracts';
import { useId, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { accessibleMenuPages } from './menu-permissions';

export function MenuAccessPreview({ codes, menus }: { codes: string[]; menus: MenuVO[] }) {
  const matches = accessibleMenuPages(menus, codes);
  return <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
    <p className="font-medium">可访问的菜单</p>
    {matches.length ? <ul className="flex flex-wrap gap-2">{matches.map((menu) => <li className="rounded-md border bg-background px-2 py-1" key={menu.menuId}>{menu.menuName}</li>)}</ul> : <p className="text-muted-foreground">当前菜单目录没有匹配入口，请核对查看权限。</p>}
    <p className="text-xs text-muted-foreground">菜单是功能入口，操作权限单独配置。实际访问由服务端授权决定。</p>
  </div>;
}

import { moduleNames, permissionResourceName } from './permission-labels';

export function PermissionPicker({ catalog, tree, codes, onChange, disabled = false }: {
  catalog?: PermissionDescriptorVO[]; tree?: PermissionModuleVO[]; codes: string[]; onChange: (codes: string[]) => void; disabled?: boolean;
}) {
  const id = useId();
  const [search, setSearch] = useState('');
  const [technical, setTechnical] = useState(false);
  const source = tree ?? [{ module: '功能权限', resources: [...new Set((catalog ?? []).map((item) => item.resourceTypeCode))].map((code) => ({ code, name: permissionResourceName(code), actions: (catalog ?? []).filter((item) => item.resourceTypeCode === code) })) }];
  const all = source.flatMap((module) => module.resources.flatMap((resource) => resource.actions));
  const query = search.trim().toLowerCase();
  const visible = source.map((module) => ({ ...module, resources: module.resources.map((resource) => ({ ...resource,
    actions: resource.actions.filter((item) => [resource.name, item.permissionName, item.permissionCode, item.description].some((text) => text?.toLowerCase().includes(query))),
  })).filter((resource) => resource.actions.length) })).filter((module) => module.resources.length);
  const unknown = codes.filter((code) => !all.some((item) => item.permissionCode === code));
  function toggle(items: PermissionDescriptorVO[], checked: boolean) {
    const targets = items.map((item) => item.permissionCode);
    onChange(checked ? [...new Set([...codes, ...targets])] : codes.filter((code) => !targets.includes(code)));
  }
  return <fieldset className="min-w-0 space-y-3" disabled={disabled}>
    <legend className="text-sm font-medium">功能与权限 · 已选 {codes.length} 项</legend>
    <Label htmlFor={id} className="sr-only">搜索功能或权限</Label>
    <Input id={id} placeholder="搜索功能或操作，例如：设备、邀请" value={search} onChange={(event) => setSearch(event.target.value)} />
    <p className="text-xs text-muted-foreground">展开功能选择查看和操作权限。勾选整组会选择当前显示的全部操作，请核对后保存。</p>
    <div className="max-h-[40dvh] space-y-3 overflow-y-auto rounded-lg border p-3">
      {visible.map((module) => <section key={module.module} className="space-y-2">
        <h3 className="text-xs font-medium text-muted-foreground">{moduleNames[module.module] ?? module.module}</h3>
        {module.resources.map((resource) => {
          const count = resource.actions.filter((item) => codes.includes(item.permissionCode)).length;
          return <details key={resource.code} open className="rounded-md border">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-ring">{resource.name} <span className="ml-2 text-xs font-normal text-muted-foreground">{count}/{resource.actions.length}</span></summary>
            <div className="space-y-2 border-t p-3">
              <Label className="flex items-center gap-2 text-xs"><Checkbox disabled={disabled} checked={count === resource.actions.length} indeterminate={count > 0 && count < resource.actions.length} onCheckedChange={(checked) => toggle(resource.actions, checked)} />选择本组全部操作</Label>
              <div className="grid gap-2 pl-6 sm:grid-cols-2">{resource.actions.map((item) => <Label key={item.permissionCode} className="flex items-start gap-2 rounded-md py-1 font-normal">
                <Checkbox disabled={disabled} checked={codes.includes(item.permissionCode)} onCheckedChange={(checked) => toggle([item], checked)} />
                <span className="min-w-0"><span>{item.permissionName || item.permissionCode}</span>{item.description && <span className="block text-xs text-muted-foreground">{item.description}</span>}{technical && <code className="block break-all text-xs text-muted-foreground">{item.permissionCode}</code>}</span>
              </Label>)}</div>
            </div>
          </details>;
        })}
      </section>)}
      {!visible.length && <p className="text-sm text-muted-foreground">没有匹配的权限，请更换关键词。</p>}
    </div>
    <Label className="flex items-center gap-2 text-xs font-normal text-muted-foreground"><Checkbox checked={technical} onCheckedChange={setTechnical} />显示技术权限码</Label>
    {!!unknown.length && <p className="text-xs text-muted-foreground">保留 {unknown.length} 项目录外的已有权限：{unknown.join('、')}</p>}
  </fieldset>;
}
