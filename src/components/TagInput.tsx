import { useState, useRef, useCallback } from "react";
import { Cross2Icon } from "@radix-ui/react-icons";
import { useVaultStore } from "@/stores/useVaultStore";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function TagInput({ tags, onChange }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const allTags = useVaultStore((s) => s.tags);

  // Filter suggestions based on input
  const suggestions = inputValue.trim()
    ? allTags
        .filter(
          (t) =>
            t.name.toLowerCase().includes(inputValue.toLowerCase()) &&
            !tags.includes(t.name),
        )
        .slice(0, 5)
    : [];

  const addTag = useCallback(
    (tag: string) => {
      const normalised = tag.trim().toLowerCase();
      if (normalised && !tags.includes(normalised)) {
        onChange([...tags, normalised]);
      }
      setInputValue("");
      setShowSuggestions(false);
    },
    [tags, onChange],
  );

  const removeTag = useCallback(
    (tag: string) => {
      onChange(tags.filter((t) => t !== tag));
    },
    [tags, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Tab" || e.key === ",") {
        e.preventDefault();
        if (inputValue.trim()) {
          addTag(inputValue);
        }
      } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
        removeTag(tags[tags.length - 1]);
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
        inputRef.current?.blur();
      }
    },
    [inputValue, tags, addTag, removeTag],
  );

  return (
    <div className="relative flex items-center gap-1.5 flex-wrap">
      {tags.map((tag) => (
        <span
          key={tag}
          className="group inline-flex items-center gap-1 px-2 py-[1px] rounded-md bg-muted/40 text-[12px] text-muted-foreground/60 border border-border/50 hover:border-border hover:bg-muted/60 transition-all cursor-default select-none"
        >
          {tag}
          <button
            onClick={() => removeTag(tag)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0 hover:text-foreground"
          >
            <Cross2Icon className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}

      <input
        ref={inputRef}
        className="bg-transparent border-none outline-none text-[12px] text-muted-foreground/60 placeholder:text-muted-foreground/25 min-w-[60px] w-auto focus:ring-0 focus:text-muted-foreground"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          setShowSuggestions(true);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => {
          // Delay to allow click on suggestion
          setTimeout(() => setShowSuggestions(false), 150);
        }}
        placeholder="+ add tag"
      />

      {/* Autocomplete suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-md py-1 min-w-[140px] z-20">
          {suggestions.map((s) => (
            <button
              key={s.name}
              className="w-full text-left px-3 py-1 text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur
                addTag(s.name);
              }}
            >
              <span>{s.name}</span>
              <span className="text-muted-foreground/30 ml-1.5">({s.count})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
