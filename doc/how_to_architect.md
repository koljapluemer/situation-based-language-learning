- Adhere to FSD within each `frontend-*` folder:
  - Hierarchy:
    - `app/` for frontend-wide logic (very little)
    - `pages/` for pages, each page (=router route) gets its own folder in page. A page may have vue components in its folder. A page may NOT import from other pages. Instead, IF multiple pages needs to do the same thing, create a widget (IF!! needed only) or, more likely, a feature
    - `meta-features/`: works like pages, is for "meta features", aka functionality that needs to access multiple features. May ONLY import from features or below, not from other meta features or pages
    - `features/`: each subfolder should refer to entity/entities and a verb that would make sense in the user space, like "goal-add-glosses" or "resource-delete". May only import from entities, never upwards and never other features
    - `entities/`: actual entities, types, data repositiories. An entity may NEVER, under ANY circumstance, import another entity, this would break the architecture
    - `dumb/`: shared stuff. May NOT!!!!! contain business logic, only dumb components. May cross-import from `dumb/` but from NO OTHER FOLDER

    - `tasks/` a special folder (only within *cram*)with our learning tasks, insane amounts of idiosyncratic code & need to use meta-features and features, thus they are their own layer
