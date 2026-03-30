# Fase 6 — Avatar Animado com Lip Sync

## Visão Geral

A Fase 6 completa as entregas pendentes da Fase 5 (speaker gate, avatar interativo, personalidade configurável) e entrega a identidade visual "voice-first" do NexusAI: um avatar 2D animado que sincroniza os lábios com o áudio TTS, offline, dentro do webview do VSCode.

---

## Arquitetura do Pipeline de Voz

```
Usuário fala
     │
     ▼
[Whisper STT]           ← src/services/voice/WhisperService.ts
     │ transcrição
     ▼
[Task → LLM]            ← src/core/task/index.ts
     │ resposta
     ▼
[Piper TTS]             ← src/services/voice/PiperTtsService.ts
     │ WAV buffer
     ├──────────────────────────────────────────┐
     ▼                                          ▼
[RhubarbService]        ← Node.js WASM    [playWavOnHost]  ← áudio real
     │ PhonemeTimeline                          │ SpeakerGate.activate()
     ▼                                          │
[voice_audio_play msg]  → webview              ─┘
     │ { wavBase64, phonemeTimeline }
     ▼
[useAvatarState hook]   ← webview
     │ cria HTMLAudioElement mudo (timing)
     │ cria LipSyncController
     ▼
[RAF loop]              → setCurrentViseme(ctrl.getVisemeAt(audio.currentTime))
     │
     ▼
[AvatarOverlay]         ← renderiza visema atual via AvatarSvg
```

---

## Sub-Fase 6.1 — SpeakerGate

**Arquivo**: `src/services/voice/SpeakerGate.ts`

Singleton que bloqueia o STT durante reprodução TTS, evitando feedback loop (microfone capturando a própria fala do avatar).

```typescript
SpeakerGate.getInstance().activate()   // antes do playback
SpeakerGate.getInstance().deactivate() // após o playback

// Guard no handler de gravação:
if (SpeakerGate.getInstance().isBlocked()) break
```

### Comportamento

- `activate()` → `isBlocked()` retorna `true`; idempotente (múltiplos calls não acumulam)
- `deactivate()` → `isBlocked()` retorna `false`; dispara evento `onDidChange`
- `dispose()` → reseta estado e remove listeners (usado em testes)

---

## Sub-Fase 6.2 — Avatar Core

### AvatarSvg (`webview-ui/src/components/voice/avatar/AvatarSvg.tsx`)

SVG inline `viewBox="0 0 200 200"` com grupos animados via framer-motion:

| Grupo | Animação |
| ----- | -------- |
| `head-bg` | escala base do avatar |
| `left-eye`, `right-eye` | `scaleY` para blink a cada 4s |
| `left-eyebrow`, `right-eyebrow` | `translateY` por estado |
| `mouth` | 9 grupos, um por visema — apenas o ativo fica visível |

### AvatarOverlay (`webview-ui/src/components/voice/avatar/AvatarOverlay.tsx`)

- Posição `fixed bottom-6 right-6 z-50` (não afeta layout)
- Recebe `agentState`, `currentViseme`, `avatarName`, `isVisible`
- Retorna `null` quando `isVisible=false` (zero renderização)

### Variantes de animação framer-motion

| Estado | Animação |
| ------ | -------- |
| `IDLE` | respiração lenta (scale 0.98→1.0, 3s loop) |
| `RECORDING` | pulse rápido (scale 0.97→1.02, 0.5s) |
| `PROCESSING` | oscilação horizontal dos olhos |
| `PLAYING` | leve nod + boca controlada pelo visema atual |
| `ERROR` | olhos semicerrados, boca curvada para baixo |

### useAvatarState (`webview-ui/src/hooks/useAvatarState.ts`)

Hook que:
1. Escuta `voice_agent_state_changed` → atualiza `agentState`
2. Escuta `voice_audio_play` → cria `LipSyncController` + `HTMLAudioElement` mudo
3. RAF loop → `setCurrentViseme(ctrl.getVisemeAt(audio.currentTime))`
4. Retorna `{ agentState, currentViseme, isVisible }`

`isVisible = avatarEnabled && (voiceTtsEnabled || voiceSttEnabled)`

---

## Sub-Fase 6.3 — Lip Sync Engine

### Mapa de Visemas (Hanna-Barbera)

| Visema | Descrição | Sons Típicos |
| ------ | --------- | ------------ |
| A | neutro / repouso | silêncio entre palavras |
| B | boca aberta média | vogais médias |
| C | abertura pequena | vogais fechadas |
| D | boca bem aberta | "ah", vogais abertas |
| E | sorriso aberto / dentes | "ee", "ih" |
| F | lábio inferior + dentes superiores | f, v |
| G | arredondado estreito | w, "oo" |
| H | arredondado | "oh", o |
| X | fechada / silêncio | pausa |

### RhubarbService (`src/services/voice/RhubarbService.ts`)

Roda no **extension host** (Node.js), não no webview:

