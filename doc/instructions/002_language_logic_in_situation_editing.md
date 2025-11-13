Language logic in `src/frontend-cms/pages/situation-view/PageSituationView.vue` is complex and must work EXACTLY.

Read the following requirements in DETAIL and implement them AS WRITTEN.
No "oh I'm sure he meant it in a different way, no, AS WRITTEN".

We require some complex, filtered, conditional recursion, so make a working, non-hacky, well-implemented, edge-case proof plan first.

Read upon the current state (possibly slightly outdated) [here](doc/components/situation-editing.md).

## Basics

1) A situation ALWAYS has exactly one target language. We will call this situation-bound target language "target language" from now on and mean EXACTLY THAT
2) The CMS users has to set EXACTLY one "native language" in the UI of `PageSituationView`. This "native language" is always set, it defaults to "eng"/"English"

## Locking

Now, we must do complex filtering and presetting based on this. Yes, this DEPENDS on a lot of specific context, so listen closely.

### Challenges of Expression

Everything in the list of these expression challenges ([type](src/shared/ChallengeOfExpression.ts)) is meant as in: "native language expressions that the user has to be able to translate into their target language".

Therefore:

1) any kind of gloss added to this kind of challenge is LOCKED to be in the selected *native language*
2) any kind of gloss added into the `contains` array is ALSO LOCKED to the *native language*. This should work recursively down and down into `contains`.
3) Now, these glosses have translations. Adding a translation to any such gloss in this tree is locked to THE *target language* (yes, the *target* language). 


### Challenges of Understanding Text

Now, in the list of understanding text ([type](src/shared/ChallengeOfUnderstandingText.ts)), we have the INVERSE setup.

Any type of gloss added to any of these challenges is locked to the TARGET LANGUAGE, because this is for expressions in the *target language* that the user must learn to understand.

Their `contains` arrays, again, recursively, are also locked to the *target language*, because we're e.g. describing what target language words a target language sentence is made from.

However, any `translations` of those are locked to the *native language*, because we're now describing how these are, well, translated into the user's *native language*. therefore, anywhere in this tree, translations need to be locked to the selected *native language*

## Filtering

Now, based on this locking, it's pretty obvious what we want to *filter*:


- in challenges of expression, hide any top-level glosses that are not in the *native language*. The same applies recursively to glosses in their `contains` arrays.
- in challenges of expression, hide any `translations` (from anywhere in the tree) that are not in the *target language*.

- in challenges of understanding, hide any top-level glosses that are not in situation's target language. They shouldn't exist anyway. The same applies recursively to their `contains` arrays.
- in challenges of understanding, hide any `translations` (from anywhere in the tree) that are not in the *native language*

Changing the selected native language via the dropdown should refresh the tree.