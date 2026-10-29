# TS-18: a hotkey for Suggest text

## What is asked, and by whom

Asked by Darren, 2026-10-30: 'new feature "hotkey" for Suggest Test'. Read as Suggest text, the
per-region button from TS-17. Answers to Q1 to Q3 given the same day (see "Decided").

## Found in the code (main 7a6dfae, 2026-10-30)

- Suggest text is a per-row button in `RegionList.tsx`. Its handler (`handleSuggest`) owns the
  "Suggesting…" state, the double-click guard (`disabled` while running) and the per-row error.
- Page hotkeys live in one `keydown` listener in `AnnotationCanvas.tsx`. It returns early when
  focus is in a text field (`isTypingTarget`).
- Bare letters and digits are all label hotkeys (`hotkeys.ts`). `[` `]` `Esc`, arrows,
  Delete/Backspace, Ctrl/⌘+Z/Y are taken.
- Selecting a region focuses its transcription field (TS-14). So right after drawing or picking a
  region, focus is in a text field and the page listener ignores every key.
- `applySuggestedText` overwrites the region's text. Text edits are not on the undo stack.
- No existing binding uses Alt (`altKey` appears nowhere in `src/`).

## Decided (Darren, 2026-10-30)

1. **Key: Ctrl+Alt+S** (Ctrl+Option+S on Mac). Darren: "i worry hotkey clash with common
   hotkeys. maybe try crtl+alt+S". Matched on the physical key (`KeyS`), since Option+S on a Mac
   types `ß` and so `e.key` is not `s`. ⌘ is not used.
2. **Overwrite** existing text, as the button does. Darren: "just overwrite".
3. **Focus stays in the field** after the text arrives. Darren: "stay in the field after text
   comes in".

## Proposed (Claude; Darren can overturn)

4. **Target: the selected region.** Works with focus in its field or not. No region selected:
   the key does nothing.
5. **Same path as the button.** The key calls the row's own `handleSuggest`, so the button shows
   "Suggesting…", errors show under the row, and a second press while one runs is ignored.
6. **Shown on the button**: its tooltip names the key.

## Risks

- **AltGr layouts** (Polish, some others on Windows): Ctrl+Alt+S is how `ś` is typed. With focus
  in the field, the key would run Suggest text instead of typing `ś`. Not tested; no such layout
  here.
- **Mac VoiceOver** uses Ctrl+Option as its modifier. Only matters with VoiceOver on. Not tested.

## Scope

**Out of scope**: undo for suggested text (text edits have no undo today; a separate ticket if
wanted); a key that suggests every region on the page; user-rebindable keys. Reason: not asked.

## Milestones

- **M1. Suggest-text hotkey.** Checkpoint: Darren decides.

## Open questions

None. Q1 to Q3 answered above.

## Falsification test

Draw a region, leave focus in its field as TS-14 puts it, press the key. The field must fill with
exactly what clicking Suggest text gives on that region. If nothing happens, the key is still
behind the typing-field guard. Safe direction: when no region is selected or Suggest text is
unavailable, do nothing; never run on a region the user did not select.
