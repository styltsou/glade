# Known Issues

This document tracks persistent issues or UI polish items that are currently deferred.

## 1. Title Area Flicker
- **Description**: A flicker sometimes occurs when the mouse is near the "bottom border" of the title area or the border of the content container.
- **Status**: Investigated but root cause (likely sub-pixel layout or event bubbling) is not yet fully identified.
- **Notes**: Moving tags closer improved the hit area, but the underlying flicker remains intermittent.

## 2. In-place Title Edit Shift
- **Description**: Switching to edit mode causes a slight (1-2px) visual shift in position.
- **Roots**:
  - The input height is slightly larger than the static typography.
  - The left padding/offset in the input doesn't perfectly match the display text's alignment.
- **Status**: Deferred. Requires exact pixel-perfect match of input styles to H1 styles.

## 3. Broken Functionality: Copy Markdown & Export
- **Description**: The "Copy Markdown" and "Export" features currently do not work as expected or produce errors.
- **Status**: Identified. Requires backend connection verification and potential permission/path adjustments.

## 4. Double Scrollbars in Raw Mode
- **Description**: When viewing a note in Raw Markdown mode, the `textarea` has its own internal scrollbar which conflicts with the editor's main scrollbar.
- **Status**: UI Polish item. Requires refining the container overflow or using a non-nested scrollable area.
