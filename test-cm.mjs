import { markdown } from "@codemirror/lang-markdown";
import { parser } from "@lezer/markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags, highlightingFor } from "@lezer/highlight";

const tree = parser.parse("# Heading 1\n\nSome **bold** text");

let out = [];
tree.cursor().iterate(node => {
  out.push(`${node.name}: ${node.from}-${node.to}`);
});
console.log(out.join('\n'));
