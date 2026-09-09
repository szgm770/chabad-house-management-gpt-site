# Project UI rules

## Permanent modal/window contract

Every modal-style surface in this application, now and in future changes, must follow these rules:

1. Use the shared UI primitives from `components/ui` (`Dialog`, `Sheet`, `Drawer`, or the appropriate confirmation component). Do not create ad-hoc fixed overlays or one-off modal implementations.
2. Every window must remain within the viewport and its content must be vertically scrollable with the mouse wheel, trackpad, touch, and keyboard whenever its content is taller than the available screen height.
3. Every ordinary dismissible window must close when the user presses the `Escape` key. Do not disable Escape dismissal unless a truly blocking confirmation flow explicitly requires it.
4. Every ordinary window must expose a visible close control as well.
5. These behaviors belong in the shared primitive, not in each feature screen, so newly created windows inherit them automatically.
6. When adding or changing a modal primitive, preserve `overflow-y-auto` / viewport height constraints and the primitive's keyboard-dismiss behavior.

Treat this as a permanent application-wide requirement, not a per-screen preference.
