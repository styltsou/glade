import { afterEach, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useStore } from "@/store";
import * as T from "@/lib/tabs";
import { TabStrip } from "./TabStrip";
import { TooltipProvider } from "@/components/ui/tooltip";

// TabStrip.test.tsx replaces Motion; this needs the real one. Motion writes a
// bare number for min-width, which is invalid CSS and left new tabs at 0px.
const initial = useStore.getState();
let host: HTMLDivElement;
let root: Root;

afterEach(() => {
	act(() => root.unmount());
	host.remove();
	useStore.setState(initial, true);
	vi.restoreAllMocks();
});

it("gives a tab opened after launch the same minimum width as the others", async () => {
	(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
	if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
	host = document.createElement("div");
	document.body.append(host);
	root = createRoot(host);
	const state = T.initialTabs("a.md");
	useStore.setState({ tabsState: state });
	act(() => root.render(<TooltipProvider><TabStrip /></TooltipProvider>));
	act(() => useStore.setState({ tabsState: T.openInNewTab(state, "b.md") }));

	const minimums = () => [...host.querySelectorAll<HTMLElement>("[data-tab-id]")].map((slot) => slot.style.minWidth);
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 400));
	});
	expect(minimums()).toEqual(["44px", "44px"]);
});
