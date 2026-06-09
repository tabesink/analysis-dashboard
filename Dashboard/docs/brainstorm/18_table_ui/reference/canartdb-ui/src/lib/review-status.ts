import type { ReviewStatus } from '@/types/database';

export function isNeedsReview(status: ReviewStatus): boolean {
  return status === 'needs_review';
}

export function statusWarningText(status: ReviewStatus): string {
  return isNeedsReview(status) ? 'Needs review' : 'Validated';
}

