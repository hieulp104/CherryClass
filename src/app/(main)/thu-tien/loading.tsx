import { Skeleton, SkeletonList } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-28 rounded-card" />
      <Skeleton className="h-11 rounded-full" />
      <SkeletonList rows={6} />
    </div>
  );
}
