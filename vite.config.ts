import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: ["**/dist/**", "**/target/**", "**/src-tauri/gen/**", "pnpm-lock.yaml"],
  },
  lint: {
    ignorePatterns: ["**/dist/**", "**/target/**", "**/src-tauri/**"],
    plugins: ["typescript", "react", "jsx-a11y"],
    jsPlugins: [
      { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
      { name: "codegym", specifier: "./tools/oxlint-plugin/index.js" },
    ],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      // Forms are validated with Zod + React Hook Form only, never by the browser.
      "codegym/form-requires-novalidate": "error",
      "codegym/no-native-validation-attrs": "error",
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
    overrides: [
      {
        // Vendored shadcn/ui components are kept close to upstream.
        files: ["apps/desktop/src/components/ui/**", "apps/desktop/src/hooks/use-mobile.ts"],
        rules: {
          "jsx-a11y/heading-has-content": "off",
          "jsx-a11y/anchor-has-content": "off",
          "jsx-a11y/prefer-tag-over-role": "off",
          "jsx-a11y/click-events-have-key-events": "off",
          "jsx-a11y/no-noninteractive-element-interactions": "off",
          "react/purity": "off",
          "react/set-state-in-effect": "off",
        },
      },
    ],
  },
  run: {
    cache: true,
  },
});
