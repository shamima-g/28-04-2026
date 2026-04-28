# Testing Guide

This guide provides detailed testing patterns and examples for the project. For quick reference, see the Testing Strategy section in [CLAUDE.md](../../CLAUDE.md).

## Testing Framework

The project uses **Vitest** with **React Testing Library** for comprehensive testing, with a focus on **integration tests** over unit tests.

## Test Organization

All tests are centralized in `web/src/__tests__/` with subdirectories by test type:

```
web/src/__tests__/
├── integration/    # Integration tests (primary focus)
├── scripts/        # Template tooling and script tests
└── api/            # API endpoint tests (if needed)
```

### Files You Should NOT Create

- `src/__tests__/utils/` - Avoid standalone utility tests; test utilities through integration
- `constants.test.ts` - Constants have no behavior to test
- `types.test.ts` - TypeScript compiler validates types
- `*-schemas.test.ts` - Don't test Zod/Yup directly; test validation via form/API integration

### Test File Naming

- Use `.test.ts` for non-React tests (API, utils)
- Use `.test.tsx` for React component/page tests
- Use descriptive names: `api-client.test.ts`, `page-rendering.test.tsx`, `user-workflow.test.tsx`

## Integration Test Focus

Integration tests verify that multiple parts of your application work together:

- API client + error handling + data transformation
- Component + API calls + state management
- Complete user workflows (load page → fetch data → interact → verify result)
- Authentication flows
- Form submissions with validation and API integration

## Best Practices

1. **Test realistic workflows**: Focus on what users actually do
2. **Strategic API Mocking**: Use mocking only for scenarios that are difficult or impossible to reproduce with a live test API
3. **Arrange-Act-Assert pattern**: Keep tests structured and readable
4. **Descriptive test names**: Describe the scenario, not the implementation
5. **User-centric queries**: Use `screen.getByRole`, `getByLabelText` (accessibility-first)
6. **User interactions**: Use `userEvent` (not `fireEvent`) for realistic interactions
7. **Async testing**: Always use `waitFor` for async operations
8. **Test error states**: Don't just test the happy path

## Acceptance Test Quality Checklist

Before writing any test, ask: **"Would a user care if this broke?"**

Every test MUST pass this checklist:

| Question | If NO, don't write the test |
|----------|----------------------------|
| Does this test verify something a user can see or interact with? | Skip it |
| Would a product manager understand what this test validates? | Rewrite it |
| Could this test fail even if the feature works correctly for users? | Delete it |
| Does the test name describe a user outcome, not an implementation detail? | Rename it |

### Valid Acceptance Tests Verify

- User can see specific content ("Total: $1,234" is displayed)
- User can perform actions (clicking "Submit" saves the form)
- User receives feedback (error message appears when validation fails)
- User workflow completes (login → redirect to dashboard)
- Accessibility requirements (screen reader can navigate the form)

### Invalid Tests (DO NOT WRITE)

- Component has correct CSS class names
- Internal state updates to specific value
- Function is called N times
- Component renders N child elements
- Props are passed correctly to child components
- Redux/state store contains expected shape
- SVG has correct attributes (fill, stroke, dimensions)
- Animation classes are applied
- Internal DOM structure matches expectations
- Constants or config objects have expected values
- TypeScript types work correctly (compiler handles this)
- Third-party library behavior (Zod schemas validate, NextAuth sessions work, etc.)

## Query Priority (Accessibility-First)

Use queries in this order of preference:

| Priority | Query | When to Use |
|----------|-------|-------------|
| 1st | `getByRole` | Buttons, links, headings, forms - **preferred for most elements** |
| 2nd | `getByLabelText` | Form inputs with labels |
| 3rd | `getByPlaceholderText` | Inputs without visible labels |
| 4th | `getByText` | Non-interactive content |
| 5th | `getByDisplayValue` | Filled form inputs |
| **Last resort** | `getByTestId` | **Only when no semantic query works** |

**`getByTestId` is an anti-pattern in most cases.** If you find yourself adding `data-testid` attributes, first ask: "Is there a semantic HTML element or ARIA role I should use instead?" The answer is usually yes.

## Anti-Pattern: Testing Library Internals

Do NOT write tests that query internal DOM structures of third-party components. This is a common mistake with visualization libraries (Recharts, Chart.js, D3), rich text editors, and complex UI components.

### Bad - Testing Implementation Details

```typescript
// Testing Recharts internal SVG rendering
expect(container.querySelector('.recharts-bar-rectangle')).toHaveAttribute('fill', '#8884d8');
expect(screen.getByTestId('chart').querySelectorAll('rect')).toHaveLength(5);
```

### Good - Testing User-Observable Behavior

```typescript
// Test that data is accessible (via sr-only text or aria-labels)
expect(screen.getByText('Sales: $1,234')).toBeInTheDocument();

// Test that the chart container renders
expect(screen.getByRole('img', { name: /sales chart/i })).toBeInTheDocument();

// Test loading/error states
expect(screen.getByText('Loading chart...')).toBeInTheDocument();
```

### Why This Matters

1. Internal DOM structure can change between library versions (brittle tests)
2. jsdom cannot render SVG/Canvas properly (tests will fail or be meaningless)
3. These tests don't verify what users actually see
4. Visual verification belongs in E2E tests (Playwright/Cypress) or visual regression tools

### For Charts and Visualizations Specifically

- Test that the component renders without crashing
- Test data transformation/formatting functions separately
- Test loading, error, and empty states
- Use accessibility features (aria-labels, sr-only text) to verify data display
- Defer visual correctness testing to E2E or manual QA

