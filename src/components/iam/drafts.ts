import { useEffect, useId } from 'react';
const drafts = new Set<string>();
export function hasUnsavedForms() {
  return drafts.size > 0;
}
export function clearDraft(id: string) {
  drafts.delete(id);
}
export function useDraftRegistration(dirty: boolean) {
  const id = useId();
  useEffect(() => {
    if (dirty) drafts.add(id);
    else drafts.delete(id);
    return () => {
      drafts.delete(id);
    };
  }, [dirty, id]);
  return id;
}
