# Future Enhancement: Conflict Detection

## Current State
- TanStack Query provides automatic refetching on window focus (30s stale time)
- Mutations show loading states and error toasts
- 409 conflict errors are caught and displayed to users

## What's Missing for Full Conflict Detection
To implement proper optimistic locking and conflict detection, the backend would need:

1. **Add `updatedAt` to SituationDTO**
   ```ts
   interface SituationDTO {
     identifier: string;
     descriptions: LocalizedString[];
     challengesOfExpression: ChallengeOfExpression[];
     challengesOfUnderstandingText: ChallengeOfUnderstandingText[];
     updatedAt: string; // ISO 8601 timestamp
   }
   ```

2. **Implement optimistic locking in PATCH endpoint**
   - Accept `If-Match` header or `updatedAt` in request body
   - Return 409 if `updatedAt` doesn't match current version
   - Return 412 Precondition Failed if conditions not met

3. **Frontend changes**
   - Store `updatedAt` from queries
   - Send `updatedAt` with mutations
   - On 409/412, refetch and show conflict UI
   - Offer: "Overwrite" or "Cancel and reload"

## Current Mitigation
- Window focus refetching helps users see recent changes
- Mutations lock UI during saves
- Clear error messages guide users to refresh
- Last-write-wins is acceptable for single-user CMS use case

## When to Implement
- When multiple concurrent editors are actively using the CMS
- When data loss from conflicts becomes a real problem
- Estimated effort: 4-6 hours (backend + frontend)
