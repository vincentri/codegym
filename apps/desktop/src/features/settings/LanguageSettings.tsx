import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import { useRuntimes } from "@/api/hooks";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { languageLabel } from "@/schemas";
import { IN_DOCKER } from "@/api/client";

export function LanguageSettings() {
  const { data, isLoading } = useRuntimes();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Runtimes</CardTitle>
        <CardDescription>
          {IN_DOCKER
            ? "Every language's toolchain comes with the CodeGym Docker image."
            : "Python, JavaScript and TypeScript are built in. Go, Java, C++ and Rust use the toolchain installed on your computer."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {isLoading && <Skeleton className="h-32" />}
        {data?.map((r) => (
          <div key={r.language} className="flex items-start gap-3 rounded-md border p-3">
            {r.available ? (
              <CheckCircle2Icon className="mt-0.5 size-4 text-primary" />
            ) : (
              <XCircleIcon className="mt-0.5 size-4 text-destructive" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                {languageLabel(r.language)}
                {r.bundled && <Badge variant="secondary">Built in</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">
                {r.engine}
                {r.version && ` · v${r.version}`}
              </div>
              {r.installHint && <div className="mt-1 text-xs text-medium">{r.installHint}</div>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
