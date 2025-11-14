# Understanding Text Practice Flow

## Overview

`PagePracticeUnderstandingText.vue` implements a spaced repetition practice system for understanding target language text. It uses Ebisu for intelligent scheduling and enforces dependency-based learning (components before compounds).

## Data Loading (onMounted)

1. **Fetch Situation**: Load situation from Dexie by identifier
2. **Extract Challenge Glosses**: Get `challengesOfUnderstandingTextIds` array (main texts to understand)
3. **Collect All Dependencies**: Recursively collect all gloss IDs including:
   - Challenge glosses
   - All their `containsIds` (recursive, unlimited depth)
4. **Load All Glosses**: Fetch all glosses from Dexie and store in a Map

## Practice Flow

### Phase 1: Component Practice (Dependencies First)

The system practices **only the dependency glosses**, not the challenge glosses themselves.

**Selection Logic** (`selectNextGloss`):
1. **Exclude challenge glosses** - These are reserved for the final test
2. **Exclude last practiced gloss** - Prevents immediate repetition
3. **Check recall threshold** - Skip if recall e 0.95
4. **Check dependencies** - Only practice if all `containsIds` have recall e 0.8
5. **Randomize** - Pick random gloss from eligible set using `Math.random()`

**Task Type Selection** (`generateNextTask`):
- **If no `progressEbisu`**: Use `task-gloss-try-to-remember` (first exposure)
  - Shows gloss with all notes and translations
  - User clicks "Done" when ready
  - Initializes Ebisu model `[3, 3, 24]`
- **If `progressEbisu` exists**: Use `task-gloss-reveal` (spaced review)
  - Shows gloss, hides translations initially
  - User clicks "Reveal" to see translations
  - User rates difficulty (1-4)
  - Updates Ebisu model using `updateRecall`

### Phase 2: Final Challenge

When **all challenge glosses** have recall e 0.95, the system presents the final test.

**Final Task** (`generateGuessWhatGlossMeans`):
- Picks a **random challenge gloss** (the main sentence/text)
- Shows the target language text
- User types what they think it means
- Reveals translation for comparison
- User clicks "Done" to complete

### Phase 3: Completion

After completing the final challenge, shows completion screen with:
- Practice complete message
- "Practice Again" button (resets state)
- "Back to Situations" button

## Key Algorithms

### Dependency Enforcement (`areDependenciesMet`)

```
For each gloss:
  If it has no contains ’ dependencies met
  For each containsId:
    If gloss not loaded ’ dependencies not met
    If recall < 0.8 ’ dependencies not met
  All checks passed ’ dependencies met
```

**Example**: To practice "¿Cómo estás?" you must first practice "cómo" and "estás" until they reach 0.8 recall.

### Readiness Check (`allGlossesReady`)

```
If no challenge glosses ’ not ready
For each challenge gloss:
  If gloss not loaded ’ not ready
  If recall < 0.95 ’ not ready
All checks passed ’ ready for final challenge
```

### Progress Updates (`handleTaskFinished`)

1. **Reload practiced gloss** from Dexie (gets updated `progressEbisu`)
2. **Update Map** with fresh gloss data
3. **Check if final challenge** - If yes and all ready, mark complete
4. **Generate next task** - Continue practice flow

## Ebisu Integration

### Model Structure
```typescript
progressEbisu: {
  model: [alpha, beta, t],  // Ebisu parameters
  lastReviewed: Date        // Last practice timestamp
}
```

### Recall Calculation
```typescript
recall = ebisu.predictRecall(model, hoursSinceReview, true)
```

### Model Updates
- **Initial**: `[3, 3, 24]` (uncertain, 24-hour half-life)
- **After rating**: `ebisu.updateRecall(model, successProb, 1, hoursSinceReview)`
  - Rating 1 ’ 0.2 success probability
  - Rating 2 ’ 0.4 success probability
  - Rating 3 ’ 0.7 success probability
  - Rating 4 ’ 0.95 success probability

## Example Flow

**Situation**: "Greeting a friend" with challenge gloss "¿Cómo estás?"
- Contains: ["¿Cómo", "estás", "?"]

**Practice Sequence**:
1. **Try to Remember**: "¿Cómo" (no dependencies)
2. **Try to Remember**: "estás" (no dependencies)
3. **Try to Remember**: "?" (no dependencies)
4. *User practices these until recall e 0.95*
5. **Reveal tasks**: Continue practicing components with ratings
6. **All components reach 0.95 recall**
7. **Final Challenge**: "¿Cómo estás?" (guess what it means)
8. **Complete**

## State Management

### Refs
- `allGlosses`: Map of all glosses (challenge + dependencies)
- `challengeGlossIds`: Array of main text IDs (final challenge only)
- `currentTask`: Current task being practiced
- `lastPracticedGlossId`: Prevents immediate repetition
- `isComplete`: Practice session finished

### Computed
- `allGlossesReady`: All challenge glosses have recall e 0.95

## Error Handling

- **Situation not found**: Shows error, "Go Back" button
- **No understanding glosses**: Shows error message
- **No glosses loaded**: Shows error message
- **No eligible glosses**: Marks complete (shouldn't happen if logic correct)

## Exit Points

1. **Exit button** in task instruction bar ’ Back to situations
2. **Go Back** button in error state ’ Back to situations
3. **Back to Situations** button in completion screen
4. **Practice Again** button ’ Resets state, regenerates first task
