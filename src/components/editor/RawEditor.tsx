interface RawEditorProps {
  content: string;
  onChange: (value: string) => void;
}

export function RawEditor({ content, onChange }: RawEditorProps) {
  return (
    <textarea
      className="w-full h-[calc(100vh-280px)] bg-transparent text-[14px] leading-[1.7] font-mono text-foreground resize-none focus:outline-none placeholder:text-muted-foreground"
      value={content}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Write raw markdown…"
      spellCheck={false}
    />
  );
}
