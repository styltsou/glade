import { useCallback, useRef, useState, useEffect, MutableRefObject } from "react";
import type { NoteData } from "@/types";

interface UseSaveNoteOptions {
	activeNote: NoteData | null;
	saveNote: (path: string, content: string) => Promise<void>;
	latestContentRef: MutableRefObject<string>;
	lastSavedContentRef: MutableRefObject<string>;
	pendingSaveRef: MutableRefObject<Promise<void> | null>;
	savedTimeoutRef?: MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

export function useSaveNote({
	activeNote,
	saveNote,
	latestContentRef,
	lastSavedContentRef,
	pendingSaveRef,
	savedTimeoutRef,
}: UseSaveNoteOptions) {
	const [saveStatus, setSaveStatus] = useState<"unsaved" | "saved" | "idle">("idle");

	const saveStatusRef = useRef<"unsaved" | "saved" | "idle">("idle");
	const internalSavedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const effectiveSavedTimeoutRef = savedTimeoutRef ?? internalSavedTimeoutRef;

	const setSaveStatusWithRef = useCallback((status: "unsaved" | "saved" | "idle") => {
		saveStatusRef.current = status;
		setSaveStatus(status);
	}, []);

	const saveNow = useCallback(async () => {
		if (!activeNote) return;
		if (latestContentRef.current === lastSavedContentRef.current) return;

		const content = latestContentRef.current;
		lastSavedContentRef.current = content;
		pendingSaveRef.current = (async () => {
			try {
				await saveNote(activeNote.path, content);
				setSaveStatusWithRef("saved");
				if (effectiveSavedTimeoutRef.current) clearTimeout(effectiveSavedTimeoutRef.current);
				effectiveSavedTimeoutRef.current = setTimeout(() => {
					setSaveStatusWithRef("idle");
				}, 2000);
			} catch {
				setSaveStatusWithRef("unsaved");
			} finally {
				pendingSaveRef.current = null;
			}
		})();

		return pendingSaveRef.current;
	}, [activeNote, saveNote, setSaveStatusWithRef, latestContentRef, lastSavedContentRef, pendingSaveRef, effectiveSavedTimeoutRef]);

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "s") {
				e.preventDefault();
				saveNow();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [saveNow]);

	useEffect(() => {
		return () => {
			if (internalSavedTimeoutRef.current) {
				clearTimeout(internalSavedTimeoutRef.current);
			}
		};
	}, []);

	return {
		saveStatus,
		setSaveStatusWithRef,
		saveNow,
	};
}