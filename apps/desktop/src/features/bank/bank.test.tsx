import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vite-plus/test";
import { renderRoute } from "@/test/render";

describe("Questions page", () => {
  it("offers Edit and Delete only for your own questions", async () => {
    const user = userEvent.setup();
    renderRoute("/bank/questions");

    await user.click(await screen.findByRole("button", { name: "Actions for Two Sum" }));
    let menu = await screen.findByRole("menu");
    expect(within(menu).queryByRole("menuitem", { name: /^Edit/ })).toBeNull();
    expect(within(menu).queryByRole("menuitem", { name: /Delete/ })).toBeNull();
    expect(within(menu).getByRole("menuitem", { name: /Duplicate to edit/ })).toBeTruthy();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Actions for Rotate String" }));
    menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: /^Edit/ })).toBeTruthy();
    expect(within(menu).getByRole("menuitem", { name: /Delete/ })).toBeTruthy();
  });
});

describe("Question editor", () => {
  it("validates with Zod messages, not the browser", async () => {
    const user = userEvent.setup();
    const { container } = renderRoute("/bank/questions/new");
    await screen.findByText("Function signature");
    expect(container.querySelector("form")?.noValidate).toBe(true);

    await user.click(screen.getAllByRole("button", { name: "Save question" })[0]!);
    expect(await screen.findByText("Title is too short")).toBeTruthy();
    expect(screen.getByText("Pick at least one category")).toBeTruthy();
    expect(screen.getAllByText("Required").length).toBeGreaterThan(0);
  });

  it("adds an input to every test when a parameter is added", async () => {
    const user = userEvent.setup();
    renderRoute("/bank/questions/new");
    await screen.findByText("Function signature");
    const countInputs = () => screen.getAllByPlaceholderText("[1,2,3]").length;
    const before = countInputs();
    await user.click(screen.getByRole("button", { name: "Add parameter" }));
    // The new parameter is an int, so each of the 3 tests gains an int input ("5").
    await waitFor(() =>
      expect(screen.getAllByPlaceholderText("5").length).toBeGreaterThanOrEqual(3),
    );
    expect(countInputs()).toBe(before);
  });

  it("flags invalid JSON in a test value", async () => {
    const user = userEvent.setup();
    renderRoute("/bank/questions/rotate-string/edit");
    const inputs = await screen.findAllByDisplayValue('"abcde"');
    await user.clear(inputs[0]!);
    await user.type(inputs[0]!, "abcde");
    await user.click(screen.getAllByRole("button", { name: "Save question" })[0]!);
    expect(await screen.findByText("Not valid JSON")).toBeTruthy();
  });
});

describe("Generate with AI", () => {
  it("validates the request, then shows verified questions to review", async () => {
    const user = userEvent.setup();
    renderRoute("/bank/questions");
    await user.click(await screen.findByRole("button", { name: "Generate with AI" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector("form")?.noValidate).toBe(true);

    const count = within(dialog).getByLabelText("How many");
    await user.clear(count);
    await user.type(count, "9");
    await user.click(within(dialog).getByRole("button", { name: "Generate" }));
    expect(await within(dialog).findByText("Pick or type a topic")).toBeTruthy();
    expect(within(dialog).getByText("Generate between 1 and 5 at a time")).toBeTruthy();

    await user.type(within(dialog).getByLabelText("Topic"), "Array");
    await user.clear(count);
    await user.type(count, "2");
    await user.click(within(dialog).getByRole("button", { name: "Generate" }));
    expect(
      await screen.findByRole("button", { name: "Save selected (2)" }, { timeout: 5000 }),
    ).toBeTruthy();
    expect(screen.getAllByText(/tests verified by running the reference solution/).length).toBe(2);
  });
});
