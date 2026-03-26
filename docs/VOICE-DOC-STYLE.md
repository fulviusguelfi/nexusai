# 📚 Voice Documentation Style Guide

**Purpose**: Ensure all Phase 5 (Voice) documentation follows consistent format, status tracking, and archival practices.

**Last Updated**: March 2026  
**Scope**: Applies to Fase 5 voice-related docs in `docs/` and `docs/wiki/`

---

## 1. Status Badges

Use these badges consistently in headers to indicate document status:

| Badge | Meaning | When to Use | Example |
|-------|---------|------------|---------|
| `✅ Completa` | Fully implemented, production-ready | Feature complete & tested | [Fase 1 — Fundação](Fase-1-Fundacao.md) |
| `🔄 Em Desenvolvimento` | Active work in progress | Current sprint work | Fase 5 — Voz (TTS/STT) |
| `⏳ Planejada` | Planned but not started | Roadmap items | Fase 4 — IoT |
| `🔴 ARCHIVED` | Historical snapshot, do not use | Old approaches, obsolete | [archived/STT-TTS-DEVELOPMENT.md](archived/STT-TTS-DEVELOPMENT.md) |

### Status Badge Format

**In headers (Markdown `#`):**
```markdown
## Título — Descrição 🎙️

**Status**: 🔄 Em Desenvolvimento (70%)
```

**In tables (Roadmap/status tables):**
```markdown
| 5 | Voz (TTS/STT) | 1.0.0-rc | 🔄 Em Desenvolvimento (70%) |
```

**In archived docs (top of file):**
```markdown
🔴 **ARCHIVED DOCUMENT** — Brief reason why. [Link to current equivalent](link)

---
```

---

## 2. Required Sections (Order & Format)

### For **Active** Documentation (✅ / 🔄 status)

1. **Header** (H1, includes badge)
   ```markdown
   # Feature Title 🎙️
   ```

2. **Status Block** (immediately after h1)
   ```markdown
   **Status**: 🔄 Em Desenvolvimento (70%)  
   **Last Updated**: [Date]  
   **Scope**: [What this doc covers]
   ```

3. **Quick Summary** (1-2 sentences, bold intro)
   ```markdown
   **What This Is**: Brief description of what users/devs need to know.
   ```

4. **Architecture / Overview** (conceptual diagram optional)
   - Visual + text explanation
   - Links to related code files: `[filename.ts](../src/path/filename.ts)`

