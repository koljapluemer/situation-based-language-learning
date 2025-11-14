- `src/frontend-cram/pages/practice-understanding-text/PagePracticeUnderstandingText.vue` is currently a proof of concept; let's make it a real, working, useful practice mode

- goal: to practice all glosses related to the passed in challenge in a useful order until they are well understood, then do the challenge itself  


- use [ebisu](https://github.com/fasiha/ebisu.js) and the optional `ebisuProgress?` prop on the [gloss model](src/frontend-cram/entities/gloss/types.ts) to track per-user progress
- we are ready for the challenge if all glosses (and their recursively `contains` glosses) can be recalled with a probability of >0.95
- If a gloss has not been seen yet (no `ebisuProgress` prop), use `src/frontend-cram/tasks/task-gloss-try-to-remember` (needs to be adapted to work with gloss)
- Otherwise, use `src/frontend-cram/tasks/task-gloss-reveal` (needs to be adapted)
- We want to practice the glosses in a useful order: First, the learner should learn the components a gloss is made of, only then the gloss itself. Enfore that by only allowing the practicing of a gloss if all its `contains` glosses can be recalled with a probability of >=0.8
- generally, RANDOMIZE (yes, actually, truly, using Math.random, randomize) which gloss is picked within the allowed conditions
- prevent the same gloss coming up twice in a row

- as you can see, for the tasks, we want to render gloss in different contexts and modes. Build out `src/frontend-cram/features/gloss-view/GlossRenderer.vue` with a similar look & feel to the inspiration `doc/inspiration/VocabRenderer.md`
- These are tasks of *understanding*: Therefore, always first show the TARGET LANGUAGE gloss, and then reveal (and show on the side of the gloss card) translations in the user's NATIVE LANGUAGE. See `doc/instructions/002_language_logic_in_situation_editing.md` and `doc/components/situation-editing.md` for understanding of the data we are getting here.
- Present the final challenge with `src/frontend-cram/tasks/task-guess-what-gloss-means` (needs to be adapted)
- you may want to edit the [gloss model](src/frontend-cram/entities/gloss/model.ts) e.g. with a scoring function or getDue function if needed; try to do especially memory-intensive things with the DP API (as opposed to getting all, then filtering)
- STICK TO!!!!!!!!!!!!! `doc/how_to_design.md` and `doc/how_to_architect.md`