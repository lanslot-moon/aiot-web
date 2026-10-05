import { Outlet, useBlocker } from 'react-router';
import { hasUnsavedForms } from './drafts';
import { getSession } from '@/api/iam/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
export function DraftBoundary() {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      currentLocation.pathname !== nextLocation.pathname &&
      hasUnsavedForms() &&
      (getSession() != null || !nextLocation.pathname.includes('/login')),
  );
  return (
    <>
      <Outlet />
      <Dialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>离开并放弃修改？</DialogTitle>
            <DialogDescription>
              此页面还有未保存的填写内容。离开后本次修改不会保存。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              autoFocus
              variant="outline"
              onClick={() => blocker.state === 'blocked' && blocker.reset()}
            >
              继续编辑
            </Button>
            <Button
              variant="destructive"
              onClick={() => blocker.state === 'blocked' && blocker.proceed()}
            >
              放弃修改并离开
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
