# ActionBar

The ActionBar is a fairly complex UI element which should be used for the (main) interaction of all tasks going forward.
It has its own strong design language, using color-primary and color secondary, little white, and thick lines.

It communicates via props and emits.
Since tasks have quite complex demands, there is a lot of custom logic in it.

## Main Elements

### Central Element

This is the most complex element, and we will not avoid putting tons of bespoke code here, allowing input, multiple inputs, textareas, buttons.

It's positioned centrally and poes out the top of the action bar a little

### Central Element Header

Optionally, sometimes, we need a small multi-state-toggle above the central element.
It should be made out of buttons directly next to each other, behaving like radio buttons (only one at a time can be activated).
This can e.g. be used by same tasks to toggle the central element between audio recording and text input.

Allow to pass a `str` or a lucide-icon-name, or both, as the content of each button (this type should be used for almost all button content on the ActionBar).

**Control Type:** `ToggleButtonGroupControl`
- Uses DaisyUI `join` and `join-item` classes for joined buttons
- Each option can have an icon (Lucide icon name), label, or both
- Emits the selected option ID when clicked
- Only one option can be selected at a time (radio button behavior)

Example usage:
```typescript
{
  type: 'toggle-button-group',
  id: 'mode-toggle',
  position: 'central-header',
  options: [
    { id: 'text', icon: 'pencil', label: 'Write' },
    { id: 'audio', icon: 'microphone', label: 'Record' }
  ],
  selectedId: 'text'
}
```

### Central Element Footer

Sometimes, we also need an element centrally below the central element.

This is always an array of buttons, somewhat small but not tiny.
This can e.g. be used to add a "Done" button below a text input in the central element.

**Supported Control Types:**
- `ButtonControl` with `position: 'central-footer'`
- `IconButtonControl` with `position: 'central-footer'`

Example usage:
```typescript
{
  type: 'button',
  id: 'done',
  label: 'Done',
  position: 'central-footer',
  disabled: false
}
```

### Left Element

An array of small buttons to the left and a bit down.
Per default, it contains icon-only buttons for:
- `skip` (can be hidden with prop `hide-skip-button`)
- `disable` (can be hidden with prop `hide-disable-button`)
- `jump-to` (meaning e.g. opening the vocab edit page of the vocab used for the tasks; can be hidden wih prop `hide-jump-to-button`)

These are fairly universal actions, allthough they still should simply emit events and the tasks themselves have the requirement to handle it, b/c what should actually happen when clicked is quite variied.

It is also possile to to pass additional buttons into the left element.

### Right Element

Like the left element, but optional; the user can pass in buttons, otherwise it simply stays hidden.
The special thing here is that the buttons are actually toggles, acting like checkboxes.
This should be designed in an obvious way fitting with the rest of the ActionBar design.

This may e.g. be used to mark that after the current extract-from-resource task, the resource should be marked finished.

## Special Control Types

### RecordButtonControl

A specialized button for audio recording functionality in the central element.
- Displays a microphone icon when not recording (primary color)
- Displays a square/stop icon when recording (error/red color)
- Large circular button (btn-xl btn-circle)
- Toggles recording state when clicked

Example usage:
```typescript
{
  type: 'record-button',
  id: 'record',
  position: 'central',
  isRecording: false
}
```

### AudioPlayerControl

A control for playing back recorded audio in the central element.
- Displays a play button (large circular)
- Shows audio duration below the button
- Disables while audio is playing (shows spinner)
- Automatically creates and manages audio URLs from blob

Example usage:
```typescript
{
  type: 'audio-player',
  id: 'play-recording',
  position: 'central',
  audioBlob: recordedBlob,
  duration: 15.5  // in seconds
}
```

