# Developer Skill
General software development assistance for this codebase.

## NexusAI-Specific Notes
- Build: `npm run compile`. Tests: `npm run test:unit`. Update snapshots: `UPDATE_SNAPSHOTS=true npm run test:unit`.
- Paths: use `src/utils/path` helpers (`toPosixString`) for cross-platform.
- Logging: `src/shared/services/Logger.ts`.
- Protos: any `.proto` change → `npm run protos` immediately.
- See `.clinerules/general.md` for the full tribal knowledge guide.