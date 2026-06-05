# App State Screens Extraction - TechSpec

## Current State

`App.tsx` defines:

- `BootScreen`;
- `CopilotLoadingFallback`;
- `LoginScreen`;
- test-login environment constants used only by `LoginScreen`.

## Proposed Design

Create `frontend/src/components/AppStateScreens.tsx` and export the three components. Move test-login constants into the same module because they are login UI concerns.

`App.tsx` will import the components and keep:

- session booting;
- login callback;
- logout and refresh orchestration;
- app routing and mutation callbacks.

## Risk

- Moving `FormEvent` and login `useState` dependencies can leave unused imports in `App.tsx`.
- Test-login environment handling must remain identical.

## Verification

- `npm.cmd --workspace frontend run lint`
- `npm.cmd --workspace frontend run build`
- `npm.cmd run test:e2e`
- `compozy.cmd tasks validate --name app-state-screens-extraction`

