import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { ResultsGrid } from "../components/ResultsGrid";
import type { Row } from "../types";

const rows: Row[] = [
  { name: "Gift cards", amount: 120, state: "NSW" },
  { name: "Puppy", amount: 3, state: "VIC" },
  { name: "Tax refund", amount: 45, state: "QLD" },
];

function renderGrid() {
  render(
    <FluentProvider theme={webLightTheme}>
      <ResultsGrid rows={rows} columnNames={["name", "amount", "state"]} ariaLabel="Results" />
    </FluentProvider>,
  );
  const grid = document.querySelector('[role="grid"]') as HTMLElement;
  const cell = (row: number, col: number) => grid.querySelector(`[data-row="${row}"][data-col="${col}"]`) as HTMLElement;
  const headers = () => Array.from(grid.querySelectorAll('[role="columnheader"]'), (h) => h.textContent);
  const copy = () => {
    const setData = jest.fn();
    fireEvent.copy(grid, { clipboardData: { setData } });
    return setData.mock.calls[0]?.[1] as string | undefined;
  };
  return { grid, cell, headers, copy };
}

describe("ResultsGrid (st.dataframe interactions)", () => {
  it("selects cells with click and Shift+click, and copies them as tab-separated text", () => {
    const { cell, copy } = renderGrid();
    fireEvent.mouseDown(cell(0, 0), { button: 0 });
    fireEvent.mouseUp(window);
    fireEvent.mouseDown(cell(1, 1), { button: 0, shiftKey: true });

    expect(cell(0, 1)).toHaveAttribute("aria-selected", "true");
    expect(cell(2, 0)).toHaveAttribute("aria-selected", "false");
    expect(copy()).toBe("Gift cards\t120\nPuppy\t3");
  });

  it("selects by dragging across cells", () => {
    const { cell, copy } = renderGrid();
    fireEvent.mouseDown(cell(1, 2), { button: 0 });
    fireEvent.mouseOver(cell(2, 1));
    fireEvent.mouseUp(window);
    fireEvent.mouseOver(cell(0, 0)); // released, so this doesn't extend it
    expect(copy()).toBe("3\tVIC\n45\tQLD");
  });

  it("moves and extends the selection with the keyboard, and Ctrl+A selects everything", () => {
    const { grid, copy } = renderGrid();
    fireEvent.keyDown(grid, { key: "ArrowDown" }); // first key press selects the top-left cell
    fireEvent.keyDown(grid, { key: "ArrowRight" });
    fireEvent.keyDown(grid, { key: "ArrowDown", shiftKey: true });
    expect(copy()).toBe("120\n3");

    fireEvent.keyDown(grid, { key: "a", ctrlKey: true });
    expect(copy()).toBe("Gift cards\t120\tNSW\nPuppy\t3\tVIC\nTax refund\t45\tQLD");

    fireEvent.keyDown(grid, { key: "Escape" });
    expect(copy()).toBeUndefined();
  });

  it("hides, shows and pins columns from the column menu and the toolbar", async () => {
    const { headers } = renderGrid();
    expect(headers()).toEqual(["name", "amount", "state"]);

    fireEvent.click(screen.getByLabelText("Column options for amount"));
    fireEvent.click(await screen.findByText("Hide column"));
    await waitFor(() => expect(headers()).toEqual(["name", "state"]));

    fireEvent.click(screen.getByLabelText("Show or hide columns"));
    fireEvent.click(await screen.findByText("amount", { selector: "[role='menuitemcheckbox'] *" }));
    await waitFor(() => expect(headers()).toEqual(["name", "amount", "state"]));

    fireEvent.click(screen.getByLabelText("Column options for state"));
    fireEvent.click(await screen.findByText("Pin column"));
    await waitFor(() => expect(headers()).toEqual(["state", "name", "amount"]));
  });

  it("sorts from the column menu", async () => {
    const { cell } = renderGrid();
    fireEvent.click(screen.getByLabelText("Column options for amount"));
    fireEvent.click(await screen.findByText("Sort descending"));
    await waitFor(() => expect(cell(0, 0)).toHaveTextContent("Gift cards"));
    expect(cell(1, 0)).toHaveTextContent("Tax refund");
    expect(cell(2, 0)).toHaveTextContent("Puppy");
  });

  it("reorders columns by dragging a header onto another", () => {
    const { grid, headers } = renderGrid();
    const [name, , state] = Array.from(grid.querySelectorAll('[role="columnheader"]'));
    fireEvent.dragStart(state, { dataTransfer: { setData: jest.fn() } });
    fireEvent.dragOver(name, { dataTransfer: {} });
    fireEvent.drop(name, { dataTransfer: {} });
    expect(headers()).toEqual(["state", "name", "amount"]);
  });
});
