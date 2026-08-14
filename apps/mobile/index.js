import { registerRootComponent } from 'expo';
import App from './App';

// Local entry point (docs/10-OPEN-DECISIONS.md §M2) — expo/AppEntry.js does `import App from
// '../../App'`, which only resolves correctly when it physically lives inside this package's
// own node_modules. In this npm workspace, `expo` is hoisted to the repo root, so that relative
// path reaches two directories above the monorepo root instead of back to apps/mobile/App.tsx.
// A local entry file sidesteps hoisting entirely — this is Expo's own documented fix for
// monorepos, not a workaround specific to this project.
registerRootComponent(App);
