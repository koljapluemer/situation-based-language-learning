# Claude Code Instructions

This document provides guidance for AI assistants (particularly Claude) working on this codebase.

## Project Overview

This is a **monorepo** for a situation-based language learning application with:
- **Backend**: Fastify + Prisma + PostgreSQL API (`src/backend`)
- **Frontend CMS**: Vue 3 + Vite content management system (`src/frontend-cms`)
- **Frontend CRAM**: Vue 3 + Vite learner application (`src/frontend-cram`)
- **Shared**: TypeScript DTOs and types (`src/shared`)

## Critical: Build, Don't Run Dev Servers

**IMPORTANT**: When testing or verifying changes, use **build commands**, not dev servers:
- ✅ `npm run cms:build` - builds and type-checks the CMS
- ✅ `npm run backend:build` - compiles the backend
- ❌ `npm run cms:dev` - don't leave this running in background
- ❌ `npm run backend:dev` - don't leave this running in background

Dev servers can cause issues in automated environments. Always build to verify correctness.

## Architecture (Feature-Sliced Design)

Each `frontend-*` folder follows **FSD hierarchy** (top imports from bottom only):

```
app/          - App-wide setup (router, main.ts)
pages/        - Route components, each in own folder
              - May NOT import from other pages
meta-features/ - Cross-feature functionality (imports features only)
features/     - User-facing features (e.g., "situation-create")
              - Named: entity + verb (e.g., "goal-add-glosses")
              - May NOT import other features or pages
entities/     - Data types, repositories
              - May NEVER import other entities
dumb/         - Shared UI components (NO business logic)
              - May only cross-import from dumb/
tasks/        - (cram only) Learning tasks with special privileges
```

### Key Rules
- Never break the import hierarchy
- Features are isolated from each other
- Entities never import entities
- Dumb components have zero business logic

## Design System

### Stack
- **CSS Framework**: Tailwind CSS + DaisyUI components
- **Icons**: lucide-vue-next
- **Forms**: Standard HTML inputs with DaisyUI classes

### Design Guidelines

1. **Layout**
   - App.vue already has container + flex layout
   - Don't wrap pages in unnecessary containers
   - Every page should have an `h1` at the top
   - Don't add classes to headings

2. **Cards**
   - Use sparingly, only when needed
   - Classes: `card shadow` (nothing else unless required)
   - Always include `card-body` for content
   - Hover effect: `transition-hover hover:shadow-md` (if clickable)
   - `card-title` must be within `card-body`

3. **Spacing**
   - Prefer `grid` and `flex` over `space-*`
   - Use spacing values: `1`, `2`, `4`, `6`

4. **Typography**
   - No gray text - use `text-light` for de-emphasis
   - Don't use excessive subheadings or redundant labels

5. **Forms**
   - Standard pattern:
     ```vue
     <fieldset class="fieldset">
       <label for="input-id" class="label">Label Text</label>
       <input type="text" name="input-id" class="input" placeholder="..." />
     </fieldset>
     ```

6. **Buttons**
   - Use standard sizes unless special case
   - Avoid random size variations

7. **Color**
   - Use sparingly
   - Only for primary elements or communicative needs (warnings, etc.)

8. **Before Implementing**
   - Look for similar existing components
   - Copy their styles and approach

9. **Responsive**
   - Ensure layouts work on mobile AND desktop

10. **Custom Styles**
    - Use `@apply` in App.vue for recurring complex styles

### Philosophy
**KEEP. IT. SIMPLE.**

## Workspace Structure

This is an **npm workspaces** monorepo:
- Root `package.json` orchestrates workspaces
- Install dependencies: `npm install --workspace @sbl/frontend-cms`
- Never install at root level (except workspace-wide tools)

### Available Workspaces
- `@sbl/shared` - Shared types/DTOs
- `@sbl/backend` - Fastify API
- `@sbl/frontend-cms` - CMS app
- `@sbl/frontend-cram` - Learner app

### Module Format
All packages use **ESM** (`"type": "module"`):
- Use `import`/`export`, never `require()`
- Shared builds to ESNext modules
- TypeScript: `"module": "ESNext"`, `"moduleResolution": "Bundler"`

## Data Flow & State Management

