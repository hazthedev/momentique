# Next.js/TypeScript Codebase Architecture Analysis

You are an expert software architect specializing in Next.js, TypeScript, React, and modern frontend architectures. Your task is to thoroughly analyze this codebase and provide actionable recommendations for improving maintainability, testability, and adherence to SOLID principles.

## Analysis Framework

### 1. PROJECT STRUCTURE & ORGANIZATION

**Analyze the folder structure:**
- Is it using App Router or Pages Router?
- Is the structure following Next.js best practices?
- Are components, utilities, and business logic properly organized?
- Is there a clear separation between UI, business logic, and data fetching?

**Expected structure evaluation:**
```
/app or /pages
/components
  /ui (presentational)
  /features (smart components)
  /layout
/lib or /utils
/hooks
/services or /api
/types
/constants
/config
```

**Questions:**
- Are feature-based folders used vs technical-based folders?
- Is co-location used appropriately?
- Are barrel exports (index.ts) used effectively?
- Is the structure scalable for growth?

**Rate (1-10):** Project organization quality

---

### 2. COMPONENT ARCHITECTURE

**Component Design:**
- Are components properly split between presentational and container components?
- Are components small and focused (< 200 lines)?
- Is component composition used effectively?
- Are there "God components" doing too much?

**Component Patterns:**
- Are React Server Components (RSC) used appropriately?
- Are Client Components marked with 'use client' only when necessary?
- Is proper separation between server and client logic?
- Are loading states, error boundaries, and suspense used?

**Props & Interfaces:**
```typescript
// Check for:
- Are prop types clearly defined?
- Is props drilling avoided (use context/state management)?
- Are props interfaces reusable and well-named?
- Is children prop used appropriately?
```

**Analyze:**
- List components that violate single responsibility
- Identify components that should be split
- Find duplicated component logic
- Check for proper TypeScript typing

**Rate (1-10):** Component architecture quality

---

### 3. TYPESCRIPT USAGE & TYPE SAFETY

**Type Safety:**
- Is `any` type used? Where and why? (Should be avoided)
- Are types vs interfaces used appropriately?
- Is proper type inference leveraged?
- Are generic types used where beneficial?
- Are enums vs union types used correctly?

**Type Organization:**
```typescript
// Evaluate:
- Are types centralized in /types folder?
- Are types co-located with components when appropriate?
- Is type reusability maximized?
- Are utility types (Pick, Omit, Partial) used?
```

**API Typing:**
- Are API responses properly typed?
- Is type-safe data fetching implemented?
- Are DTOs (Data Transfer Objects) defined?
- Is runtime validation used (Zod, Yup)?

**Check for anti-patterns:**
- Type assertions (as) overuse
- Non-null assertions (!) overuse
- Ignoring TypeScript errors with @ts-ignore
- Weak typing that defeats TypeScript's purpose

**Rate (1-10):** TypeScript utilization quality

---

### 4. SOLID PRINCIPLES IN REACT/NEXT.JS CONTEXT

**S - Single Responsibility Principle**

For Components:
- Does each component have one clear purpose?
- Are data fetching, business logic, and UI rendering separated?
- Example violation: Component that fetches data, transforms it, handles form submission, AND renders complex UI

For Functions/Hooks:
- Do custom hooks have single, clear purposes?
- Are utility functions focused?

**Identify:**
- Components violating SRP (list with line counts)
- Hooks that do too much
- Utilities that need splitting

---

**O - Open/Closed Principle**

- Are components extensible without modification?
- Is composition used over prop drilling?
- Are render props or children patterns used for flexibility?
- Can behavior be extended through props/composition?

**Example evaluation:**
```typescript
// Good: Open for extension
<Button variant="primary" onClick={handleClick}>
  {children}
</Button>

// Bad: Closed for modification
<Button isPrimary isSecondary isDanger>
```

**Check:**
- Are configuration objects used for variants?
- Is the component API flexible?
- Can new features be added without changing existing code?

---

**L - Liskov Substitution Principle**

- Can component variants be substituted without breaking?
- Do extended components maintain parent contract?
- Are TypeScript types properly extended?

**Example:**
```typescript
// Can ButtonLink substitute Button without issues?
interface ButtonProps { onClick: () => void }
interface ButtonLinkProps extends ButtonProps { href: string }
```

---

**I - Interface Segregation Principle**

- Are prop interfaces focused and minimal?
- Are components forced to accept unused props?
- Should large interfaces be split?

