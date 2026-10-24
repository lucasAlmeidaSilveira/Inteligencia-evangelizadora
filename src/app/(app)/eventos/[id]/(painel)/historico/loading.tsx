import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** A frase de abertura, um dia com três entradas e outro com duas — a forma
 *  comum da aba, na altura real de cada linha (ícone de 32px e duas linhas). */
export default function Carregando() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-full max-w-xl" />

      {[3, 2].map((linhas, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="mx-1 h-3 w-16" />
          <Card className="py-0">
            <CardContent className="divide-y p-0">
              {Array.from({ length: linhas }, (_, j) => (
                <div key={j} className="flex gap-3 px-4 py-3">
                  <Skeleton className="mt-0.5 size-8 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <Skeleton className="h-4 w-64" />
                      <Skeleton className="h-3 w-10 shrink-0" />
                    </div>
                    <Skeleton className="h-4 w-80" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