## Known Limitation: Mock Boundary Blindness

Vitest + React Testing Library runs in jsdom, which cannot exercise certain Next.js integration layers. Tests that mock each boundary independently will pass even when the boundaries are not connected at runtime.

### What jsdom CAN verify (unit-testable)

- Component rendering and conditional content
- Form interactions and validation feedback
- Hook behavior and state changes
- Error message display
- Client-side navigation calls (`router.push` was called with correct args)

### What jsdom CANNOT verify (runtime-only)

- **Middleware routing:** `middleware.ts` actually intercepts requests and redirects
- **Server component auth:** `requireAuth()` in a server component actually blocks rendering
- **Layout composition:** A page inside `(protected)/` actually inherits the protected layout
- **Multi-layer redirects:** Middleware → login → return-to-original-page chains
- **`"use client"` boundaries:** Server-side auth placed in a `"use client"` component is silently skipped

### What jsdom CANNOT verify (data-contract)

When a component fetches a list from an API and lets the user filter/search/sort/paginate, tests typically mock the API client with `vi.mock('@/lib/api/client')`. The component test verifies the UI calls `get()` with some args, but none of these are exercised end-to-end:

- **Query-param serialization:** Does the API client encode arrays as repeated params (`?status=a&status=b`) or comma-joined (`?status=a,b`) — whichever the OpenAPI spec requires?
- **`buildUrl` correctness:** Does the URL helper handle array values, or does it silently drop them?
- **MSW handler contract:** Does the handler actually read the declared query params and filter the dataset, or does it return the full list regardless?
- **Mock dataset realism:** Is the dataset large enough that a filter selection visibly narrows the result, or does "3 items across 3 statuses" make every filter look like "1 item"?
- **Empty-filter semantics:** Does unchecking all filter checkboxes return all items, or accidentally zero items?

A list with a broken status filter will pass every component test because the test never touches the actual URL. The bug appears only when the real API client meets the real MSW handler in the browser.

### How the workflow handles this

If a test-handoff document exists for the current story, the test-designer classifies each scenario as **unit-testable**, **runtime-only**, or **data-contract** during TEST-DESIGN. Runtime-only and data-contract items flow into a **Runtime Verification Checklist** in the test-handoff document that is:

1. Used by the **developer** during implementation to verify integration wiring
2. Cross-referenced by the **code-reviewer** during code review
3. Included in the **manual verification checklist** during QA

Even without a test-handoff document, the developer and code-reviewer agents perform integration wiring checks (including list/filter/search data-contract wiring) and synthesize runtime verification items from the story's own ACs — including filter/search manual checks — so the manual verification checklist always surfaces runtime-only and data-contract concerns.

This ensures runtime-only and data-contract behaviors are explicitly tracked rather than silently assumed to work because mocked tests passed.

### How MSW handlers mitigate the data-contract flavor

The `mock-setup-agent` generates handlers that honor their own OpenAPI contract: query parameters declared in the spec are read and applied to the dataset, and filterable list endpoints have a dataset large enough to make filtering visible (≥2 items per enum value). This prevents the most common source of data-contract bugs — handlers that silently ignore query params — from ever shipping as a mock.

The Phase 2.5 developer check and the code-reviewer Section 5.5 check still run to verify that the component → API client → handler chain is connected end-to-end for each story that adds filter/search UI.

## Test Mock Requirements

When tests fail due to mock issues, you MUST fix the mocks - never skip tests to avoid fixing them.

### Common Mock Issues and Fixes

**1. Multiple API calls:**

```typescript
// WRONG: Only handles first call
mockGet.mockResolvedValue(data);

// RIGHT: Handles multiple calls
mockGet.mockResolvedValue(data); // If all calls return same shape
// OR
mockGet
  .mockResolvedValueOnce(bloombergData)
  .mockResolvedValueOnce(custodianData);
```

**2. Context providers not wrapped:**

```typescript
vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
  ToastProvider: ({ children }) => children
}));
```

**3. Navigation mocks:**

```typescript
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/current-path',
  useSearchParams: () => new URLSearchParams()
}));
```

**4. Async state updates:**

```typescript
await waitFor(() => {
  expect(screen.getByText('Expected')).toBeInTheDocument();
});
```

### Never Use `.skip()`

**Never use `describe.skip()` or `it.skip()`.** Tests must either pass or fail — skipping hides problems.

- **TDD red phase:** Tests are expected to fail (imports don't exist yet). Let them fail — don't skip them. The IMPLEMENT phase follows immediately to make them pass.
- **Mock issues:** Fix the mocks properly. If you can't solve it, ask the user for help rather than skipping the test.
- **Missing environment capabilities:** Mock the capability or restructure the test. Do not skip.

## Template Test Examples

Reference these tests for patterns:

- [api-client.test.ts](../../web/src/__tests__/integration/api-client.test.ts) - API client integration testing
- [page-rendering.test.tsx](../../web/src/__tests__/integration/page-rendering.test.tsx) - Component + data fetching integration
- [auth-helpers.test.ts](../../web/src/__tests__/integration/auth-helpers.test.ts) - RBAC helper functions
- [rbac.test.ts](../../web/src/__tests__/integration/rbac.test.ts) - Role-based access control integration
- [validation-schemas.test.ts](../../web/src/__tests__/integration/validation-schemas.test.ts) - Zod validation schemas
- [generate-progress-index.test.ts](../../web/src/__tests__/scripts/generate-progress-index.test.ts) - Script testing

## What NOT to Test

- Simple utility functions (unless complex logic)
- Third-party library code
- Trivial getters/setters
- TypeScript types (let the compiler handle it)