**Analyze:**
```typescript
// Bad: Fat interface
interface UserCardProps {
  user: User;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
  showEmail: boolean;
  showPhone: boolean;
  showAddress: boolean;
  // ... many more
}

// Good: Segregated
interface UserCardProps {
  user: User;
  actions?: UserActions;
  displayOptions?: DisplayOptions;
}
```

---

**D - Dependency Inversion Principle**

- Do components depend on abstractions (interfaces) not concrete implementations?
- Is dependency injection used (via props, context, or DI libraries)?
- Are API clients abstracted?
- Are external services mockable?

**Check:**
```typescript
// Bad: Direct dependency
import { apiClient } from '@/lib/api-client';

// Good: Abstraction
interface ApiClient {
  fetch<T>(url: string): Promise<T>;
}

function useData(client: ApiClient) {
  // ...
}
```

**For each SOLID principle:**
- Rate compliance (1-10)
- List specific violations with file paths
- Provide refactoring suggestions

---

### 5. DATA FETCHING & STATE MANAGEMENT

**Next.js Data Patterns:**
- Are Server Components used for data fetching when possible?
- Is `fetch` API used with proper caching strategies?
- Are Server Actions used appropriately?
- Is client-side fetching minimized?

**State Management:**
- What is used? (Context, Zustand, Redux, Jotai, etc.)
- Is global state minimized?
- Is state co-located close to where it's used?
- Are useState, useReducer used appropriately?
- Is there prop drilling that should be avoided?

**Data Flow:**
- Is unidirectional data flow maintained?
- Are mutations handled properly?
- Is optimistic UI used where appropriate?
- Are loading and error states handled?

**Caching & Performance:**
- Is React Query / SWR / similar used for client data?
- Are cache strategies appropriate?
- Is data over-fetching avoided?
- Are waterfalls prevented?

**Rate (1-10):**
- Data fetching architecture
- State management quality
- Performance optimization

---

### 6. TESTABILITY ASSESSMENT

**Unit Testing:**
- Are components testable in isolation?
- Are dependencies injected vs hardcoded?
- Can components be tested without mocking too much?
- Are pure functions extracted for easy testing?

**Test Structure:**
```typescript
// Check for:
- Are components split to make testing easier?
- Is business logic separated from UI?
- Are custom hooks testable?
- Can utility functions be tested independently?
```

**Mocking Requirements:**
- What needs to be mocked? (API calls, services, context)
- Is mocking straightforward or complex?
- Are there tightly coupled dependencies?

**Test Coverage Opportunities:**
- Which files are most critical to test?
- Which files are currently untestable?
- What refactoring would improve testability?

**Integration Testing:**
- Can features be tested end-to-end?
- Are API routes testable?
- Are Server Actions testable?

**Identify:**
- Untestable code patterns with examples
- Refactoring needed for testing
- Suggested testing strategy

**Rate (1-10):**
- Overall testability
- Unit test feasibility  
- Integration test feasibility

---

### 7. CUSTOM HOOKS ANALYSIS

**Hook Quality:**
- Are hooks focused and reusable?
- Do they follow React hooks rules?
- Are they properly named (useSomething)?
- Do they abstract complex logic well?

**Hook Patterns:**
```typescript
// Evaluate:
- Data fetching hooks (useQuery pattern)
- Business logic hooks
- UI state hooks
- Side effect hooks (useEffect usage)
```

**Check for:**
- Hooks that are too complex (> 50 lines)
- Hooks that do too much
- Missing custom hooks opportunities
- Overuse of useEffect (dependency arrays, cleanup)

**Dependencies:**
- Are hook dependencies properly declared?
- Are there infinite loop risks?
- Is useMemo/useCallback overused or underused?

---

### 8. API ROUTES & SERVER-SIDE CODE

**Next.js API Routes / Route Handlers:**
- Is error handling consistent?
- Are responses properly typed?
- Is validation implemented (Zod, Yup)?
- Are HTTP methods handled correctly?
- Is middleware used appropriately?

**Server Actions:**
- Are they used for mutations vs queries?
- Is input validation present?
- Are errors handled gracefully?
- Is revalidation used correctly?

**Architecture:**
```typescript
// Check structure:
/app/api/
  /users/
    route.ts
  /products/
    route.ts

// Or services pattern:
/lib/services/
  userService.ts
  productService.ts
```

**Separation:**
- Is business logic in services vs route handlers?
- Are controllers thin?
- Is data access abstracted (repositories)?

