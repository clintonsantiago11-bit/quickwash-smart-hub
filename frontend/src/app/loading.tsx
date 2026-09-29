import { PageSkeleton } from '@/components/ui/Skeleton';

/**
 * Shown the instant a route is requested, before its data arrives. Without
 * this, navigating between hub pages left a blank screen for as long as the
 * API took to answer.
 */
export default function Loading() {
  return <PageSkeleton label="Loading this page…" />;
}
