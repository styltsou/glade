## ADDED Requirements

### Requirement: Pinned notes section SHALL be collapsible
The sidebar's pinned notes section MUST have a toggle mechanism that allows users to collapse or expand the section.

#### Scenario: User collapses pinned notes
- **WHEN** user clicks the chevron/toggle icon next to "Pinned Notes" header
- **THEN** the pinned notes list hides and the chevron rotates to indicate collapsed state

#### Scenario: User expands pinned notes
- **WHEN** user clicks the chevron/toggle icon next to collapsed "Pinned Notes" header
- **THEN** the pinned notes list becomes visible and chevron rotates to indicate expanded state

#### Scenario: Pinned notes collapsed state persists
- **WHEN** user collapses pinned notes section and refreshes the app
- **THEN** the pinned notes section remains collapsed

### Requirement: Pinned notes items SHALL have consistent styling with file tree notes
The pinned notes items in the sidebar MUST use the same styling (spacing, typography, hover states) as notes items in the file tree for visual consistency.

#### Scenario: Pinned notes match file tree styling
- **WHEN** user views the pinned notes section in the sidebar
- **THEN** each pinned note item has identical padding, font size, color, and hover background as file tree note items

#### Scenario: Hover state consistency
- **WHEN** user hovers over a pinned note item
- **THEN** the hover background color and cursor match the file tree note items