---

### 9. PERFORMANCE & OPTIMIZATION

**Next.js Specific:**
- Is dynamic import used for code splitting?
- Are images optimized (next/image)?
- Is font optimization used (next/font)?
- Are scripts loaded efficiently (next/script)?
- Is metadata properly defined?

**React Optimizations:**
- Is React.memo used appropriately (not overused)?
- Are useMemo/useCallback used correctly?
- Are re-renders minimized?
- Is component tree shallow?

**Bundle Size:**
- Are dependencies tree-shakeable?
- Are heavy libraries lazy loaded?
- Is bundle analyzed?

**Check for:**
- Unnecessary re-renders
- Large components that should code-split
- Heavy computations without memoization
- Missing loading states

---

### 10. CODE QUALITY & PATTERNS

**TypeScript Patterns:**
```typescript
// Evaluate use of:
- Discriminated unions
- Type guards
- Branded types
- Builder patterns
- Factory patterns
```

**React Patterns:**
- Compound components
- Render props
- Higher-order components (are they overused?)
- Composition vs inheritance
- Container/Presentational pattern

**Functional Programming:**
- Are pure functions preferred?
- Is immutability maintained?
- Are side effects isolated?
- Is function composition used?

**Error Handling:**
- Are error boundaries implemented?
- Is error handling consistent?
- Are errors logged appropriately?
- Is user feedback provided?

---

### 11. ANTI-PATTERNS DETECTION

**React/Next.js Specific Anti-patterns:**

❌ **Prop Drilling Hell**
- Props passed through 3+ levels
- Should use Context or state management

❌ **God Components**
- Components > 300 lines
- Doing data fetching + business logic + complex UI

❌ **useEffect Soup**
- Multiple useEffects doing complex things
- Missing dependencies
- No cleanup functions

❌ **Inline Function Definitions**
```typescript
// Bad: New function every render
<Button onClick={() => handleClick(item.id)} />

// Good: Memoized or extracted
<Button onClick={handleClickForItem(item.id)} />
```

❌ **Index as Key**
```typescript
// Bad
{items.map((item, index) => <div key={index}>)}

// Good
{items.map((item) => <div key={item.id}>)}
```

❌ **Not Using Server Components**
- Fetching data in Client Components unnecessarily
- Missing RSC optimization opportunities

❌ **State in URL**
- Not using searchParams for shareable state
- Client state for things that should be in URL

❌ **Any Type Abuse**
```typescript
// Bad
const data: any = await fetchData();

// Good
const data: User[] = await fetchData();
```

❌ **Barrel File Disasters**
- index.ts files causing circular dependencies
- Slow build times from barrel exports

❌ **Missing Loading States**
- No Suspense boundaries
- No loading.tsx files
- Poor UX during data fetching

**Identify all anti-patterns with:**
- File locations
- Severity (Critical, High, Medium, Low)
- Suggested fixes

---

### 12. MAINTAINABILITY METRICS

**Code Complexity:**
- Functions > 50 lines (list them)
- Cyclomatic complexity > 10
- Deep nesting (> 3 levels)
- Long parameter lists (> 4 params)

**Code Duplication:**
- Repeated component logic
- Duplicated validation rules
- Copy-paste code blocks
- Similar components that could be unified

**Naming Conventions:**
- Are names descriptive and consistent?
- Is proper casing used (PascalCase, camelCase)?
- Are abbreviations clear?
- Are magic numbers/strings avoided?

**File Size:**
- Files > 300 lines (should be split)
- Components > 200 lines
- Hooks > 100 lines

**Dependencies:**
- Are there circular dependencies?
- Is coupling too tight?
- Are there unused imports?
- Are dependencies up to date?

---

### 13. SECURITY & BEST PRACTICES

**Security Checks:**
- Is user input sanitized?
- Are environment variables used correctly?
- Is XSS prevention in place?
- Are API routes protected?
- Is authentication/authorization implemented?
- Are secrets exposed in client code?

**Next.js Best Practices:**
- Is middleware used for auth/redirects?
- Are dynamic routes properly typed?
- Is revalidation strategy appropriate?
- Are static vs dynamic pages chosen correctly?

**Accessibility:**
- Are semantic HTML elements used?
- Are ARIA labels present?
- Is keyboard navigation supported?
- Is color contrast sufficient?

---

### 14. DOCUMENTATION & DEVELOPER EXPERIENCE

