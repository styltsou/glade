import path from "path"; 
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";


const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
    resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),  
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    // A desktop app loads its bundle from disk, so size matters less than on
    // the web; split the heavy libraries so each chunk stays reasonable. Mermaid (the "diagrams" chunk) is the
    // largest and only loads when a diagram is used.
    chunkSizeWarningLimit: 3100,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
      output: {
        manualChunks(id: string) {
          // Vite's own helpers (module preload, CommonJS interop) are needed at startup.
          if (id.includes("vite/preload-helper") || id.includes("commonjsHelpers")) return "vendor";
          if (!id.includes("node_modules")) return undefined;
          if (/lowlight|highlight\.js/.test(id)) return "syntax";
          if (/codemirror|@lezer|@uiw\//.test(id)) return "codemirror";
          if (/prosemirror|@tiptap|tiptap-markdown|markdown-it/.test(id)) return "editor-core";
          if (/mermaid|cytoscape|katex|d3|dagre|elkjs|langium|chevrotain/.test(id)) return "diagrams";
          // Everything else (React, Radix, zustand…) goes in one shared chunk.
          // Left unassigned, Rollup would place shared modules inside whichever
          // heavy chunk uses them first, pulling that chunk into startup.
          return "vendor";
        },
      },
    },
  },
}));