```typescript
const timeline = await new RhubarbService().extractTimeline(wavBuffer)
// → [{ start: 0.0, end: 0.3, value: "X" }, { start: 0.3, end: 0.6, value: "B" }, ...]
```

**Conversão de sample rate**: Piper gera WAV a 22050Hz; Rhubarb requer PCM 16kHz 16-bit mono. `wavToPcm16k()` faz resample via interpolação linear sem dependências externas.

**Fallback**: qualquer erro no WASM retorna `[{ start: 0, end: 1.0, value: "X" }]` — o avatar fica parado sem lançar erro ao usuário.

### LipSyncController (`webview-ui/src/components/voice/avatar/LipSyncController.ts`)

Pura TypeScript, sem React. Binary search na `PhonemeTimeline`:

```typescript
const ctrl = new LipSyncController(phonemeTimeline)
ctrl.getVisemeAt(0.45) // → "B"
ctrl.getDurationSeconds() // → duração total
```

Performance: lookup em timeline de 1000 entradas < 1ms.

---

## Sub-Fase 6.4 — Personalidade do Avatar

### System Prompt (`src/core/prompts/system-prompt/components/voice_behavior.ts`)

Quando voz está ativa, o system prompt inclui:

1. **Comportamento de voz**: mensagens com `<voice_input_hint>` → usar `attempt_completion` imediatamente
2. **Identidade do avatar**: nome configurável, regra anti-confusão (nunca repetir a fala do usuário)
3. **Personalidade**:
   - Tom: `formal` / `casual` / `technical`
   - Modo de resposta: `concise` (≤2 frases) / `detailed` / `conversational`

### Configurações (`SystemPromptContext`)

```typescript
avatarName?: string                                          // default: "NexusAI"
avatarPersonalityTone?: "formal" | "casual" | "technical"   // default: "casual"
avatarPersonalityResponseMode?: "concise" | "detailed" | "conversational" // default: "concise"
```

### Settings UI

`VoiceSettingsSection.tsx` → subseção "Avatar & Personalidade":
- Toggle "Mostrar avatar"
- Input "Nome do avatar" (default: Nexus)
- Select "Tom de voz"
- Select "Modo de resposta"
- Select "Posição do avatar"

---

## Como Adicionar Novas Expressões

Para adicionar uma nova expressão ao avatar (ex: "surpreso"):

1. **AvatarSvg.tsx**: adicionar paths SVG específicos para a expressão
2. **AvatarOverlay.tsx**: adicionar `variants` de framer-motion para o novo estado
3. **useAvatarState.ts**: mapear o evento que dispara a nova expressão
4. Testes: `AvatarOverlay.spec.tsx` + `useAvatarState.test.ts`

---

## Como Adicionar Novos Visemas

O mapa de visemas é fixo pelo padrão Hanna-Barbera do Rhubarb. Para um sistema de visemas personalizado:

1. Forkar `rhubarb-lip-sync-wasm` e modificar o mapeamento de fonemas
2. Atualizar `VisemeLabel` em `RhubarbService.ts`
3. Adicionar novos grupos `<g data-viseme="...">` em `AvatarSvg.tsx`
4. Atualizar os testes de `LipSyncController` e `AvatarOverlay`

---

## Decisões de Arquitetura

| Decisão | Escolha | Alternativas Descartadas |
| -------- | ------- | ------------------------ |
| Lip sync engine | `rhubarb-lip-sync-wasm` no host Node.js | Rive (editor externo), Live2D (licença paga) |
| Renderização | SVG inline + React | Three.js (overhead), ReadyPlayerMe (cloud) |
| Animações | framer-motion (já no deps) | CSS keyframes (sem state transitions) |
| Timing sync | `HTMLAudioElement.currentTime` + RAF | Web Audio API (overhead desnecessário) |
| Audio playback | host (`playWavOnHost`) | webview Audio (CSP restrictions) |
| WASM no webview? | Não — roda no host | Evita `wasm-unsafe-eval` na CSP |

---

## Fluxo de Dados Completo

```
1. Host sintetiza WAV via Piper
2. Host chama RhubarbService.extractTimeline(wavBuffer) → PhonemeTimeline
3. Host ativa SpeakerGate (bloqueia STT)
4. Host envia voice_audio_play { wavBase64, phonemeTimeline } ao webview
5. Host chama playWavOnHost (reproduz áudio real)
6. Webview: useAvatarState recebe voice_audio_play
7. Webview: cria LipSyncController(phonemeTimeline)
8. Webview: cria HTMLAudioElement mudo com mesmo base64 (timing reference)
9. Webview: inicia RAF loop → setCurrentViseme(ctrl.getVisemeAt(audio.currentTime))
10. Webview: AvatarOverlay renderiza o visema correto a cada frame
11. Host: ao terminar playback, desativa SpeakerGate
12. Webview: audio.onended → cancelAnimationFrame, setCurrentViseme("X")
```
