import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useIam } from '../../context/iam-context/identity';

import { ErrorNotice, Loading } from './shared';
export function RequireSession({ children }: { children: ReactNode }) {
  const { session, account, authorization } = useIam();
  const location = useLocation();
  if (!session)
    return (
      <Navigate
        to="/auth/auth2/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  if (account.isLoading || authorization.isLoading) return <Loading />;
  if (account.error || authorization.error)
    return (
      <div className="mx-auto max-w-lg p-8">
        <ErrorNotice
          error={account.error ?? authorization.error}
          retry={() => {
            return Promise.all([account.mutate(), authorization.mutate()]);
          }}
        />
      </div>
    );
  return children;
}
