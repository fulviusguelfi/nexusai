# Planner Skill
Break down complex tasks into manageable, executable steps.

## When to Use
- Task requires 3+ dependent steps
- Risk of breaking existing functionality
- Multiple files or systems are involved
- Estimating effort or validating scope before implementation

## Required Plan Sections
1. **Objective** — one sentence: what success looks like
2. **Scope** — explicitly list what is IN scope and OUT of scope
3. **Dependencies** — files/services/APIs that must be understood first
4. **Ordered Tasks** — numbered list with: action + affected file(s) + acceptance criteria
5. **Risks** — potential breakage points and mitigations
6. **Test Strategy** — how to verify each task completed correctly

## Output Format Example
```
## Objective
Add `http_request` tool that blocks SSRF for private IPs.

## Scope
IN: new tool handler, SSRF guard, unit tests
OUT: webview changes, E2E tests (follow-up)

## Tasks
1. Define tool spec in `src/shared/tools.ts` (add to ClineDefaultTool)
2. Implement HttpRequestToolHandler.ts with SSRF guard
3. Register in ToolExecutor.ts
4. Add to variant configs
5. Write unit tests for SSRF scenarios

## Risks
- SSRF false positives for RFC1918 ranges — mitigate with `trusted_local` flag

## Test Strategy
- Unit: test private IP blocking + public IP allowed + trusted_local bypass
```

## Anti-Patterns to Avoid
- Implementing before understanding existing patterns (read code first)
- Plans without acceptance criteria
- Scope creep: start minimal, add features in follow-up tasks