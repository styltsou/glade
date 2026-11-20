import { useCallback, useRef, useState, useEffect, MutableRefObject } from "react";
import type { NoteData } from "@/types";

interface UseSaveNoteOptions {
	focused?: boolean;
	activeNote: NoteData | null;
	saveNote: (path: string, content: string) => Promise<void>;
	latestContentRef: MutableRefObject<string>;
	lastSavedContentRef: MutableRefObject<string>;
	pendingSaveRef: MutableRefObject<Promise<void> | null>;
	savedTimeoutRef?: MutableRefObject<ReturnType<typeof setTimeout> | null>;
	/** While true (external edit conflict), nothing is written. */
	blockedRef?: MutableRefObject<boolean>;
}

/** How long typing must pause before the note is written. */
export const AUTOSAVE_DELAY_MS = 1000;

export function useSaveNote({
	focused = true,
	activeNote,
	saveNote,
	latestContentRef,
	lastSavedContentRef,
	pendingSaveRef,
	savedTimeoutRef,
	blockedRef,
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
		if (blockedRef?.current) return;
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

	// Autosave: write once typing pauses, when the window loses focus, and as it closes.
	const saveNowRef = useRef(saveNow);
	saveNowRef.current = saveNow;
	const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const cancelAutosave = useCallback(() => {
		if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
		autosaveTimerRef.current = null;
	}, []);

	/** Call after every edit; each call restarts the wait. */
	const scheduleAutosave = useCallback(() => {
		cancelAutosave();
		autosaveTimerRef.current = setTimeout(() => {
			autosaveTimerRef.current = null;
			void saveNowRef.current();
		}, AUTOSAVE_DELAY_MS);
	}, [cancelAutosave]);

	// A timer from one note must never fire against another.
	const path = activeNote?.path;
	useEffect(() => cancelAutosave, [path, cancelAutosave]);

	useEffect(() => {
		if (!focused) return;
		const flush = () => {
			cancelAutosave();
			void saveNowRef.current();
		};
		const onVisibility = () => {
			if (document.visibilityState === "hidden") flush();
		};
		window.addEventListener("blur", flush);
		window.addEventListener("beforeunload", flush);
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			window.removeEventListener("blur", flush);
			window.removeEventListener("beforeunload", flush);
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, [focused, cancelAutosave]);

	// Ctrl+S saves right away; any wait in progress is no longer needed.
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (!focused) return;
			if ((e.metaKey || e.ctrlKey) && e.key === "s") {
				e.preventDefault();
				cancelAutosave();
				saveNow();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [saveNow, focused, cancelAutosave]);

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
		scheduleAutosave,
	};
}