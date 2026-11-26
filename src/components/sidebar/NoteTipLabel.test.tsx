import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { useStore } from "@/store";
import { NoteTipLabel } from "./NoteTipLabel";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const initial = useStore.getState();
afterEach(() => act(() => useStore.setState(initial, true)));

function lines(path: string, title?: string) {
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<NoteTipLabel path={path} title={title} />));
  const text = [...host.children].map((el) => el.textContent);
  act(() => root.unmount());
  return text;
}

describe("NoteTipLabel", () => {
  it("showing titles: the title, then the path", () => {
    expect(lines("work/plan.md", "Launch plan")).toEqual(["Launch plan", "work/plan.md"]);
    expect(lines("work/plan.md", "plan")).toEqual(["plan", "work/plan.md"]);
  });

  it("showing file names: the file name, then the title", () => {
    useStore.setState({ noteLabel: "filename" });
    expect(lines("work/plan.md", "Launch plan")).toEqual(["plan.md", "Launch plan"]);
  });

  it("showing file names of a note without a title of its own: the file name, then the path", () => {
    useStore.setState({ noteLabel: "filename" });
    expect(lines("work/plan.md", "plan")).toEqual(["plan.md", "work/plan.md"]);
    expect(lines("work/plan.md")).toEqual(["plan.md", "work/plan.md"]);
  });
});
