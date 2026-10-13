import Editor, { type OnMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useResolvedTheme } from "@/lib/theme";
import { LANGUAGES, type Language } from "@/schemas";
import { monaco } from "./monaco";

export function CodeEditor({
  value,
  language,
  fontSize,
  tabSize,
  onChange,
  onRun,
  onSubmit,
}: {
  value: string;
  language: Language;
  fontSize: number;
  tabSize: number;
  onChange: (code: string) => void;
  onRun: () => void;
  onSubmit: () => void;
}) {
  const theme = useResolvedTheme();
  // Monaco registers commands once; keep the latest handlers in refs.
  const handlers = useRef({ onRun, onSubmit });
  useEffect(() => {
    handlers.current = { onRun, onSubmit };
  }, [onRun, onSubmit]);

  const onMount: OnMount = (editor) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => handlers.current.onRun());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () =>
      handlers.current.onSubmit(),
    );
    editor.focus();
  };

  return (
    <Editor
      value={value}
      language={LANGUAGES.find((l) => l.id === language)?.monaco}
      theme={theme === "dark" ? "vs-dark" : "vs"}
      onChange={(v) => onChange(v ?? "")}
      onMount={onMount}
      loading={<Spinner />}
      options={{
        fontSize,
        tabSize,
        insertSpaces: language !== "go",
        fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace",
        fontLigatures: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 12 },
        renderLineHighlight: "line",
        smoothScrolling: true,
        bracketPairColorization: { enabled: true },
      }}
    />
  );
}
