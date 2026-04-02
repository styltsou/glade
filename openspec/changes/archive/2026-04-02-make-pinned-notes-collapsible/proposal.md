## Why

The sidebar has two main sections: pinned notes and tags. The tags section is collapsible, allowing users to hide it when not needed. The pinned notes section is always visible, which takes up unnecessary space when users have many pinned notes or don't use them frequently. Additionally, the styling of pinned notes items differs from the file tree notes, creating visual inconsistency.

## What Changes

- Make the pinned notes section collapsible in the sidebar with a toggle chevron
- Apply the same styling (spacing, typography, hover states) to pinned notes items as used in the file tree notes items for visual consistency

## Capabilities

### New Capabilities
- `collapsible-pinned-notes`: Make the pinned notes section in the sidebar collapsible, matching the behavior of the tags section

### Modified Capabilities
- None - this is a UI enhancement without requirement changes to existing capabilities

## Impact

- UI component changes in the sidebar
- No API or data model changes
- Affects user-facing sidebar component only