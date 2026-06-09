# Dependency Upgrade Guide

## Current dashboard baseline

The target client currently uses modern frontend dependencies including:

- Next.js 16.1.6
- React 19.2.3
- React DOM 19.2.3
- TanStack Query 5.90.x
- Zustand 5.x
- Tailwind CSS 4.x
- TypeScript 5.x
- Vitest 4.x

## Add 3D dependencies

Run:

```bash
cd Dashboard/client
npm install three@^0.184.0 @react-three/fiber@^9.6.1 @react-three/drei@^10.7.7
npm install -D @types/three@^0.184.1
```

## Why these versions

- `three@^0.184.0`: latest stable Three.js line checked on 2026-05-23.
- `@react-three/fiber@^9.6.1`: React 19-compatible R3F line.
- `@react-three/drei@^10.7.7`: current helper package line for R3F.
- `@types/three@^0.184.1`: TypeScript definitions aligned with Three.js r184.

## Versioning style

Use caret ranges to match the existing client dependency style. The repo instructions also say dependencies should be pinned/audited periodically. If release hardening requires exact locks, rely on `package-lock.json` for exact reproducibility.

## Verification commands

```bash
cd Dashboard/client
npm install
npm run lint
npm run test
npm run build
```

## Do not add

```text
jsplot3d
leva
plotly.js
deck.gl
react-force-graph
```
