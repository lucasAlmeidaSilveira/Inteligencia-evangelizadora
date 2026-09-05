import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Carregando() {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i} className="gap-0 py-3">
            <CardContent className="flex items-center gap-3 px-4">
              <Skeleton className="size-5 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="size-9 shrink-0" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
