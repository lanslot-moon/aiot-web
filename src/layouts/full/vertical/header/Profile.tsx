import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
Sheet,
SheetContent,
SheetDescription,
SheetFooter,
SheetTitle,
SheetTrigger,
} from '@/components/ui/sheet';
import { LogOut, Mailbox, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { logout, useIam } from '../../../../context/iam-context/identity';

import { accountNavigation, authorizedNavigation } from '@/components/iam/menu-navigation';
import { ErrorNotice } from '@/components/iam/shared';
export default function ProfileSheet() {
  const { account, platformAuthorization: authorization } = useIam();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="打开账号菜单"
        className="flex size-10 cursor-pointer items-center justify-center rounded-full hover:bg-primary/5 focus-visible:outline focus-visible:outline-ring"
      >
        <Avatar className="size-8">
          <AvatarImage src={account.data?.avatarUrl ?? undefined} alt="账号头像" />
          <AvatarFallback>
            {account.data?.username?.slice(0, 2).toUpperCase() ?? <UserRound className="size-4" />}
          </AvatarFallback>
        </Avatar>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-80">
        <div className="p-6 py-6">
          <div className="flex flex-col items-center justify-center gap-4 pt-10">
            <Avatar className="size-16!">
              <AvatarImage src={account.data?.avatarUrl ?? undefined} alt="账号头像" />
              <AvatarFallback>{account.data?.username?.slice(0, 2).toUpperCase() ?? <UserRound />}</AvatarFallback>
            </Avatar>
            <div className="w-full text-center">
              <SheetTitle className="text-lg font-semibold">{account.data?.displayName || account.data?.username || '平台账号'}</SheetTitle>
              <SheetDescription className="mt-1 flex items-center justify-center gap-2">
                <Mailbox className="size-4 shrink-0" />
                <span className="min-w-0 break-all">{account.data?.email ?? '维护个人资料与账号安全'}</span>
              </SheetDescription>
            </div>
          </div>
        </div>
        <nav className="space-y-1 border-t p-6" aria-label="账号导航">
          {authorizedNavigation([{ items: accountNavigation }], authorization.data?.menus ?? [], authorization.data?.permissionCodes ?? []).flatMap((group) => group.items ?? []).map((link) => (
            <Link
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-primary/5 hover:text-primary focus-visible:outline focus-visible:outline-ring"
              key={link.url}
              to={link.url ?? '/projects'}
              onClick={() => setOpen(false)}
            >
              {link.icon && <link.icon className="size-5 shrink-0" />}
              {link.name}
            </Link>
          ))}
        </nav>
        <SheetFooter className="border-t px-6 pb-6 pt-6">
          <ErrorNotice error={error} />
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await logout();
                navigate('/auth/auth2/login', { replace: true });
              } catch (failure) {
                setError(failure);
              } finally {
                setBusy(false);
              }
            }}
          >
            <LogOut className="size-4" />
            退出登录
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
