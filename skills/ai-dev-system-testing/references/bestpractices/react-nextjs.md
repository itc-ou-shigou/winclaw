# React / Next.js Best Practices for Code Review

- **Language**: JavaScript / TypeScript
- **Framework**: React 18+, Next.js 13.5+
- **Source**: https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices
- **Applicable when**: `project-structure.json` → `frontend.framework == "react"` or `frontend.framework == "nextjs"`

---

## Architecture Patterns

### Server Components vs Client Components
- Default to Server Components (RSC); add `"use client"` only when needed (event handlers, hooks, browser APIs)
- Minimize serialization at RSC boundaries — pass only primitive props or small JSON
- Use `React.cache()` for per-request deduplication in server components
- Use `after()` for non-blocking post-response operations (analytics, logging)

### Data Fetching
- Parallelize independent `await` calls with `Promise.all()` — never chain sequential awaits without dependency
- Move `await` to where data is actually consumed, not at the top of the function
- Use SWR for client-side data fetching with automatic request deduplication
- Use `useSWRSubscription()` to deduplicate global event listeners

---

## Code Quality Standards

### State Management
- **Never store derived values in state** — calculate during render instead
- Use functional `setState` updates to prevent stale closures: `setCount(prev => prev + 1)`
- Use `useRef` for transient values that don't trigger re-renders
- Use lazy state initialization for expensive computations: `useState(() => expensiveCalc())`
- Apply `useTransition` for non-urgent UI updates

### Memoization Rules
- Do NOT wrap simple primitive expressions with `useMemo` (overhead exceeds benefit)
- Hoist non-primitive default parameters to module-level constants
- Extract memoized child components with early returns to reduce re-render scope
- Narrow effect dependencies to primitives, not objects/arrays

### Immutability
- Use `.toSorted()` instead of `.sort()` to prevent state mutations
- Always use immutable array/object methods in state updates
- Never mutate props or state directly

---

## Naming Conventions

- Components: `PascalCase` (`UserProfile`, `DashboardLayout`)
- Hooks: `camelCase` prefixed with `use` (`useAuth`, `useLocalStorage`)
- Event handlers: `handle` prefix (`handleClick`, `handleSubmit`)
- Constants: `UPPER_SNAKE_CASE` for module-level, `camelCase` for component-level
- Files: Component files match component name (`UserProfile.tsx`)

---

## Security Checklist

- [ ] No `dangerouslySetInnerHTML` without proper sanitization (DOMPurify)
- [ ] No user input directly rendered in URLs or `href` attributes
- [ ] Validate and sanitize all URL parameters before use
- [ ] Use `suppressHydrationWarning` only for known safe mismatches (timestamps, random IDs)
- [ ] Avoid exposing sensitive data in client components (API keys, tokens)
- [ ] Server Actions validate input on server side, never trust client data

---

## Performance Patterns

### Critical (2-10x gains)
1. **Eliminate request waterfalls**: Parallelize independent async operations with `Promise.all()`
2. **Avoid barrel file imports**: Import directly from module files, not `index.ts` re-exports (saves 200-800ms cold start)
3. **Use `next/dynamic`** for heavy components not needed on initial render
4. **Load analytics/third-party scripts after hydration**

### High Impact
5. **CSS `content-visibility: auto`** for long scrollable lists
6. **Hoist static JSX** outside component functions (avoids re-creation on each render)
7. **Animate wrapper `<div>` not `<svg>` elements** for hardware-accelerated transforms
8. **Use passive event listeners** `{ passive: true }` for scroll/touch handlers

### Medium Impact
9. **Build index maps** for O(1) lookups instead of repeated `.find()` calls
10. **Cache property access** in loops: `const len = arr.length` instead of accessing each iteration
11. **Use `Set`/`Map`** for membership checks instead of array `.includes()`
12. **Combine multiple array iterations** into single pass
13. **Hoist `RegExp` creation** to module scope (avoid re-compilation per render)

---

## Anti-Patterns (Review Targets)

### Bug-Risk Anti-Patterns (Auto-Fix Candidates)
| Anti-Pattern | Bug Risk | Fix |
|-------------|----------|-----|
| Sequential `await` without dependency | Performance degradation, timeout risk | Wrap in `Promise.all()` |
| `.sort()` on state arrays | State mutation, unpredictable renders | Use `.toSorted()` |
| Stale closure in `setState` | Data loss, race condition | Use functional update `prev => ...` |
| Missing deps in `useEffect` | Infinite loop or stale data | Add correct dependencies |
| `&&` short-circuit rendering with numeric 0 | Renders `0` instead of nothing | Use ternary `condition ? <X/> : null` |

### Style Anti-Patterns (Report Only)
| Anti-Pattern | Recommendation |
|-------------|----------------|
| Barrel file imports | Import from specific module path |
| `useMemo` on primitives | Remove unnecessary memoization |
| Derived state stored in `useState` | Calculate during render |
| Inline object/array as default prop | Hoist to module constant |
| Missing `key` prop in lists | Add stable unique key |

---

## Testing Standards

- Use React Testing Library (`@testing-library/react`) over Enzyme
- Test behavior, not implementation details
- Prefer `screen.getByRole()` over `getByTestId()`
- Test accessibility with `jest-axe` for a11y violations
- Mock external API calls, not internal component logic
- Snapshot tests only for stable, small components
