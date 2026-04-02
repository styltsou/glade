## 1. Backend Changes

- [x] 1.1 Add created_at field to VaultEntry Rust type in src-tauri/src/types.rs
- [x] 1.2 Extract created_at from frontmatter in src-tauri/src/vault.rs
- [x] 1.3 Include created_at in VaultEntry serialization

## 2. Frontend Changes

- [x] 2.1 Add created_at to VaultEntry TypeScript type in src/types.ts
- [x] 2.2 Verify shadcn Tooltip is installed (bunx shadcn@latest add tooltip)
- [x] 2.3 Import Tooltip components in FileTreeNode.tsx
- [x] 2.4 Wrap file tree item with Tooltip and display created date
