# Frontend Coding Conventions

This document defines the coding conventions for the MapMory frontend, built with React, TypeScript, Vite, and Leaflet.

The goal is to maintain consistent, readable, accessible, and testable code without introducing unnecessary abstractions or imposing style rules that do not contribute to correctness.

These conventions apply to new contributions. Existing code may not yet satisfy every recommendation; known violations should be addressed incrementally rather than suppressed indiscriminately.

## 1. Code quality and linting

The frontend uses **Oxlint** for static analysis. Configuration is maintained in `.oxlintrc.json`.

Run the following checks before requesting review:

```bash
npm run lint
npm run build
npm run test:typecheck
```

The production build includes TypeScript checking, while `test:typecheck` separately checks test-related TypeScript files.

### Lint policy

| Category | Expectations |
|---|---|
| General correctness | Avoid debugger statements, suspicious constructs, and common programming mistakes. |
| React | Follow the Rules of Hooks and review effect dependencies, state updates inside effects, and ref usage. |
| TypeScript | Prefer explicit types at meaningful boundaries and consistent type-only imports. |
| Accessibility | Use appropriate semantic HTML, ARIA attributes, keyboard interactions, and focus management. |
| Maintainability | Avoid confusing variable shadowing and unnecessarily complicated code. |

**Severity levels:**

- **Error:** Must be resolved before merging. Errors fail CI.
- **Warning:** Must be considered during review. Existing warnings may be addressed in follow-up issues.
- **Off:** Intentionally disabled because a rule is inappropriate for the project's tooling or conventions.

The configuration intentionally disables `react/react-in-jsx-scope` because Vite uses the automatic JSX runtime.

It also disables `jsx-a11y/prefer-tag-over-role` because custom widgets may require explicit ARIA roles. Contributors should still prefer native semantic HTML whenever it provides the required behavior.

Do not disable lint rules or introduce suppression comments merely to make a check pass. Document exceptions when they are genuinely necessary.

Oxlint does not enforce formatting. Follow the surrounding code style and avoid unrelated formatting changes.

## 2. TypeScript conventions

- Prefer TypeScript types that express actual domain constraints.
- Avoid `any` where a meaningful type or `unknown` can be used.
- Use `import type` for imports used exclusively as types.
- Prefer discriminated unions for mutually exclusive states.
- Avoid unnecessary type assertions, particularly `as` assertions that bypass runtime validation.
- Handle nullable and optional values explicitly.
- Use descriptive names and follow established TypeScript naming conventions.

External data must not be assumed valid solely because a TypeScript interface describes it.

## 3. React components and hooks

- Prefer function components and hooks.
- Keep components focused on a clear responsibility.
- Extract reusable components or hooks when doing so improves clarity.
- Do not introduce abstractions solely to reduce line count.
- Never call hooks conditionally.
- Treat props and state as immutable.
- Avoid duplicating derived values in component state.

### State management

Choose state ownership based on where the data is needed:

- **Local state:** Component-specific UI state.
- **Shared state:** Data genuinely needed across multiple components.
- **Server state:** Data retrieved from backend APIs.
- **Refs:** Mutable values that do not need to trigger rendering.

Do not read or modify `ref.current` during rendering. Refs may be used in event handlers, effects, and integrations with imperative libraries such as Leaflet.

### Effects

Use `useEffect` primarily to synchronize React with external systems, including network requests, subscriptions, and imperative map behavior.

Avoid effects whose only purpose is copying or resetting React state when the same transition can be handled directly.

Effects that start asynchronous operations should account for cancellation and stale responses.

Do not remove legitimate effects or introduce artificial asynchronous delays merely to silence lint warnings.

## 4. API integration

- Centralize backend communication in the existing API layer.
- Follow the shared OpenAPI contract.
- Use typed request and response structures.
- Keep authentication headers and error handling consistent.
- Treat backend responses as external data.
- Distinguish loading, success, empty, and error states.
- Avoid initiating duplicate requests unnecessarily.

Components should not construct backend URLs or manage authentication tokens independently when existing API utilities already handle those responsibilities.

Mock data must not silently substitute for real API data in production behavior.

## 5. Accessibility

Accessibility is part of the expected functionality, not an optional enhancement.

- Prefer semantic HTML elements when they satisfy the interaction requirements.
- Ensure interactive controls are keyboard-accessible.
- Provide accessible labels for buttons, inputs, and other controls.
- Ensure meaningful images have suitable alternative text.
- Keep focus visible during keyboard navigation.
- Manage focus deliberately when opening and closing dialogs.
- Use ARIA roles and attributes correctly for custom widgets.
- Do not add `tabIndex` or keyboard handlers to noninteractive containers without understanding their accessibility implications.

Custom widgets, such as autocomplete suggestions, photo galleries, and map interactions, should follow established keyboard interaction patterns.

Automated linting does not replace manual keyboard or accessibility testing.

## 6. Maps and geospatial data

- Keep map rendering concerns separate from unrelated application state where practical.
- Avoid unnecessary Leaflet instance recreation.
- Clean up event listeners and imperative map resources appropriately.
- Use consistent coordinate representations and naming.
- Preserve distinctions between original photo coordinates, corrected coordinates, and coordinates displayed for privacy.
- Do not expose precise private locations unintentionally.

Map filters, viewport state, and selected markers should behave consistently when queries or navigation state change.

## 7. Uploads and asynchronous operations

- Model asynchronous operations using explicit states.
- Keep upload progress and failure information observable in the interface.
- Handle retries without assuming that files or resources remain available indefinitely.
- Avoid storing large file objects in reactive state unless necessary.
- Ensure asynchronous responses cannot overwrite newer state incorrectly.
- Clean up temporary resources when they are no longer required.

An operation should not be reported as successful before the relevant backend step has actually completed.

## 8. Testing

Add or update tests for meaningful behavior changes and bug fixes.

Use the existing test infrastructure:

- **TypeScript checks:** Validate types across application and test code.
- **Playwright:** Test user-visible workflows, keyboard interactions, and integration behavior.
- **API tests:** Verify request construction, response adaptation, and error handling.

Tests should be deterministic and independent of unrelated services whenever possible.

Distinguish between:

- **Frontend acceptance tests:** Run against controlled fixtures or mocked API responses.
- **Full-stack end-to-end tests:** Run against a configured backend with predictable test data.

Do not weaken assertions or silently skip failing tests simply because backend implementation is incomplete. Document genuine dependencies and track unfinished integration work separately.

## 9. Code organization and documentation

- Follow the repository's established structure.
- Group related code by responsibility.
- Avoid placing substantial application logic directly in presentation components when it can be clearly separated.
- Prefer existing utilities and patterns before creating new abstractions.
- Document non-obvious implementation constraints and decisions.
- Update documentation when introducing new workflows, dependencies, or architectural patterns.

Avoid broad refactoring unrelated to the issue being addressed.

## 10. Pull requests and reviews

Before requesting review:

1. Run lint, build, and test typechecking.
2. Run relevant automated tests.
3. Check keyboard and interaction behavior for affected UI components.
4. Keep changes focused on the linked issue.
5. Document known limitations and remaining dependencies.
6. Explain significant design tradeoffs in the PR description.

Lint warnings should be evaluated individually. Correct behavior and maintainability take precedence over mechanically eliminating every diagnostic.

These conventions may evolve through team agreement as the application matures.
