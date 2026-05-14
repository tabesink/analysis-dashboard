/**
 * Status pill styles aligned with the Database table (`app/database/page.tsx`).
 */
export function getStatusBadgeClassName(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  if (v === 'Approved') {
    return 'bg-green-100 text-green-700';
  }
  if (v === 'Obsolete') {
    return 'bg-red-100 text-red-700';
  }
  return 'bg-amber-100 text-amber-700';
}
