import { useNavigate, useSearch } from "@tanstack/react-router";
import { BotIcon, CodeIcon, DatabaseIcon, TerminalIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { settingsTabSchema } from "@/schemas";
import { AiSettings } from "./AiSettings";
import { EditorSettings } from "./EditorSettings";
import { DataSettings, LanguageSettings } from "./OtherSettings";

export function SettingsPage() {
  const { tab } = useSearch({ from: "/settings" });
  const navigate = useNavigate();
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl p-6">
        <h1 className="mb-4 text-xl font-semibold">Settings</h1>
        <Tabs
          value={tab}
          onValueChange={(t) =>
            void navigate({ to: "/settings", search: { tab: settingsTabSchema.parse(t) } })
          }
        >
          <TabsList>
            <TabsTrigger value="ai">
              <BotIcon /> AI Mentor
            </TabsTrigger>
            <TabsTrigger value="editor">
              <CodeIcon /> Editor
            </TabsTrigger>
            <TabsTrigger value="languages">
              <TerminalIcon /> Languages
            </TabsTrigger>
            <TabsTrigger value="data">
              <DatabaseIcon /> Data
            </TabsTrigger>
          </TabsList>
          <TabsContent value="ai" className="mt-4">
            <AiSettings />
          </TabsContent>
          <TabsContent value="editor" className="mt-4">
            <EditorSettings />
          </TabsContent>
          <TabsContent value="languages" className="mt-4">
            <LanguageSettings />
          </TabsContent>
          <TabsContent value="data" className="mt-4">
            <DataSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
