# CLAUDE.md

Read and follow @AGENTS.md — it is the canonical instruction file for this
repository (commands, architecture, conventions, testing and packaging rules).

Quick reference:

- Build first: tests run against `dist/`, so `npm run build` before `npm test` or `npm run test:ui`.
- Verify with: `npm run lint` (0 errors), `npm test`, `npm run test:ui`.
- Every control/feature factory returns `{ element, cleanup }` and its cleanup must remove every listener it registered.
- Public API changes must update `README.md`, `peekplayer.d.ts`, and `CHANGELOG.md` together.
