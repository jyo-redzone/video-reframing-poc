# Task 001: Project Scaffolding

## Context
Greenfield POC — no code exists yet. Sample video is at `assets/sample-video.mp4` (29.97fps, ~5m04s).

## Objective
Initialize a working Vite + React 18 + TypeScript project with Tailwind CSS, Zustand, and Vitest. The dev server should start cleanly and render a placeholder "Hello World" in the browser.

## Scope
- Initialize with `npm create vite@latest` (React + TypeScript template) in the project root — the app source lives here, not in a subdirectory
- Install dependencies: `react`, `react-dom`, `zustand`, `tailwindcss` (v4), `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
- Configure Tailwind CSS v4 (use the new CSS-based config with `@import "tailwindcss"` — no `tailwind.config.js` needed in v4)
- Configure Vitest in `vite.config.ts` (inline config, no separate vitest.config)
- Set up the folder structure:
  ```
  src/
  ├── main.tsx
  ├── App.tsx
  ├── index.css          (Tailwind import)
  ├── types/
  ├── engine/
  ├── store/
  ├── components/
  ├── hooks/
  └── utils/
  ```
- Move `assets/sample-video.mp4` into `public/assets/sample-video.mp4` so it's served by Vite's dev server
- Add a `.gitignore` covering `node_modules`, `dist`, etc.
- `App.tsx` renders a simple "Video Reframing POC" heading with Tailwind classes to confirm the stack works
- `npm run dev` starts clean, `npm run build` succeeds, `npm test` runs with 0 tests (no failures)

## Non-Goals
- No components, state, or business logic yet
- No ESLint/Prettier setup (defer unless trivial)
- Do not configure path aliases

## Constraints
- Use Tailwind CSS **v4** (not v3). V4 uses `@import "tailwindcss"` in CSS and does not require `tailwind.config.js` or `postcss.config.js` — it has a built-in Vite plugin `@tailwindcss/vite`.
- Vitest config goes inside `vite.config.ts` using the `test` key
- The existing markdown files and `html_ui_mock.html` in the project root must not be deleted
