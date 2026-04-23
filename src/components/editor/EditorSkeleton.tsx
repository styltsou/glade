import { Skeleton } from "@/components/ui/skeleton";

export function EditorSkeleton() {
  return (
    <div className="flex flex-col flex-1 h-full bg-background overflow-hidden">
      <div className="flex items-center px-4 py-2 border-b shrink-0">
        <Skeleton className="h-6 w-32" />
        <div className="flex items-center gap-2 ml-auto">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
      <div className="flex flex-1 overflow-auto px-10 py-8">
        <div className="flex flex-col w-full max-w-[750px] mx-auto gap-3">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-5/6" />
          <Skeleton className="h-5 w-4/5" />
          <div className="h-6" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-5/6" />
          <div className="h-6" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      </div>
    </div>
  );
}