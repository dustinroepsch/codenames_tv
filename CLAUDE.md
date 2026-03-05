# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Codenames game with a React/TypeScript frontend and Rust backend (early stage).

## Repository Structure

- `codenames_frontend/` — React 19 + TypeScript + Vite 7 SPA
- `codenames_backend/` — Rust (edition 2024), currently a skeleton with no framework

## Commands

### Frontend (run from `codenames_frontend/`)

```bash
npm run dev       # Start Vite dev server with HMR
npm run build     # TypeScript check + Vite production build
npm run lint      # ESLint (flat config with typescript-eslint, react-hooks, react-refresh)
npm run preview   # Preview production build
```

### Backend (run from `codenames_backend/`)

```bash
cargo build       # Build the Rust backend
cargo run         # Run the backend
cargo test        # Run Rust tests
```

## Frontend Architecture

- **Entry point**: `src/main.tsx` → `src/App.tsx`
- **Build tool**: Vite with `@vitejs/plugin-react` and React Compiler (Babel plugin)
- **TypeScript**: Strict mode enabled with `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- **Target**: ES2022, module resolution set to `bundler`
- **No testing framework configured yet**
- **No state management library** — using React built-in hooks

## Backend Architecture

- Rust edition 2024, no web framework or dependencies added yet
- No database or API layer configured
