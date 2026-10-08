import { Skeleton, SkeletonStats } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-40" />
      <SkeletonStats />
      <div className="rounded-card border border-line bg-surface p-5">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 flex h-56 items-end gap-3">
          {[40, 65, 55, 80, 70, 90].map((h, i) => (
            <Skeleton key={i} className="flex-1 rounded-t-[8px]" style={{ height: `${h}%` } as never} />
          ))}
        </div>
      </div>
    </div>
  );
}
