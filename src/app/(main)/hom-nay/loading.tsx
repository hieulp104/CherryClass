import { Skeleton, SkeletonList, SkeletonStats } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Skeleton className="size-20 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-40 rounded-card" />
      <SkeletonStats />
      <SkeletonList rows={3} />
    </div>
  );
}
