import { useState, useEffect, useRef, useCallback } from "react";
import { Editor } from "@tiptap/react";
import {
	registerSlashCommandCallbacks,
	unregisterSlashCommandCallbacks,
	SlashCommandItem,
} from "@/components/editor/SlashCommands";

interface SlashCommandPosition {
	top?: number;
	bottom?: number;
	left: number;
}

export function useSlashCommandCallbacks(editor: Editor | null) {
	const [items, setItems] = useState<SlashCommandItem[]>([]);
	const [position, setPosition] = useState<SlashCommandPosition | null>(null);
	const [visible, setVisible] = useState(false);
	const commandRef = useRef<((item: SlashCommandItem) => void) | null>(null);

	const handleCommand = useCallback((item: SlashCommandItem) => {
		if (commandRef.current) {
			commandRef.current(item);
		}
		setVisible(false);
	}, []);

	useEffect(() => {
		if (!editor) return;

		registerSlashCommandCallbacks(
			(props) => {
				if (!props.clientRect) return;
				const clientRect = props.clientRect();
				if (!clientRect) return;

				const spaceBelow = window.innerHeight - clientRect.bottom;
				const showAbove = spaceBelow < 300 && clientRect.top > spaceBelow;

				commandRef.current = (item: SlashCommandItem) => {
					props.command(item);
				};

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

				commandRef.current = (item: SlashCommandItem) => {
					props.command(item);
				};

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
			unregisterSlashCommandCallbacks();
			setVisible(false);
		};
	}, [editor]);

	const closeSlash = useCallback(() => {
		setVisible(false);
	}, []);

	return {
		slashItems: items,
		slashPosition: position,
		slashVisible: visible,
		handleSlashCommand: handleCommand,
		closeSlash,
	};
}