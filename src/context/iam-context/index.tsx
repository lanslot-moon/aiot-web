import { useEffect, type ReactNode } from 'react';
import { useSWRConfig } from 'swr';
import { IdentityContext, useIdentity } from './identity';
export function IamProvider({ children }: { children: ReactNode }) {
  const identity = useIdentity();
  const { mutate } = useSWRConfig();
  useEffect(() => {
    if (!identity.session) void mutate(() => true, undefined, { revalidate: false });
  }, [identity.session, mutate]);
  return <IdentityContext.Provider value={identity}>{children}</IdentityContext.Provider>;
}
