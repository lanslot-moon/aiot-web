import type { MenuItemVO } from '@/api/iam/contracts';
import type { ChildItem, MenuItem } from '@/layouts/full/vertical/sidebar/sidebaritems';
import { CircleUserRound, FolderKanban, House, KeyRound, List, Settings, ShieldCheck, UserPlus, Users, Package, ListTree, Braces, Cpu } from 'lucide-react';

export function projectIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/projects\/([^/]+)(?:\/|$)/);
  if (!match || ['new', 'members', 'invitations', 'access-requests'].includes(match[1])) return undefined;
  return match[1];
}

export const accountNavigation: ChildItem[] = [
  { name: '个人资料', icon: CircleUserRound, url: '/account/profile' },
  { name: '账号安全', icon: ShieldCheck, url: '/account/security' },
  { name: '登录设备', icon: KeyRound, url: '/account/sessions' },
];
export const personalCenterNavigation: ChildItem[] = [{
  name: '个人中心', icon: CircleUserRound, url: '/account/profile', labelSource: 'app',
  activePaths: ['/account/profile', '/account/security', '/account/sessions', '/account/access-requests'],
}];
export const platformMainNavigation: MenuItem[] = [
  { heading: '项目空间', items: [
    { name: '全部项目', icon: FolderKanban, url: '/projects' },
  ] },

];

export const settingsNavigation: ChildItem[] = [
  { name: '角色与权限', icon: Users, url: '/iam/roles' },
  { name: '控制台菜单', icon: List, url: '/iam/menus' },
];

export const platformNavigation: MenuItem[] = [
  ...platformMainNavigation,
  { items: settingsNavigation },
  { items: personalCenterNavigation },
];

/** Search also includes settings destinations outside the business sidebar. */
export function navigationLinks(items: ChildItem[]): ChildItem[] {
  return items.flatMap((item) => [...(item.url ? [item] : []), ...navigationLinks(item.items ?? [])]);
}
const permissions: Record<string, string[]> = {
  '/projects': ['project:view'],
  '/account/access-requests': [],
  '/account/profile': ['account:view'],
  '/account/security': ['account:update'],
  '/account/sessions': ['session:manage'],
  '/iam/roles': ['platform-role:view'],
  '/iam/menus': ['menu:view'],
  overview: [],
  products: ['product:view'],
  categories: ['thing-model:view'],
  'parser-profiles': ['product:view'],
  devices: ['device:view'],
  members: ['project-member:view'],
  'access-requests': ['project-member:review'],
  authorization: ['project-credential:manage', 'project-credential:network-policy'],
  settings: ['project:view'],
};
const equivalents: Record<string, string> = {
  '/roles': '/iam/roles', '/account': '/account/profile',
  '/projects/members': 'members', '/projects/invitations': 'members',
  '/projects/access-requests': 'access-requests',
  '/open-api/credentials': 'authorization', '/open-api/network-policy': 'authorization',
};
export function canNavigate(route: string, codes: string[]): boolean {
  const required = permissions[route];
  return !!required && (required.length === 0 || required.some((permission) => codes.includes(permission)));
}
function flatten(menus: MenuItemVO[]): MenuItemVO[] {
  return menus.flatMap((menu) => [menu, ...flatten(menu.children ?? [])]);
}
export function projectNavigation(projectId: string): MenuItem[] {
  const base = `/projects/${encodeURIComponent(projectId)}`;
  return [
    { heading: '当前项目', items: [{ name: '项目概览', icon: House, url: `${base}/overview` }] },
    { heading: '开发管理', items: [
      { name: '产品', icon: Package, url: `${base}/products` },
      { name: '品类', icon: ListTree, url: `${base}/categories` },
      { name: '协议解析', icon: Braces, url: `${base}/parser-profiles` },
      { name: '设备', icon: Cpu, url: `${base}/devices` },
    ] },
    { heading: '项目协作', items: [
      { name: '成员与邀请', icon: Users, url: `${base}/members` },
      { name: '加入申请审批', icon: UserPlus, url: `${base}/access-requests` },
    ] },
    { heading: '开放 API', items: [{ name: 'API 凭证与来源限制', icon: KeyRound, url: `${base}/authorization` }] },
    { heading: '项目管理', items: [{ name: '项目设置', icon: Settings, url: `${base}/settings` }] },
  ];
}

/** Scope follows the API contract. Menu configuration can rename registered destinations;
 * it cannot expose another project's URLs or turn example routes into product capabilities. */
export function authorizedNavigation(groups: MenuItem[], menus: MenuItemVO[], codes: string[], projectId?: string, platformCodes: string[] = codes): MenuItem[] {
  const configured = flatten(menus).filter((menu) => menu.menuType === 'PAGE' && menu.permissionCode !== null && codes.includes(menu.permissionCode));
  const key = (route: string) => {
    if (equivalents[route]) return equivalents[route];
    if (projectId) {
      const base = `/projects/${encodeURIComponent(projectId)}/`;
      if (route.startsWith(base)) return route.slice(base.length).split('/')[0];
      const template = route.match(/^\/projects\/(?::projectId|\{projectId\})\/([^/]+)$/);
      if (template) return template[1];
    }
    return route;
  };
  const resolve = (item: ChildItem): ChildItem[] => {
    if (item.items) {
      const children = item.items.flatMap(resolve);
      return children.length ? [{ ...item, items: children }] : [];
    }
    const route = key(item.url ?? '');
    if (!canNavigate(route, route.startsWith('/') || route === 'settings' ? platformCodes : codes)) return [];
    const override = configured.find((node) => key(node.route ?? '') === route);
    return [{ ...item, name: item.labelSource === 'app' ? item.name : override?.menuName ?? item.name }];
  };
  return groups.map((group) => ({ ...group, items: group.items?.flatMap(resolve) }))
    .filter((group) => group.items?.length);
}

/** A different project never inherits a nested resource ID from the current one. */
export function projectSection(pathname: string): string {
  const id = projectIdFromPath(pathname);
  const section = id ? pathname.slice(`/projects/${id}/`.length).split('/')[0] : '';
  return ['overview', 'members', 'access-requests', 'authorization', 'settings', 'products', 'devices', 'categories', 'parser-profiles'].includes(section) ? section : 'overview';
}
