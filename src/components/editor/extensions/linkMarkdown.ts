import { defaultMarkdownSerializer } from "@tiptap/pm/markdown";
import { repairSavedUrls } from "./repairSavedUrls";

const link = defaultMarkdownSerializer.marks.link as any;

/**
 * A URL saved as `<https://...>` is literal. tiptap-markdown escapes it anyway,
 * writing backslashes into any URL with `_` or `*` each time a note is saved.
 */
export const linkMarkdown = {
  parse: { setup: repairSavedUrls },
  serialize: {
    ...link,
    open(state: any, mark: any, parent: any, index: number) {
      const opened = link.open(state, mark, parent, index);
      if (state.inAutolink) state.esc = (text: string) => text;
      return opened;
    },
    close(state: any, mark: any, parent: any, index: number) {
      delete state.esc;
      return link.close(state, mark, parent, index);
    },
  },
};
