import { LoadingSpinner } from '@/components/shared';

export default function DatabaseLoading() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <LoadingSpinner size="lg" />
    </div>
  );
}
