import { useState, useEffect, useRef, useCallback } from "react";
import { Editor } from "@tiptap/react";
import {
	registerSuggestionCallbacks,
	unregisterSuggestionCallbacks,
	SuggestionItem,
} from "@/components/editor/noteLinking";

interface SuggestionPosition {
	top?: number;
	bottom?: number;
	left: number;
}

export function useSuggestionCallbacks(editor: Editor | null) {
	const [items, setItems] = useState<SuggestionItem[]>([]);
	const [position, setPosition] = useState<SuggestionPosition | null>(null);
	const [visible, setVisible] = useState(false);
	const commandRef = useRef<((item: SuggestionItem) => void) | null>(null);

	const handleCommand = useCallback((item: SuggestionItem) => {
		if (commandRef.current) {
			commandRef.current(item);
		}
		setVisible(false);
	}, []);

	useEffect(() => {
		if (!editor) return;

		registerSuggestionCallbacks(
			(props) => {
				if (!props.clientRect) return;
				const clientRect = props.clientRect();
				if (!clientRect) return;

				const spaceBelow = window.innerHeight - clientRect.bottom;
				const showAbove = spaceBelow < 300 && clientRect.top > spaceBelow;

				commandRef.current = props.command;

				requestAnimationFrame(() => {
					setItems(props.items);
					setPosition({
						top: showAbove ? undefined : clientRect.bottom + 4,
						bottom: showAbove
							? window.innerHeight - clientRect.top + 4
							: undefined,
						left: clientRect.left,
					});
					setVisible(true);
				});
			},
			(props) => {
				if (!props.clientRect) return;
				const clientRect = props.clientRect();
				if (!clientRect) return;

				const spaceBelow = window.innerHeight - clientRect.bottom;
				const showAbove = spaceBelow < 300 && clientRect.top > spaceBelow;

				commandRef.current = props.command;

				requestAnimationFrame(() => {
					setItems(props.items);
					setPosition({
						top: showAbove ? undefined : clientRect.bottom + 4,
						bottom: showAbove
							? window.innerHeight - clientRect.top + 4
							: undefined,
						left: clientRect.left,
					});
				});
			},
			() => {
				requestAnimationFrame(() => {
					setVisible(false);
					commandRef.current = null;
				});
			},
		);

		return () => {
			unregisterSuggestionCallbacks();
			setVisible(false);
		};
	}, [editor]);

	const closeSuggestion = useCallback(() => {
		setVisible(false);
	}, []);

	return {
		suggestionItems: items,
		suggestionPosition: position,
		suggestionVisible: visible,
		handleSuggestionCommand: handleCommand,
		closeSuggestion,
	};
}