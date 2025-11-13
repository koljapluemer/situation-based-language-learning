## Situation Editing – Internal Notes

### Guiding Principles
- Stays faithful to the data contract exported from `@sbl/shared`. Every UI change is routed through `ChallengeOfExpressionWriteInput` or `ChallengeOfUnderstandingTextWriteInput`, so the backend always receives the full replacement arrays it expects.
- Frontend never mutates relations directly in local state. Whenever a gloss changes (add, remove, edit), we rebuild the full challenge payload and PATCH the situation. This avoids partial updates that could desync Prisma’s nested rels.
- The CMS intentionally surfaces only English prompts for expression challenges (identifier = slug of ENG prompt). Other languages are optional today, so they appear as passive metadata inside the prompt array.

### Gloss Handling Rationale
- Glosses are globally shared; situations only attach by ID. Because of cycles (`contains`→`contains`), the DTO returns lightweight references (`GlossReference`) instead of embeddings. The dedicated `GlossTreeNode` lazily resolves children when expanded.
- The CMS never deletes a gloss while editing a situation unless the user explicitly asks to remove it from a challenge. Actual gloss deletion happens through the tree node’s delete button, which calls `/glosses/:id` and relies on cascading detachments.
- “Contains” expands recursively because curriculum designers rely on nested scaffolding (e.g., “conversation” contains “greeting” contains “hola”). Translations are limited to depth 1 so we don’t reintroduce cross-language recursion that UX cannot visualize cleanly.

### Gloss Deduplication Flow
- Prisma enforces `@@unique([language, content])` on `Gloss`. The modal mirrors that rule: as the user types, we hit `/glosses?language=X&content=Y` (exact) plus `/glosses/search` (fuzzy) with a debounce so we don’t hammer the DB.
- When an exact match already exists, we hide the metadata fields, change the primary CTA to “Attach existing gloss”, and emit the existing DTO so the caller simply connects the ID.
- Fuzzy matches show up as inline buttons under the content field. Clicking one immediately attaches the gloss and closes the modal. This keeps authors from re‑creating “hola” for every situation.

### Detach vs Delete Semantics
- Every tree row now has two separate controls:
  - Detach (chain/X icon) only removes the relation (from a challenge, `contains`, or `translations`). The resource itself stays in the catalog.
  - Delete (trash) first fetches `/glosses/:id/references`. If other contexts still rely on the gloss we show “Really delete… N references refer to this?” so the user understands the blast radius before issuing `DELETE /glosses/:id`.
- Top-level challenge rows pass `detachable` into `GlossTreeNode`, so removing a gloss from a challenge always happens via a regular PATCH on the situation—not by deleting the gloss outright.

### UI Structure
- `PageSituationView` owns the canonical TanStack Query cache for a single situation. Modals mutate by cloning the cached DTO, replacing arrays, and PATCHing; on success we invalidate the query to force a refetch. No optimistic writes because gloss resolution can change underlying data.
- Each challenge row (`ChallengeItemExpression` / `ChallengeItemUnderstanding`) is a `details` tree. Summaries show a single line (polite file-tree aesthetic) with inline icon controls, keeping the vertical rhythm predictable.
- The gloss section within a challenge delegates to `GlossTreeNode`. This component understands three use cases simultaneously: (1) inspect nested contains/translations, (2) attach brand new glosses via modal, and (3) edit/detach existing ones without leaving the tree.

### Language Controls
- The situation view exposes a single native-language dropdown (default `eng`). Changing it refetches the situation so every challenge tree is rebuilt for that learner language.
- Expression challenges are strictly native-language trees: top-level glosses and every `contains` descendant must be in the selected native language, while their translations are filtered/locked to the situation’s target language.
- Understanding challenges invert the rule: glosses plus recursive `contains` chains are locked to the situation’s target language, and their translations are filtered/locked to the selected native language so authors only see the learner-facing explanations they care about.

### Modal Responsibilities
- `GlossModal` is intentionally minimal: language/content plus the handful of gloss metadata we care about (`isParaphrased`, transcriptions, notes). It always posts to `/glosses` on “create” and returns the saved DTO. The caller decides what to do with the resulting `id` (e.g., attach it to a challenge or to another gloss relation).
- We only render brackets around the content input when `isParaphrased` is true. This enforces a visual convention that paraphrases are treated as paraphrases everywhere (both in lists and modals), so authors don’t forget the flag’s meaning.

### Why Recursive Contains, But Not Translations?
- Contains indicates conceptual scaffolding (“this gloss depends on these child glosses”). Designers need to keep drilling down until they hit primitives, and the recursion depth is unbounded, so the tree loads children lazily rather than materializing the full graph.
- Translations are a peer-to-peer relationship; deep recursion adds little value and clutters the UI. We show one hop to convey the translation set, but editing deeper translations is expected to happen through the dedicated gloss tooling, not within a single situation tree.

### Conflict Avoidance
- Because every PATCH replaces either entire challenge arrays or relation ID lists, concurrent edits could clobber each other. We mitigate by:
  - Always fetching fresh data before mutating relations (e.g., `attachGloss` reads the latest challenge from cache).
  - Invalidate the situation query on success, ensuring the next view reflects backend truth.
  - Rely on backend `409 Conflict` responses when Prisma’s unique constraints (e.g., `situationId + identifier`) trip; the UI surfaces those errors and prompts the user to refresh.

### Known Constraints / Future Considerations
- Gloss tree currently supports “contains” recursion only in the expression/understanding context. If other pages need the same explorer, extract it into a shared feature with optional relation toggles.
- Editing translations within the tree writes to `/glosses/:id`. This is fine for internal tooling, but productized flows might need permissions or batching.
- No batching of relation updates yet: every attach/detach makes a PATCH request. Keep this in mind if we notice performance bottlenecks with very large trees.
