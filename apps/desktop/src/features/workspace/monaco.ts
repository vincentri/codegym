// Bundles Monaco locally so the editor works offline (no CDN). Only the editor core plus the
// syntax-highlighting grammars for supported languages are included.
import { loader } from "@monaco-editor/react";
import "monaco-editor/esm/vs/editor/edcore.main.js";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import "monaco-editor/esm/vs/basic-languages/go/go.contribution.js";
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js";
import "monaco-editor/esm/vs/basic-languages/python/python.contribution.js";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker.js?worker";

self.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

loader.config({ monaco });

export { monaco };
