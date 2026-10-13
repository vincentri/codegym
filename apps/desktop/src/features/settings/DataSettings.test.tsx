import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vite-plus/test";
import { renderRoute } from "@/test/render";

describe("Reset progress", () => {
  it("needs RESET typed before it resets, then returns to the dashboard", async () => {
    const user = userEvent.setup();
    const { router } = renderRoute("/settings/data");

    await user.click(await screen.findByRole("button", { name: "Reset progress" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector("form")?.noValidate).toBe(true);

    const confirm = screen.getByRole("button", { name: "Reset everything" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    const input = screen.getByLabelText(/to confirm/);
    await user.type(input, "reset");
    expect(confirm.disabled).toBe(true);

    await user.clear(input);
    await user.type(input, "RESET");
    expect(confirm.disabled).toBe(false);

    await user.click(confirm);
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });

  it("cancel closes the dialog without resetting", async () => {
    const user = userEvent.setup();
    const { router } = renderRoute("/settings/data");
    await user.click(await screen.findByRole("button", { name: "Reset progress" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(router.state.location.pathname).toBe("/settings/data");
  });
});
