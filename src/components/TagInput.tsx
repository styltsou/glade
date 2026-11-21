import { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react";
import { X as Cross2Icon } from "lucide-react";
import { useStore } from "@/store";
import { usePaneNote } from "@/components/editor/PaneContext";
import { cn } from "@/lib/utils";
import type { TagCount } from "@/types";

/** Same padding, border and type as a saved tag, so the box is the tag it will become. */
const TAG_BOX = "px-3.5 border border-transparent text-[13px] font-medium";

export function TagInput() {
  const activeNote = usePaneNote();
  const updateNoteTags = useStore((state) => state.updateNoteTags);
  const allTags = useStore((state) => state.tags);
  const tags = activeNote?.tags ?? [];

  const [inputValue, setInputValue] = useState("");
  const [typedValue, setTypedValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [positionAbove, setPositionAbove] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showSuggestions && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setPositionAbove(spaceBelow < 200);
    }
  }, [showSuggestions]);

  // Filter and sort suggestions based on relevance and popularity
  const query = typedValue.trim().toLowerCase();
  const allSuggestions = query
    ? allTags
        .filter(
          (t: TagCount) =>
            t.name.toLowerCase().includes(query) &&
            !tags.includes(t.name.toLowerCase()),
        )
        .sort((a: TagCount, b: TagCount) => {
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();
          const aStarts = aName.startsWith(query);
          const bStarts = bName.startsWith(query);

          // Priority 1: Prefix matches over substring matches
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;

          // Priority 2: Popularity (usage count)
          if (a.count !== b.count) return b.count - a.count;

          // Priority 3: Alphabetical order for identical counts
          return aName.localeCompare(bName);
        })
        .slice(0, 10)
    : [];

  const suggestions = allSuggestions;

  useLayoutEffect(() => {
    const container = suggestionsRef.current;
    if (!container) return;
    
    const selectedItem = container.querySelector('[data-selected="true"]');
    if (!selectedItem) return;
    
    const containerRect = container.getBoundingClientRect();
    const itemRect = selectedItem.getBoundingClientRect();
    
    const relativeTop = itemRect.top - containerRect.top;
    const relativeBottom = itemRect.bottom - containerRect.top;
    
    if (relativeBottom > containerRect.height - 4) {
      container.scrollTop += relativeBottom - (containerRect.height - 4);
    } else if (relativeTop < 4) {
      container.scrollTop += relativeTop - 4;
    }
  }, [selectedIndex]);

  const addTag = useCallback(
    (tag: string) => {
      const normalised = tag.trim().toLowerCase();
      if (normalised && !tags.includes(normalised)) {
        updateNoteTags([...tags, normalised], activeNote?.path);
      }
      setInputValue("");
      setTypedValue("");
      setShowSuggestions(false);
      setSelectedIndex(0);
    },
    [tags, updateNoteTags],
  );

  const removeTag = useCallback(
    (tag: string) => {
      updateNoteTags(tags.filter((t: string) => t !== tag), activeNote?.path);
    },
    [tags, updateNoteTags],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Tab" && suggestions.length > 0) {
        e.preventDefault();
        const nextIndex = e.shiftKey
          ? (selectedIndex + suggestions.length - 1) % suggestions.length
          : (selectedIndex + 1) % suggestions.length;

        setSelectedIndex(nextIndex);
        setInputValue(suggestions[nextIndex].name);
      } else if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        if (showSuggestions && suggestions.length > 0 && selectedIndex >= 0) {
          addTag(suggestions[selectedIndex].name);
        } else if (inputValue.trim()) {
          addTag(inputValue);
        }
      } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
        removeTag(tags[tags.length - 1]);
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
        setSelectedIndex(0);
        setInputValue("");
        setTypedValue("");
        inputRef.current?.blur();
      } else if (e.key === "ArrowDown" && suggestions.length > 0) {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
      } else if (e.key === "ArrowUp" && suggestions.length > 0) {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + suggestions.length - 1) % suggestions.length);
      }
    },
    [inputValue, typedValue, tags, addTag, removeTag, suggestions, selectedIndex, showSuggestions],
  );

  return (
    <div className="relative flex items-center gap-2 flex-wrap">
      {tags.map((tag: string) => (
        <span
          key={tag}
          // On hover the × sits ~12px from the text and ~14px from the edge,
          // measured to its strokes (the icon box has ~4.5px of empty space
          // around them, so the margin is 8px and the padding 10px).
          className="group inline-flex items-center h-8 px-3.5 hover:pr-2.5 rounded-full border border-transparent bg-foreground/[0.06] text-[13px] font-medium text-muted-foreground transition-[padding,background-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-foreground/[0.1] hover:text-foreground cursor-default select-none motion-reduce:transition-colors"
        >
          {/* Tags are lowercase, so the eye centers the x-height, which sits
              1px below the middle when the caps are centered. Lift the text,
              not the ×. */}
          <span className="-translate-y-px">{tag}</span>
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => removeTag(tag)}
            className="flex w-0 items-center justify-center overflow-hidden opacity-0 transition-[width,margin,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:ml-2 group-hover:w-4 group-hover:opacity-100 hover:text-foreground cursor-pointer motion-reduce:transition-none"
          >
            <Cross2Icon className="size-3.5 shrink-0 scale-75 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-100" />
          </button>
        </span>
      ))}

      <div className="relative" ref={containerRef}>
        {/* Invisible copy of the text sizes the box; the input sits on top of it.
            (As a grid or flex item the input's own default width, about 20
            characters, would win.) */}
        <span aria-hidden className={cn(TAG_BOX, "invisible inline-flex h-8 items-center whitespace-pre")}>
          {inputValue || "+ add tag"}
        </span>
        <input
          ref={inputRef}
          className={cn(
            TAG_BOX,
            // pb-0.5 lifts the text 1px, like the saved tag's.
            "absolute inset-0 h-8 w-full min-w-0 pb-0.5 rounded-full bg-foreground/[0.06] text-muted-foreground outline-none placeholder:text-muted-foreground/60 hover:bg-foreground/[0.1] focus:border-border focus:bg-transparent focus:text-foreground focus:ring-0 transition-colors",
          )}
          value={inputValue}
          onChange={(e) => {
            const val = e.target.value;
            setInputValue(val);
            setTypedValue(val);
            setShowSuggestions(true);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            setTimeout(() => {
              setShowSuggestions(false);
              setSelectedIndex(0);
              setInputValue("");
              setTypedValue("");
            }, 150);
          }}
          placeholder="+ add tag"
        />

        {showSuggestions && suggestions.length > 0 && (
          <div 
            ref={suggestionsRef}
            className={cn(
              "absolute left-0 bg-popover border border-border rounded-md shadow-xl min-w-[160px] z-50 flex flex-col gap-0.5 p-1 max-h-[132px] overflow-y-auto",
              positionAbove ? "bottom-full mb-1" : "top-full mt-1"
            )}
            style={{ scrollbarWidth: 'none' }}
          >
            {suggestions.map((s: TagCount, index: number) => (
              <div
                key={s.name}
                onClick={() => addTag(s.name)}
                data-selected={index === selectedIndex}
                className={cn(
                  "flex items-center justify-between gap-4 cursor-pointer py-1 px-2 rounded-sm relative select-none outline-none",
                  index === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                )}
              >
                <span className="font-medium text-[12px]">{s.name}</span>
                {s.count > 1 && (
                  <span className="text-[10px] text-muted-foreground">{s.count}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
