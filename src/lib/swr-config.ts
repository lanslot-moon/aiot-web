import type { SWRConfiguration } from 'swr';

// Resource owners refresh after mutations; returning to the window must not
// re-fetch every mounted account, authorization, project and device resource.
export const applicationSWRConfig = {
  revalidateOnFocus: false,
} satisfies SWRConfiguration;
