# Fase 5 — Voz (TTS, STT, Push-to-Talk) ✅

> **Status**: Concluída  
> **Branch**: `feat/fase-5-voice` → PR para `develop`

A Fase 5 entregou síntese de voz (TTS) e reconhecimento de fala (STT) totalmente **offline**, integrados ao loop do agente como ferramentas de primeira classe, com UI push-to-talk no chat e configuração via painel de Settings.

---

## Sumário

- [Ferramentas Implementadas](#ferramentas-implementadas)
- [Arquitetura de Voz](#arquitetura-de-voz)
- [Serviços Backend](#serviços-backend)
- [Frontend e UI](#frontend-e-ui)
- [Protocolo gRPC](#protocolo-grpc)
- [Chaves de Estado](#chaves-de-estado)
- [Renderização no Chat](#renderização-no-chat)
- [Testes Unitários](#testes-unitários)
- [Configuração e Modelos Offline](#configuração-e-modelos-offline)
- [Issues Relacionados](#issues-relacionados)

---

## Ferramentas Implementadas

| Ferramenta | Handler | Descrição |
|---|---|---|
| `speak_text` | `SpeakTextToolHandler` | Sintetiza e reproduz texto via Piper TTS (offline). Exibe o trecho falado no chat como `voice_speak`. |
| `listen_for_speech` | `ListenForSpeechToolHandler` | Aguarda gravação do usuário, transcreve via Whisper (offline) e devolve o texto ao agente. Exibe no chat como `voice_listen`. |

Ambas seguem o ciclo: validação de estado → `say(tipo, texto)` → ação assíncrona → `formatResponse.toolResult(resultado)`.

---

## Arquitetura de Voz

### Fluxo TTS (`speak_text`)

```
agente → SpeakTextToolHandler.execute()
           ├─ valida voiceTtsEnabled (GlobalState)
           ├─ say("voice_speak", texto)        → ChatRow renderiza caixa "Spoke:"
           └─ VoiceSessionManager.requestSpeak(texto)
                └─ VscodeWebviewProvider listener
                       └─ PiperService.synthesize(texto)
                              └─ .wav reproduzido via AudioContext (webview)
```

### Fluxo STT (`listen_for_speech`)

```
agente → ListenForSpeechToolHandler.execute()
           ├─ valida voiceSttEnabled (GlobalState)
           ├─ say("voice_listen", prompt)      → ChatRow renderiza caixa "Listening…"
           └─ VoiceSessionManager.waitForTranscription(30 s)
                   ↑
                   │   (resolve quando usuário fala)
                   │
         VoiceRecorder (botão push-to-talk no ChatTextArea)
           └─ Float32Array PCM 16 kHz
                └─ postMessage("voice_float32_audio")
                       └─ VscodeWebviewProvider
                              └─ WhisperService.transcribe()
                                     └─ @huggingface/transformers (ONNX Worker)
                                            └─ postMessage("voice_transcription", texto)
                                                   └─ VoiceSessionManager.setLastTranscription()
                                                          └─ waitForTranscription resolve!
```

### Diagrama de Camadas

```
┌─────────────────────────── Webview (React) ──────────────────────────────┐
│  VoiceRecorder (push-to-talk)  ──►  postMessage(voice_float32_audio)     │
│  VoiceSettingsSection  ──────►  UiServiceClient.setVoiceSettings()       │
│  ChatRow  ──────────────────►  renderiza voice_speak / voice_listen      │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │ vscode message passing
┌──────────────────────── Extension Host ──────────────────────────────────┐
│  VscodeWebviewProvider                                                   │
│    ├─ voice_float32_audio  ──►  WhisperService  ──►  voice_transcription │
│    └─ requestSpeak         ──►  PiperService   ──►  .wav (AudioContext)  │
│                                                                          │
│  VoiceSessionManager (singleton)                                         │
│    ├─ requestSpeak(text)          (TTS trigger)                          │
│    ├─ setLastTranscription(text)  (STT resultado)                        │
│    └─ waitForTranscription(ms)    (LST bloqueia agente)                  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Serviços Backend

### `VoiceSessionManager` (`src/services/voice/VoiceSessionManager.ts`)

Singleton leve sem dependências VSCode — testável em ambiente Node puro.

| Método | Função |
|---|---|
| `getInstance()` | Retorna ou cria a instância singleton |
| `setRecording(bool)` | Atualiza flag e emite `statusChange` |
| `setSpeaking(bool)` | Atualiza flag e emite `statusChange` |
| `setLastTranscription(text)` | Persiste última transcrição e emite evento `transcription` |
| `requestSpeak(text)` | Emite evento `speak` para VscodeWebviewProvider |
| `waitForTranscription(ms)` | `Promise` que resolve na próxima transcrição ou "" após timeout |
| `onDidChangeStatus(fn)` | Subscreve a mudanças de status; retorna disposer |
| `onSpeakRequest(fn)` | Subscreve a pedidos de TTS; retorna disposer |
| `dispose()` | Remove todos os listeners e reseta singleton |

### `PiperService` (`src/services/voice/PiperService.ts`)

Usa o binário `rhasspy/piper` (bundled em recursos). Converte texto → WAV e envia os bytes ao webview para reprodução via `AudioContext`.

### `WhisperService` + `whisper.worker.ts` (`src/services/voice/`)

Carrega modelo ONNX `Xenova/whisper-tiny` via `@huggingface/transformers` em um Worker dedicado. Recebe `Float32Array` com PCM a 16 kHz e devolve a transcrição em texto.

---

## Frontend e UI

### `VoiceRecorder.tsx`

Componente integrado ao `ChatTextArea`. Ao pressionar o botão de microfone (ícone `codicon-mic`):

1. Inicia `MediaRecorder` / `getUserMedia`
2. Coleta chunks Float32 PCM via `AudioWorklet`
3. Ao soltar o botão, envia `postMessage("voice_float32_audio", { audio: Float32Array })`

### `VoiceSettingsSection.tsx`

Seção em Settings → Voice com toggles para:

- **Enable TTS** (`voiceTtsEnabled`)
- **Enable STT** (`voiceSttEnabled`)
- **Piper Voice** (`voicePiperVoice`) — seletor de voz offline
- **Input Device** (`voiceInputDeviceId`) — microfone
- **Output Device** (`voiceOutputDeviceId`) — alto-falante

---

## Protocolo gRPC

Definido em `proto/cline/voice.proto`:

```protobuf
service VoiceService {
  rpc TranscribeAudio    (TranscribeAudioRequest)    returns (TranscribeAudioResponse);
  rpc SynthesizeSpeech   (SynthesizeSpeechRequest)   returns (SynthesizeSpeechResponse);
  rpc GetVoiceStatus     (google.protobuf.Empty)      returns (VoiceStatusResponse);
  rpc SetVoiceSettings   (SetVoiceSettingsRequest)    returns (google.protobuf.Empty);
}
```

Handlers em `src/core/controller/voice/`. Registrados em `protobus-services.ts`.

---

## Chaves de Estado

Adicionadas em `src/shared/storage/state-keys.ts` (GlobalState):

| Chave | Tipo | Padrão |
|---|---|---|
| `voiceTtsEnabled` | `boolean` | `false` |
| `voiceSttEnabled` | `boolean` | `false` |
| `voicePiperVoice` | `string` | `"en_US-lessac-medium"` |
| `voiceInputDeviceId` | `string` | `""` |
| `voiceOutputDeviceId` | `string` | `""` |

Lidas via `readGlobalStateFromDisk()` em `src/core/storage/utils/state-helpers.ts` e expostas em `ExtensionStateContext.tsx`.

---

## Renderização no Chat

Adicionados dois cases ao `switch(message.say)` em `ChatRow.tsx`:

| Tipo | Ícone Codicon | Label |
|---|---|---|
| `voice_speak` | `codicon-unmute` | "Speaking:" / "Spoke:" (conforme `message.partial`) |
| `voice_listen` | `codicon-mic` | "Listening for speech…" / "Transcription complete" |

O texto do parâmetro/transcrição aparece abaixo do cabeçalho via `<MarkdownRow>`.

---

## Testes Unitários

| Arquivo | Cobertura |
|---|---|
| `src/services/voice/__tests__/VoiceSessionManager.test.ts` | Singleton, setters, eventos statusChange, requestSpeak, waitForTranscription (resolve + timeout) |
| `src/core/task/tools/handlers/__tests__/SpeakTextToolHandler.test.ts` | TTS desabilitado, parâmetro ausente, fluxo de sucesso (say + requestSpeak + resultado) |
| `src/core/task/tools/handlers/__tests__/ListenForSpeechToolHandler.test.ts` | STT desabilitado, prompt padrão/customizado, transcrição recebida, timeout sem fala |

Total: **1307 testes unitários passando** (incluindo todos os anteriores das Fases 1–4).

---

## Configuração e Modelos Offline

### Piper TTS

O binário `piper` é bundled em `resources/piper/`. Vozes `.onnx` + `.json` ficam em `resources/piper/voices/`. Nenhuma chamada de rede é feita em runtime.

**Vozes incluídas:**

- `en_US-lessac-medium` (inglês US, qualidade alta)
- `pt_BR-faber-medium` (português BR, qualidade média)

### Whisper STT

O modelo `Xenova/whisper-tiny` (~150 MB ONNX) é baixado na primeira execução de STT e armazenado em cache pelo `@huggingface/transformers`. Executa inteiramente no Worker sem acesso à internet após o download inicial.

---

## Issues Relacionados

| Issue | Descrição | Status |
|---|---|---|
| #40 | [Voice] Integrar PiperService ao loop do agente | ✅ Fechado |
| #41 | [Voice] Implementar WhisperService offline | ✅ Fechado |
| #42 | [Voice] VoiceSessionManager singleton + eventos | ✅ Fechado |
| #43 | [Voice] Ferramentas speak_text e listen_for_speech | ✅ Fechado |
| #44 | [Voice] VoiceRecorder push-to-talk no ChatTextArea | ✅ Fechado |
| #45 | [Voice] VoiceSettingsSection + chaves de estado | ✅ Fechado |
| #46 | [Voice] ChatRow renderização voice_speak/voice_listen | ✅ Fechado |
| #47 | [Voice] Testes unitários cobrindo serviços e handlers | ✅ Fechado |
