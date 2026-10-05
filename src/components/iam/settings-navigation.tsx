import { useIam } from '../../context/iam-context/identity';

import { authorizedNavigation, settingsNavigation } from './menu-navigation';
import { Navigation } from './shared';

export function SettingsNavigation() {
  const { authorization } = useIam();
  const items = authorizedNavigation([{ items: settingsNavigation }], authorization.data?.menus ?? [], authorization.data?.permissionCodes ?? []).flatMap((group) => group.items ?? []);
  return <Navigation links={items.map((item) => ({ to: item.url!, label: item.name }))} />;
}
