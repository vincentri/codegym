import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vite-plus/test";
import { renderWithProviders } from "@/test/render";
import { EditorSettingsForm } from "./EditorSettings";

const settings = {
  theme: "dark" as const,
  defaultLanguage: "python" as const,
  editorFontSize: 14,
  editorTabSize: 4 as const,
  autosaveSeconds: 45,
  runTimeoutSeconds: 10,
};

describe("EditorSettingsForm", () => {
  it("uses Zod messages instead of native browser validation", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<EditorSettingsForm settings={settings} />);

    const form = container.querySelector("form")!;
    expect(form.noValidate).toBe(true);
    for (const el of container.querySelectorAll("input, textarea, select")) {
      expect(el.hasAttribute("required")).toBe(false);
      expect(el.hasAttribute("pattern")).toBe(false);
    }

    const custom = screen.getByLabelText("Custom interval (seconds)");
    await user.clear(custom);
    await user.type(custom, "999");
    await user.click(screen.getByRole("button", { name: "Save settings" }));

    expect(await screen.findByText("Interval must be between 1 and 300 seconds")).toBeTruthy();
  });

  it("shows a message for a non-numeric font size", async () => {
    const user = userEvent.setup();
    renderWithProviders(<EditorSettingsForm settings={settings} />);
    const fontSize = screen.getByLabelText("Font size");
    await user.clear(fontSize);
    await user.type(fontSize, "big");
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() => expect(screen.getByText("Enter a whole number")).toBeTruthy());
  });
});
