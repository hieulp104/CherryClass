import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-2 px-3 pt-4">
      <div className="flex items-center gap-3 pb-3">
        <Skeleton className="size-11 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-card border border-line bg-surface p-3">
          <Skeleton className="size-[52px] rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
