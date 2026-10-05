import type { MenuVO } from '@/api/iam/contracts';

/** A permitted child cannot bypass a disabled or unauthorized parent directory. */
export function accessibleMenuPages(menus: MenuVO[], codes: string[]): MenuVO[] {
  const byId = new Map(menus.map((menu) => [menu.menuId, menu]));
  const permissions = new Set(codes);
  return menus.filter((menu) => {
    if (menu.menuType !== 'PAGE' || !menu.permissionCode || !permissions.has(menu.permissionCode)) return false;
    const visited = new Set<string>();
    let node: MenuVO | undefined = menu;
    while (node) {
      if (visited.has(node.menuId) || node.status !== 'ACTIVE' || (node.permissionCode !== null && !permissions.has(node.permissionCode))) return false;
      visited.add(node.menuId);
      if (node.parentMenuId === null) return true;
      node = byId.get(node.parentMenuId);
    }
    return false;
  });
}
