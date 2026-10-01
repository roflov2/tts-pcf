# Agent instructions

This repo is a Power Apps PCF code component (TypeScript, React 16, Fluent UI v9).
The full guidance for coding agents (ground rules, definition of done, recipes and
gotchas) is in the **[For AI coding agents](README.md#for-ai-coding-agents)**
section of the README. Read it before making changes.

The short version:

- Check your work with `npm run lint && npm test && npm run build`; all three must pass.
- Use the mock UI to look at changes: `npm run preview` (http://localhost:5173), or `npm run screenshot` → `docs/screenshot*.png`.
- Use only platform React 16 and Fluent v9. No `@fluentui/react-icons` imports in control code (use `npm run icons`), and no `Xrm`/`webAPI`.
- Every UI string goes in both `utils/strings.ts` and `strings/ScamwatchChat.1033.resx`.
- `utils/dictionary.ts` must match the Python helpers it ports. Test against the Python output.
- The API contract lives in `ScamwatchChat/types.ts` and `docs/API_CONTRACT.md`. Change them together, along with `services/mockApi.ts`.
