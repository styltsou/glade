import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { useTheme } from "next-themes";

interface RawEditorProps {
  content: string;
  onChange: (value: string) => void;
}

// Define custom highlighting style based on app CSS variables
const customHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--syntax-keyword)" },
  { tag: tags.string, color: "var(--syntax-string)" },
  { tag: tags.comment, color: "var(--syntax-comment)", fontStyle: "italic" },
  { tag: tags.number, color: "var(--syntax-number)" },
  { tag: tags.function(tags.variableName), color: "var(--syntax-function)" },
  { tag: tags.variableName, color: "var(--syntax-parameter)" },
  { tag: tags.propertyName, color: "var(--syntax-keyword)" },
  { tag: tags.labelName, color: "var(--syntax-keyword)" },
  { tag: tags.heading, fontWeight: "bold", color: "var(--foreground)" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.link, color: "var(--primary)", textDecoration: "underline" },
  { tag: tags.url, color: "var(--primary)", opacity: 0.7 },
  { tag: tags.list, color: "var(--muted-foreground)" },
  { tag: tags.quote, color: "var(--muted-foreground)" },
  { tag: tags.processingInstruction, color: "var(--syntax-comment)" }, // Frontmatter
]);

// Base theme to handle editor appearance
const baseTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent !important",
    width: "100% !important",
  },
  ".cm-content": {
    padding: "0 !important",
    whiteSpace: "pre-wrap !important",
    wordBreak: "break-word !important",
    caretColor: "var(--foreground)",
  },
  ".cm-line": {
    padding: "0 !important",
    color: "var(--foreground)",
  },
  ".cm-scroller": {
    overflow: "visible !important",
    fontFamily: "var(--font-mono)",
  },
  "&.cm-focused": {
    outline: "none",
  },
});

export function RawEditor({ content, onChange }: RawEditorProps) {
  const { resolvedTheme } = useTheme();

  const extensions = useMemo(() => [
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    EditorView.lineWrapping,
    syntaxHighlighting(customHighlightStyle),
    baseTheme,
  ], []);

  return (
    <div className="codemirror-container">
      <CodeMirror
        value={content}
        height="auto"
        minHeight="500px"
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        extensions={extensions}
        onChange={(value) => onChange(value)}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
          highlightSelectionMatches: false,
        }}
        className="text-[14px] leading-[1.7]"
      />
    </div>
  );
}
