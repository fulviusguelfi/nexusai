# Researcher Skill
Research, knowledge aggregation, and information retrieval for NexusAI tasks.

## Capabilities
- Web search and documentation lookup (via MCP Fetch/Brave Search/Puppeteer)
- GitHub repository analysis (search issues, PRs, code patterns)
- Save and retrieve findings from local `knowledge/` directory

## Knowledge Storage Structure
```
knowledge/
  snippets/   # Reusable code snippets with context
  docs/       # Downloaded documentation pages
  research/   # Investigation findings and summaries
  projects/   # GitHub project analyses
  notes/      # Misc notes and references
```

## Search Strategy
1. Check local `knowledge/` for cached findings first
2. Search official docs (MDN, Node.js, VS Code API, etc.)
3. Check GitHub issues/discussions for community solutions
4. Synthesize findings into a structured summary

## Output Format for Findings
```markdown
## Finding: [topic]
**Source**: [URL or file]
**Date**: YYYY-MM-DD
**Summary**: ...
**Code Example**:
```ts
// example
```
**Relevance to NexusAI**: ...
```

## NexusAI-Specific Research Targets
- VS Code Extension API: https://code.visualstudio.com/api
- Protobuf/proto3 syntax: https://protobuf.dev/programming-guides/proto3/
- Whisper/Piper release notes for new models
- Anthropic API docs for new message formats