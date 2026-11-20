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

## Checking mobile UI (keywords)
- `/shots` (or "shots"): `npm run shots` takes headless iPhone screenshots of the key screens (IDs `01-landing` ... `07-results`) into `shots/latest/`. Use `npm run shots -- --baseline` first to save a "before". See `.cursor/skills/shots/SKILL.md`.
- `/phone` (or "phone preview"): `npm run dev:phone` serves the app on the LAN with a QR code for a real phone. See `.cursor/skills/phone/SKILL.md`.
