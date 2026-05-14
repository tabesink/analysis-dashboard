import { LoadingSpinner } from '@/components/shared';

export default function LoginLoading() {
  return (
    <div className="flex items-center justify-center min-h-svh">
      <LoadingSpinner size="lg" />
    </div>
  );
}
