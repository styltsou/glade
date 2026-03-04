import { useState, useRef, useCallback } from "react";
import { X as Cross2Icon } from "lucide-react";
import { useVaultStore } from "@/stores/useVaultStore";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export function TagInput() {
  const { activeNote, updateNoteTags, tags: allTags } = useVaultStore();
  const tags = activeNote?.tags ?? [];

  const [inputValue, setInputValue] = useState("");
  const [typedValue, setTypedValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter and sort suggestions based on relevance and popularity
  const query = typedValue.trim().toLowerCase();
  const suggestions = query
    ? allTags
        .filter(
          (t) =>
            t.name.toLowerCase().includes(query) &&
            !tags.includes(t.name.toLowerCase()),
        )
        .sort((a, b) => {
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
        .slice(0, 5)
    : [];

  const addTag = useCallback(
    (tag: string) => {
      const normalised = tag.trim().toLowerCase();
      if (normalised && !tags.includes(normalised)) {
        updateNoteTags([...tags, normalised]);
      }
      setInputValue("");
      setTypedValue("");
      setShowSuggestions(false);
      setSelectedIndex(-1);
    },
    [tags, updateNoteTags],
  );

  const removeTag = useCallback(
    (tag: string) => {
      updateNoteTags(tags.filter((t) => t !== tag));
    },
    [tags, updateNoteTags],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Tab" && suggestions.length > 0) {
        e.preventDefault();
        const nextIndex = e.shiftKey
          ? selectedIndex <= -1
            ? suggestions.length - 1
            : selectedIndex - 1
          : selectedIndex >= suggestions.length - 1
            ? -1
            : selectedIndex + 1;

        setSelectedIndex(nextIndex);
        setInputValue(nextIndex === -1 ? typedValue : suggestions[nextIndex].name);
      } else if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          addTag(suggestions[selectedIndex].name);
        } else if (inputValue.trim()) {
          addTag(inputValue);
        }
      } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
        removeTag(tags[tags.length - 1]);
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
        setSelectedIndex(-1);
        setInputValue("");
        setTypedValue("");
        inputRef.current?.blur();
      }
    },
    [inputValue, typedValue, tags, addTag, removeTag, suggestions, selectedIndex],
  );

  return (
    <div className="relative flex items-center gap-1.5 flex-wrap">
      {tags.map((tag) => (
        <span
          key={tag}
          className="group inline-flex items-center h-7 px-2.5 rounded-md bg-muted text-[13px] text-muted-foreground border border-border/10 hover:border-border transition-all cursor-default select-none"
        >
          {tag}
          <button
            onClick={() => removeTag(tag)}
            className="w-0 opacity-0 group-hover:w-4 group-hover:ml-1.5 group-hover:opacity-100 transition-all duration-200 overflow-hidden flex items-center justify-center hover:text-foreground"
          >
            <Cross2Icon className="w-3.5 h-3.5" />
          </button>
        </span>
      ))}

      <div className="relative">
        <input
          ref={inputRef}
          className="bg-muted px-2.5 rounded-md border border-border/10 hover:border-border outline-none text-[13px] h-7 text-muted-foreground font-medium placeholder:text-muted-foreground/50 min-w-[90px] focus:ring-0 focus:text-foreground transition-all"
          style={{
            width: `${Math.max(inputValue.length * 8 + 20, 90)}px`,
          }}
          value={inputValue}
          onChange={(e) => {
            const val = e.target.value;
            setInputValue(val);
            setTypedValue(val);
            setShowSuggestions(true);
            setSelectedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            setTimeout(() => {
              setShowSuggestions(false);
              setSelectedIndex(-1);
              setInputValue("");
              setTypedValue("");
            }, 150);
          }}
          placeholder="+ add tag"
        />

        {showSuggestions && suggestions.length > 0 && (
          <Command
            className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-md shadow-xl min-w-[160px] z-50 overflow-hidden h-auto"
            value={selectedIndex >= 0 ? suggestions[selectedIndex].name : ""}
          >
            <CommandList>
              <CommandGroup>
                {suggestions.map((s) => (
                  <CommandItem
                    key={s.name}
                    value={s.name}
                    onSelect={() => addTag(s.name)}
                    className="flex items-center justify-between gap-4 cursor-pointer py-1"
                  >
                    <span className="font-medium text-[12px]">{s.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </div>
    </div>
  );
}