### Current Stack
- **TanStack Query** (Vue Query) for server state
  - 30s stale time
  - Refetch on window focus (for concurrent users)
  - Automatic cache invalidation
  - Optimistic updates

### Query Configuration
```typescript
// Already configured in main.ts
{
  staleTime: 30 * 1000,
  refetchOnWindowFocus: true,
  retry: 1,
}
```

### Mutation Pattern
```typescript
const mutation = useMutation({
  mutationFn: async (data) => {
    const response = await fetch(url, { method: 'PATCH', ... });
    if (!response.ok) {
      if (response.status === 409) {
        throw new Error("Conflict: ...");
      }
      throw new Error(`Failed: ${response.status}`);
    }
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['resource', id] });
    toast.success('Success message');
  },
  onError: (error) => {
    toast.error(error.message);
    if (error.message.includes("Conflict")) {
      queryClient.invalidateQueries({ queryKey: ['resource', id] });
    }
  },
});
```

### Conflict Detection
- 409 status codes trigger refetch
- See `doc/instructions/001_future_conflict_detection.md` for full optimistic locking strategy
- Current approach: last-write-wins with refresh on conflict

## API Integration

### Backend API
- Base URL: `http://localhost:3333` (override with `VITE_API_URL`)
- All responses: `{ "data": <DTO> }` or `{ "error": string }`
- See `src/backend/API.md` for full documentation

### Common Patterns
```typescript
// Fetch
const { data, isLoading, error } = useQuery({
  queryKey: ['resource', id],
  queryFn: async () => {
    const response = await fetch(`${API_BASE_URL}/resource/${id}`);
    if (!response.ok) throw new Error('...');
    const payload = await response.json();
    return payload.data;
  },
});

// Create/Update
const mutation = useMutation({
  mutationFn: async (newData) => {
    const response = await fetch(`${API_BASE_URL}/resource`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newData),
    });
    if (!response.ok) throw new Error('...');
  },
});
```

## Common Components

### LanguageSelect
Reusable language dropdown:
```vue
<LanguageSelect v-model="language" />
```
- Located: `src/frontend-cms/dumb/LanguageSelect.vue`
- Uses `LANGUAGES` from `@sbl/shared`

### Toasts
```typescript
import { useToast } from '../../dumb/toasts/index';
const toast = useToast();

toast.success('Operation succeeded');
toast.error('Operation failed');
```

## Testing Changes

### Build Order
```bash
npm run shared:build    # Build shared types first
npm run cms:build       # Build and type-check CMS
npm run backend:build   # Compile backend
```

### Common Errors

**"X is not exported by shared"**
- Solution: Rebuild shared module: `npm run shared:build`

**TypeScript errors about module format**
- Ensure all packages are `"type": "module"`
- Ensure tsconfig uses `"module": "ESNext"`

**Import path errors**
- Use `@sbl/shared` not relative paths to shared
- Use proper workspace imports

## Git Workflow

- Write descriptive commit messages (focus on "why")
- End with:
  ```
  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  Co-Authored-By: Claude <noreply@anthropic.com>
  ```
- Never commit secrets (.env, credentials.json)
- Only commit when user explicitly requests

## Key Decisions & Patterns

### Why TanStack Query?
- Concurrent user support required
- Automatic stale data refetching
- Built-in optimistic updates
- Cache management out of the box
- Reduces boilerplate for loading/error states

### Why ESM Everywhere?
- Modern standard
- Better tree-shaking
- Native browser support
- Tooling (Vite) works best with ESM

### Why FSD Architecture?
- Prevents circular dependencies
- Clear import rules
- Scales well as project grows
- Features remain isolated and testable

## Resources

- Architecture: `doc/how_to_architect.md`
- Design: `doc/how_to_design.md`
- API Docs: `src/backend/API.md`
- Setup: `README.md`

## Quick Reference

```bash
# Install dependency
npm install <package> --workspace @sbl/frontend-cms

# Build everything
npm run shared:build && npm run cms:build && npm run backend:build

# Database
npm run prisma:migrate:dev
npm run prisma:seed

# Type check only
cd src/frontend-cms && npx vue-tsc --noEmit
```

---

**Remember**: Build, don't dev. Keep it simple. Follow FSD. Use TanStack Query for server state.
