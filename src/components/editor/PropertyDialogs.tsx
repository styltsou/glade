import { useEffect, useState } from "react";
import { useStore } from "@/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Add one property; creates the frontmatter block only now if the note has none. */
export function AddPropertyDialog() {
  const open = useStore((s) => s.addPropertyOpen);
  const setOpen = useStore((s) => s.setAddPropertyOpen);
  const setProperty = useStore((s) => s.setProperty);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setKey("");
      setValue("");
      setError("");
    }
  }, [open]);

  const submit = async () => {
    if (!key.trim()) return;
    try {
      await setProperty(key.trim(), { kind: "scalar", value });
      setOpen(false);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add property</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2" onKeyDown={(e) => e.key === "Enter" && submit()}>
          <Input autoFocus placeholder="Name (e.g. status)" value={key} onChange={(e) => setKey(e.target.value)} />
          <Input placeholder="Value" value={value} onChange={(e) => setValue(e.target.value)} />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!key.trim()} onClick={submit}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Edit the frontmatter block as plain text (also how a broken block gets fixed). */
export function EditFrontmatterDialog() {
  const open = useStore((s) => s.editFrontmatterOpen);
  const setOpen = useStore((s) => s.setEditFrontmatterOpen);
  const yaml = useStore((s) => s.activeNote?.properties?.yaml ?? "");
  const setFrontmatterText = useStore((s) => s.setFrontmatterText);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setText(yaml);
      setError("");
    }
  }, [open, yaml]);

  const save = async () => {
    try {
      await setFrontmatterText(text);
      setOpen(false);
    } catch (e) {
      setError(String(e).includes("not valid YAML") ? "This isn't valid YAML yet, so it wasn't saved." : String(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit properties as text</DialogTitle>
        </DialogHeader>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          className="h-64 w-full rounded-md border border-border bg-transparent p-3 font-mono text-sm outline-none focus:border-ring"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
