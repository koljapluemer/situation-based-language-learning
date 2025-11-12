- let's add an icon to each row of `src/frontend-cms/pages/situations-list/PageSituationsList.vue` (eye), allowing us to "view" a situation
- this view should be an expandable tree view of the `challengesOfUnderstandingText` and `challengesOfExpression`
- layout/UI wise, the legacy `/home/b/GITHUB/situation-based-language-learning/doc/inspiration/GoalTree.md` and `doc/inspiration/GoalTreeItem.md` may serve as inspiration
- both these challenge lists should be expandable headings
- both should have a button "Add * Challenge" that opens a modal (similar to `src/frontend-cms/features/situation-create/ModalCreateSituation.vue` in look and feel) to simply add a challenge 
  - for expression challenges, ONLY include the `prompt` prop, glosses should be initialized empty
  - for understanding challenges, allow selecting the language (let's build a standardized `src/shared/Language.ts` dropdown select also in `src/shared`) and the `text`

That's the whole tree for now, we will add more later, focus on the above for now. Stick closely to `doc/how_to_architect.md` and `doc/how_to_design.md`