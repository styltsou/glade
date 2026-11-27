import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { all } from "lowlight";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { COMMON_LANGUAGES, otherLanguages, resolveLanguage, typeaheadMatch, type CodeLanguage } from "@/lib/codeLanguages";

const PLAIN: CodeLanguage = { id: "plain text", label: "Plain text", aliases: ["text", "txt", "plaintext"] };

/** How long a pause in typing starts a new search (as in a native select). */
const TYPEAHEAD_RESET_MS = 800;

/**
 * The code block's language label, which opens the list of languages. Typing
 * moves the highlight to the best match, by name or alias; picking one writes
 * it after the block's fence, and Plain text clears it.
 */
export function CodeLanguagePicker({
	language,
	onChange,
	onClose,
}: {
	language: string | null;
	onChange: (language: string | null) => void;
	/** Called once the list closes, to hand focus back to the note. */
	onClose: () => void;
}) {
	const [open, setOpen] = useState(false);
	const current = resolveLanguage(language);
	const currentId = current?.id ?? PLAIN.id;
	const others = useMemo(() => (open ? otherLanguages(Object.keys(all)) : []), [open]);
	const listed = useMemo(() => [PLAIN, ...COMMON_LANGUAGES, ...others], [others]);

	// The highlighted row: opens on the block's language.
	const [active, setActive] = useState(currentId);
	const listRef = useRef<HTMLDivElement>(null);
	const typed = useRef({ text: "", at: 0 });

	useEffect(() => {
		if (open) setActive(currentId);
	}, [open, currentId]);

	// Keep the highlighted row in view, when the list opens and as typing moves it.
	useEffect(() => {
		if (!open) return;
		const frame = requestAnimationFrame(() => {
			listRef.current?.querySelector(`[data-value="${CSS.escape(active)}"]`)?.scrollIntoView({ block: "nearest" });
		});
		return () => cancelAnimationFrame(frame);
	}, [open, active]);

	const pick = (id: string) => {
		const next = id === PLAIN.id ? null : id;
		if (next !== (current?.id ?? null)) onChange(next);
		setOpen(false);
	};

	const onKeyDown = (event: KeyboardEvent) => {
		// Keys pressed here stay out of the note and the app's shortcuts.
		event.stopPropagation();
		const isCharacter = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
		if (!isCharacter) return;
		const now = event.timeStamp;
		const text = now - typed.current.at > TYPEAHEAD_RESET_MS ? "" : typed.current.text;
		// A space only counts inside a name ("plain text"), not to start one.
		if (event.key === " " && !text) return;
		event.preventDefault();
		typed.current = { text: text + event.key, at: now };
		const match = typeaheadMatch(listed, typed.current.text);
		if (match) setActive(match.id);
	};

	const item = (lang: CodeLanguage) => (
		<CommandItem key={lang.id} value={lang.id} onSelect={pick} className="cursor-default rounded-sm">
			<span className="flex-1 whitespace-nowrap">{lang.label}</span>
			{/* Every row keeps room for the check, so the list is as wide as its
			    longest name plus a clear gap, whichever row is picked. */}
			<Check className={cn("ml-4", currentId !== lang.id && "invisible")} />
		</CommandItem>
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button type="button" className="code-block-lang-button" aria-label={`Language: ${current?.label ?? PLAIN.label}. Change`}>
					{current?.label ?? PLAIN.label}
					<ChevronDown aria-hidden />
				</button>
			</PopoverTrigger>
			<PopoverContent
				// A menu in all but name: the same glass surface and rows as the dropdowns.
				data-menu=""
				align="start"
				sideOffset={6}
				// As wide as the longest name, never wrapping it.
				className="w-max min-w-32 p-0"
				onOpenAutoFocus={(event) => {
					// The list takes the keys (arrows, Enter, typing), not its first row.
					event.preventDefault();
					listRef.current?.closest<HTMLElement>("[cmdk-root]")?.focus();
				}}
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					onClose();
				}}
			>
				<Command
					label="Language"
					tabIndex={-1}
					className="bg-transparent outline-none"
					shouldFilter={false}
					value={active}
					onValueChange={setActive}
					onKeyDown={onKeyDown}
				>
					<CommandList ref={listRef} className="h-auto max-h-72">
						<CommandGroup>
							{item(PLAIN)}
							{COMMON_LANGUAGES.map(item)}
						</CommandGroup>
						{others.length > 0 && <CommandGroup heading="More languages">{others.map(item)}</CommandGroup>}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
