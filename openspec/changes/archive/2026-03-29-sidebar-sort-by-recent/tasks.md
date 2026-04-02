## 1. Implementation

- [x] 1.1 Modify `sortEntries()` in `src/components/sidebar/file-tree-helpers.ts` to sort files by `modified` timestamp (descending)
- [x] 1.2 Handle `null` modified timestamps by sorting them at the top (as newest)

## 2. Testing (verify manually)

- [ ] 2.1 Verify directories still sort alphabetically and appear first
- [ ] 2.2 Verify files sort by most recent modified
- [ ] 2.3 Verify unsaved new notes (null modified) appear at the top with newest
