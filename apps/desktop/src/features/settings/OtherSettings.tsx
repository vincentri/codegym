import {
  CheckCircle2Icon,
  DownloadIcon,
  FolderOpenIcon,
  PackageIcon,
  UploadIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useDataInfo, useRuntimes } from "@/api/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { languageLabel } from "@/schemas";

export function LanguageSettings() {
  const { data, isLoading } = useRuntimes();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Languages</CardTitle>
        <CardDescription>
          Python runs inside CodeGym (sandboxed WebAssembly) and JavaScript always works. Go needs
          the Go toolchain installed on your computer.
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

export function DataSettings() {
  const { data } = useDataInfo();
  const notYet = () => toast.info("Available in the next milestone");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Data</CardTitle>
        <CardDescription>
          Everything is stored locally in a single SQLite database on this computer.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {data ? (
          <dl className="grid grid-cols-[160px_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Database</dt>
            <dd className="font-mono text-xs break-all">{data.dbPath}</dd>
            <dt className="text-muted-foreground">Built-in problems</dt>
            <dd>
              {data.builtinProblems}{" "}
              <span className="text-muted-foreground">(bank {data.bankVersion})</span>
            </dd>
            <dt className="text-muted-foreground">Your problems</dt>
            <dd>{data.customProblems}</dd>
          </dl>
        ) : (
          <Skeleton className="h-20" />
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={notYet}>
            <FolderOpenIcon /> Open data folder
          </Button>
          <Button variant="outline" onClick={notYet}>
            <DownloadIcon /> Export my problems
          </Button>
          <Button variant="outline" onClick={notYet}>
            <UploadIcon /> Import problem pack
          </Button>
        </div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <PackageIcon className="size-3.5" /> Problem packs are .codegym.json files you can share
          with friends.
        </p>
      </CardContent>
    </Card>
  );
}
