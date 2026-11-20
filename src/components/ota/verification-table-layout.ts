// Both tables end with status, time/progress, detail and actions. The device table
// also has a checkbox before its identifier, so anchor the shared columns from the end.
export const verificationTableLayout =
  'md:[&_table]:min-w-[56rem] md:[&_table]:table-fixed md:[&_th]:px-4! md:[&_td]:px-4! md:[&_th:nth-last-child(4)]:w-[11%] md:[&_th:nth-last-child(3)]:w-[36%] md:[&_th:nth-last-child(2)]:w-[16%] md:[&_th:last-child]:w-40';
