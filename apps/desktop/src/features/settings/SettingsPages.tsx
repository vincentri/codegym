import { PageBody, PageHeader } from "@/components/common/PageHeader";
import { AiSettings } from "./AiSettings";
import { DataSettings } from "./DataSettings";
import { EditorSettings } from "./EditorSettings";
import { LanguageSettings } from "./LanguageSettings";

const BODY = "mx-auto flex max-w-5xl flex-col gap-5 p-6";

export function AiSettingsPage() {
  return (
    <>
      <PageHeader
        title="AI Mentor"
        description="Choose which AI answers your questions: local, hosted or your own endpoint."
      />
      <PageBody className={BODY}>
        <AiSettings />
      </PageBody>
    </>
  );
}

export function EditorSettingsPage() {
  return (
    <>
      <PageHeader title="Editor" description="Auto-save, appearance and how your code runs." />
      <PageBody className={BODY}>
        <EditorSettings />
      </PageBody>
    </>
  );
}

export function LanguagesSettingsPage() {
  return (
    <>
      <PageHeader
        title="Languages"
        description="Which languages can run on this computer, and what to install for the rest."
      />
      <PageBody className={BODY}>
        <LanguageSettings />
      </PageBody>
    </>
  );
}

export function DataSettingsPage() {
  return (
    <>
      <PageHeader
        title="Data"
        description="Where your progress is stored, problem packs, and resetting progress."
      />
      <PageBody className={BODY}>
        <DataSettings />
      </PageBody>
    </>
  );
}
