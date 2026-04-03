import { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react";
import { X as Cross2Icon } from "lucide-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import type { TagCount } from "@/types";

export function TagInput() {
  const activeNote = useStore((state) => state.activeNote);
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
        updateNoteTags([...tags, normalised]);
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
      updateNoteTags(tags.filter((t: string) => t !== tag));
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
    <div className="relative flex items-center gap-1.5 flex-wrap">
      {tags.map((tag: string) => (
        <span
          key={tag}
          className="group inline-flex items-center h-7 px-2.5 rounded-sm bg-muted text-[13px] text-muted-foreground border border-border/10 hover:border-border transition-all cursor-default select-none"
        >
          {tag}
          <button
            onClick={() => removeTag(tag)}
            className="w-0 opacity-0 group-hover:w-4 group-hover:ml-1.5 group-hover:opacity-100 transition-all duration-100 overflow-hidden flex items-center justify-center hover:text-foreground cursor-pointer"
          >
            <Cross2Icon className="w-3.5 h-3.5" />
          </button>
        </span>
      ))}

      <div className="relative" ref={containerRef}>
        <input
          ref={inputRef}
          className="bg-muted px-2.5 rounded-sm border border-border/10 hover:border-border outline-none text-[13px] h-7 text-muted-foreground font-medium placeholder:text-muted-foreground/50 min-w-[90px] focus:ring-0 focus:text-foreground transition-all"
          style={{
            width: `${Math.max(inputValue.length * 8 + 20, 90)}px`,
          }}
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
