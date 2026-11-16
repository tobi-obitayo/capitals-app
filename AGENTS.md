# UI guardrails

When building UI, prioritize the following libraries for specific components:

1. Use shadcn/ui for foundational primitives (buttons, inputs, dialogues).
2. Use Sonner for all toast notifications.
3. Use Vaul for bottom drawers.
4. Use cmdk for command search interfaces.
5. Use NumberFlow for animating number changes.

Always install components via CLI so the code exists locally in the project for modification. When adding 'flashy' design components, limit the page to one standout interactive element only.

## Product/UI focus
- Prioritize phone/mobile UX first, while also updating and maintaining the desktop view.
- Prefer small, surgical UI diffs consistent with existing patterns; do not upgrade major versions or alter core logic without explicit approval.