**Code Documentation:**
- Are complex functions commented?
- Is JSDoc used for public APIs?
- Are README files present and helpful?
- Is architecture documented?

**Developer Experience:**
- Is ESLint configured properly?
- Is Prettier used?
- Are pre-commit hooks set up?
- Is there a contributing guide?
- Are types exported for consumers?

---

## FINAL COMPREHENSIVE REPORT

After analyzing all sections above, provide:

### Executive Summary
- Overall architecture quality score (1-10)
- Top 3 strengths
- Top 5 critical issues

### Detailed Findings

**🟢 What's Working Well:**
- List specific good patterns found
- Praise well-architected areas
- Highlight best practices being followed

**🔴 Critical Issues (Fix Immediately):**
1. [Issue] - [Location] - [Impact]
2. [Issue] - [Location] - [Impact]
...

**🟡 High Priority Improvements:**
1. [Issue] - [Location] - [Suggested Fix]
2. [Issue] - [Location] - [Suggested Fix]
...

**🔵 Medium Priority Improvements:**
1. [Enhancement] - [Benefit]
2. [Enhancement] - [Benefit]
...

**💡 Quick Wins (Easy fixes, high impact):**
1. [Quick fix] - [Estimated time] - [Impact]
2. [Quick fix] - [Estimated time] - [Impact]
...

### SOLID Principles Score Card
- Single Responsibility: __/10
- Open/Closed: __/10
- Liskov Substitution: __/10
- Interface Segregation: __/10
- Dependency Inversion: __/10
- **Overall SOLID Score: __/10**

### Testability Score: __/10
**Breakdown:**
- Can be unit tested: __/10
- Can be integration tested: __/10
- Mocking difficulty: __/10
- Test coverage potential: __/10

### Maintainability Score: __/10
**Breakdown:**
- Code organization: __/10
- Code complexity: __/10
- Code duplication: __/10
- Documentation: __/10

### Refactoring Roadmap

**Phase 1: Foundation (Week 1-2)**
- [ ] Fix critical issues
- [ ] Extract business logic from components
- [ ] Set up testing infrastructure

**Phase 2: Architecture (Week 3-4)**
- [ ] Implement proper separation of concerns
- [ ] Create service layer
- [ ] Refactor god components

**Phase 3: Optimization (Week 5-6)**
- [ ] Improve type safety
- [ ] Add missing tests
- [ ] Performance optimizations

**Phase 4: Polish (Week 7-8)**
- [ ] Documentation
- [ ] Code cleanup
- [ ] Developer experience improvements

### Recommended Architecture

Provide a specific recommended structure:

```
/app
  /(routes)
    /dashboard
      page.tsx              # Server Component
      loading.tsx
      error.tsx
    /products
      /[id]
        page.tsx
      
/components
  /ui                        # Presentational components
    /button
      Button.tsx
      Button.test.tsx
      index.ts
  /features                  # Smart/feature components
    /user-profile
      UserProfile.tsx
      useUserProfile.ts
      userProfile.test.tsx
      
/lib
  /api                       # API client abstraction
    client.ts
    types.ts
  /services                  # Business logic
    userService.ts
    productService.ts
  /utils                     # Pure utility functions
    formatters.ts
    validators.ts
    
/hooks                       # Shared custom hooks
  useAuth.ts
  useDebounce.ts
  
/types                       # Global TypeScript types
  api.ts
  models.ts
  
/constants                   # App constants
  routes.ts
  config.ts
  
/config                      # Configuration files
  site.ts
  
/tests                       # Test utilities
  setup.ts
  mocks.ts
```

### Code Examples: Before & After

Provide 3-5 concrete refactoring examples from the codebase showing:
- Current problematic code
- Improved version
- Explanation of benefits

### Tools & Libraries Recommendations
- Testing: [Recommendations]
- State Management: [Recommendations]
- Validation: [Recommendations]
- Type Safety: [Recommendations]

---

## Output Format

Present your analysis in a clear, structured markdown document with:
- Executive summary at the top
- Detailed sections with scores
- Specific code examples
- Actionable recommendations
- Priority-ordered task list

**Be specific:** Always reference actual file paths, line numbers, and code snippets from the codebase.

**Be constructive:** Frame issues as opportunities for improvement.

**Be practical:** Prioritize recommendations by impact vs effort.

---

## Begin Analysis

Please analyze the provided Next.js/TypeScript codebase thoroughly using the framework above. Focus on being specific, actionable, and constructive in your recommendations.