5. **Implementation Details** (code examples, process flows)
   - Use code blocks with language: `` ```typescript ``
   - Cross-reference with relative links to source files

6. **Testing** (how to validate)
   - Links to test files: `[test.ts](../src/path/test.ts)`
   - Example commands to run

7. **Known Issues / TODOs** (if any)
   - Use checkbox format: `- [ ] Task not done` or `- [x] Task done`

8. **Related Issues** (if applicable)
   - Link to GitHub issues: `[#55](https://github.com/...)`

---

## 3. File Naming Conventions

### Active Docs
- **Wiki pages**: `Fase-X-[DescricaoCurta].md` (e.g., `Fase-5-Voice.md`)
- **Guides**: `[FEATURE]-[TYPE]-[PURPOSE].md` (e.g., `VOICE-RECORDS-CLI.md`)
- **Root docs**: `[PROJECT]-[PURPOSE].md` (e.g., `PLAN.md`, `ROADMAP.md`)

### Archived Docs
- **Location**: `docs/archived/`
- **Naming**: Keep original name, same as active file
- **Header**: Add 🔴 **ARCHIVED** banner at top with reason + link to current doc

---

## 4. Link Format Standards

### Within Project (Relative Links)

**From `/docs/` to another doc:**
```markdown
[Link Text](../path/file.md)          ← Go up 1 level
[Link Text](wiki/Fase-5-Voice.md)     ← Same level
[Link Text](archived/old-doc.md)      ← Sibling folder
```

**From `/docs/wiki/` to source code:**
```markdown
[WhisperService.ts](../../src/services/voice/WhisperService.ts)
[whisper.worker.ts](../../src/services/voice/whisper.worker.ts)
```

**Line references in code files:**
```markdown
[VoiceResponseHandler line 50](../../src/services/voice/VoiceResponseHandler.ts#L50)
```

### External Links (GitHub Issues, etc.)
```markdown
[Issue #55 — Unit Tests](https://github.com/yourusername/your-repo/issues/55)
```

---

## 5. Code Examples

### Include Language Tag
```typescript
// ✅ CORRECT
const result = await WhisperService.transcribe(float32, 16000)
```

```
❌ WRONG — No language tag
const result = await WhisperService.transcribe(float32, 16000)
```

### Show Input → Process → Output
```typescript
// 1. INPUT: Audio buffer from microphone
const audioBuffer = new Float32Array([...])  // 16kHz, 16-bit PCM

// 2. PROCESS: Call service
const result = await VoiceResponseHandler.processSpeechToText(audioBuffer, {
  userLanguage: "pt"  // Portuguese hint for Whisper
})

// 3. OUTPUT: Transcription + detected language
console.log(result.transcriptionText)  // "Eu sou do Brasil"
console.log(result.detectedLanguage)   // "pt"
```

---

## 6. Tables (Status, Design, Metrics)

### Status Table Format
```markdown
| Component | Status | Notes |
|-----------|--------|-------|
| WhisperService | ✅ 100% | Unit tests pending |
| PiperService | ✅ 100% | Tested in CLI |
| Webview UI | 🔄 50% | Recording UI done, chat integration pending |
```

### Architecture Table
```markdown
| Layer | Technology | File | Status |
|-------|-----------|------|--------|
| STT | Whisper (ONNX) | `whisper.worker.ts` | ✅ Complete |
| TTS | Piper | `PiperService.ts` | ✅ Complete |
| Language Detection | Heuristic | `whisper.worker.ts` | ✅ Portuguese working |
```

---

## 7. Lists & Checklists

### Use Standard Markdown

**Unordered:**
```markdown
- Item 1
  - Nested item 1.1
  - Nested item 1.2
- Item 2
```

**Ordered:**
```markdown
1. First step
2. Second step
   - Sub-step 2.1
   - Sub-step 2.2
```

**Checklist (progress tracking):**
```markdown
- [x] Backend STT complete
- [x] Backend TTS complete
- [ ] Webview UI recording
- [ ] Webview UI playback
- [ ] E2E tests passing
```

---

## 8. Archival Criteria & Process

### When to Archive a Doc

- ❌ **DO NOT** delete docs
- ✅ **DO** move to `docs/archived/` with 🔴 header if:
  - Approach was superseded by new design
  - Document is >3 months old without updates
  - Information contradicts current implementation
  - Doc is historical snapshot / "for reference only"

### Archival Header Template

```markdown
🔴 **ARCHIVED DOCUMENT** — [REASON: e.g., "Superseded by CLI-first approach"]

**Why archived**: [Brief explanation]  
**When**: [Date archived]  
**See also**: [Link to equivalent current doc]

---

[Original content below]
```

### Example Archive Header
```markdown
🔴 **ARCHIVED DOCUMENT** — Early development snapshot. See [Fase 5 — Voz](../../wiki/Roadmap.md#fase-5--voz-ttstts-) for current status.

**Why archived**: CLI-first approach documented; webview port now in progress  
**When**: March 2026  
**Active equivalent**: [Roadmap — Fase 5](../../wiki/Roadmap.md)

---
```

---

## 9. Portuguese vs English

### Language Policy

- **Primary language**: Portuguese (pt-BR) for user-facing docs
- **Secondary**: English for code comments + inline explanations
- **Mixing**: Acceptable when clarity requires (e.g., "Web Audio API")

### Example
```markdown
## 🎤 Captura de Áudio

A solução usa **Web Audio API** para gravar microphone em contexto webview.

Diferente da CLI que usa FFmpeg, a webview acessa o navegador nativo.
```

---

## 10. Examples of Compliant Docs

✅ **Good** [Roadmap.md](Roadmap.md):
- Clear phase status badges
- Table format for overview
- Links to related docs
- Sections in logical order

✅ **Good** [Fase-1-Fundacao.md](wiki/Fase-1-Fundacao.md):
- Status header block
- Architecture section with code links
- Checklist of completed items
- Related issues linked

🔴 **Archived** [archived/STT-TTS-DEVELOPMENT.md](archived/STT-TTS-DEVELOPMENT.md):
- 🔴 header at top
- Clear reason for archival
- Link to current equivalent
- Original content preserved

---

## 11. Validation Checklist

Before publishing a voice doc, verify:

- [ ] **Status badge** in header (✅ / 🔄 / ⏳ / 🔴)
- [ ] **Date** in status block (Last Updated)
- [ ] **All links work** (relative paths correct, files exist)
- [ ] **Code examples** have language tags (```typescript)
- [ ] **Line references** use anchor format (#L50)
- [ ] **TODOs/issues** are tracked with checkboxes or issue links
- [ ] **Portuguese spelling** is correct (or accept English code terms)
- [ ] **Tables** use | format with header row
- [ ] **No dead links** to archived docs (use link to current)
- [ ] **Related code files** linked with [filename.ts](path) format

---

## 12. Questions & Contacts

- **Doc changes**: Update this style guide
- **Status changes**: Update badge + "Last Updated" date
- **New sections**: Follow Section 2 order
- **Questions**: Reference this guide or open a doc-related issue

---

**Last Reviewed**: March 2026  
**Maintained By**: NexusAI Documentation Team
