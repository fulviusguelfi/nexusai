# QA Documentation Agent - Quick Reference

## Overview
The QA Documentation Agent is a specialized subagent designed to analyze test coverage, fix failing tests, and consolidate documentation for NexusAI.

**Location**: `.agents/qa-documentation-agent.md`  
**Version**: 1.0.0  
**Created**: March 31, 2026

## Quick Start

### 1. Launch the Agent
Using the Cline extension or CLI:
```
Use the subagent: "qa-documentation-agent"
```

### 2. Give It a Task
Examples of effective prompts:
```
"Analyze test coverage for src/core/prompts and identify gaps"
"Review failing tests in src/api and fix them"
"Consolidate documentation in docs/ with actual code state"
"Check coverage for src/services/mcp and write missing tests"
```

### 3. The Agent Will
✓ Make a plan first (ask clarifying questions if needed)  
✓ Analyze the specified module systematically  
✓ Identify test gaps and documentation issues  
✓ Write/fix tests autonomously  
✓ Update documentation  
✓ Report progress and save to memory  

## Module Analysis Strategy

### For Test Coverage Tasks
1. **Specify a module**: `src/core/prompts`, `src/api/`, `src/services/`, etc.
2. Agent will:
   - Find all source files in the module
   - Find corresponding test files
   - Identify untested functions/edge cases
   - Write new tests or fix failing ones
   - Run test suite to validate

### For Documentation Tasks
1. **Specify the documentation scope**: "docs/tools-reference", "PLAN.md updates", etc.
2. Agent will:
   - Read affected documentation files
   - Compare with current source code
   - Identify outdated or missing info
   - Create consolidated versions
   - Preserve all important details

### For Combined Tasks
```
"Audit src/utils/ - check coverage, write missing tests, and ensure docs match"
```

## Expected Outputs

After running the agent, you'll receive:
- **Coverage Report**: Which functions/modules have tests, which don't
- **Test Changes**: New test files or updates to existing tests
- **Documentation Updates**: Modified doc files with current info
- **Progress Report**: Summary of what was completed
- **Memory Update**: Saved to `/memories/session/` for continuity

## Commands Reference

### Running Tests
```bash
npm run test:unit                              # Run all tests
npm run test:unit -- --grep "specific test"    # Run specific test
UPDATE_SNAPSHOTS=true npm run test:unit        # Update snapshots
npm run watch-tests                            # Watch mode
```

### Building/Compiling
```bash
npm run compile                # Compile TypeScript (required after edits)
npm run protos                 # Generate Protobuf (run if .proto files changed)
npm run watch                  # Auto-compile on file changes
```

## When to Use This Agent

✓ **After code changes**: Run coverage analysis to find what tests are needed  
✓ **Before releases**: Consolidate docs and ensure everything is documented  
✓ **When test suite fails**: Let the agent debug and fix failures  
✓ **For refactoring**: Verify test coverage before/after changes  
✓ **For onboarding**: Analyze modules to understand coverage state  

## Agent Capabilities

✓ Reads and analyzes TypeScript code  
✓ Writes tests following project conventions  
✓ Runs test suite and captures output  
✓ Executes bash commands (npm, git, etc.)  
✓ Creates and edits files  
✓ Searches across codebase  
✓ Consolidates information without data loss  
✓ Tracks progress between sessions  

## Memory & Continuity

The agent saves progress to `/memories/session/nexusai-qa-agent-task.md` including:
- What modules were analyzed
- Which tests were written/fixed
- Documentation changes made
- Next steps for the next session

To continue work:
1. Check the session memory for where we left off
2. Give the agent the next module to analyze
3. It will reference its previous work automatically

## Example Workflow

### Session 1: Analyze Core Prompts
```
You: "Analyze test coverage for src/core/prompts/"
Agent: [Makes plan, reads files, writes report]
Output: Test coverage report + identified gaps saved to memory
```

### Session 2: Fix Remaining Tests
```
You: "Fix failing tests in src/core/prompts and write missing ones"
Agent: [References previous analysis, writes/fixes tests]
Output: All tests passing + memory updated
```

### Session 3: Consolidate Docs
```
You: "Update documentation to match src/core/prompts latest code"
Agent: [Reads code, reads docs, consolidates info]
Output: Updated doc files + memory cleared for next module
```

## Customization

To modify the agent:
1. Edit `.agents/qa-documentation-agent.md`
2. Update the YAML frontmatter for tools/modelId if needed
3. Modify the system prompt if you want different behavior
4. Save and the next invocation will use the new config

## Troubleshooting

### "Agent seems to be analyzing forever"
- Give it a smaller, more specific module
- The agent optimizes for accuracy over speed
- Check `/memories/session/` for what it's working on

### "Tests are still failing after agent runs"
- Some tests may require external setup (mocking, fixtures)
- Agent will document which tests need manual review
- These will appear in the progress report

### "Documentation got messed up"
- Agent preserves all information during consolidation
- Check git diff to see what changed
- Use `git checkout` to revert if needed

### "Coverage metrics seem incomplete"
- Agent may need clarification on testing strategy
- It will ask follow-up questions via the `ask` tool
- Answer clearly and it will continue

## Related Skills & Workflows

The agent uses these project skills when relevant:
- **bug-report-workflow**: For tracking issues found during analysis
- **create-pull-request**: For submitting changes (future integration)

## For More Details

See the full agent documentation in `.agents/qa-documentation-agent.md`:
- 5-step QA cycle breakdown
- Detailed principles and guidelines
- Session continuity patterns
- Tool usage recommendations
