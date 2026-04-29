# Fluxo-Alvo de Conversa de Voz Contínua

> Referência técnica para validação manual e debugging do pipeline de voz.
> Cada estado lista o evento que o dispara, o que acontece internamente e a
> string **exata** que deve aparecer no log de extensão (`NexusAI.log`).

---

## Arquitetura resumida

```
Webview (React)              Extension Host
─────────────────────────    ──────────────────────────────────────────────
MicButton (click) ─────────► start_voice_recording
                              └─► SpeakerGate.isBlocked()?
                                  ├─ SIM (<15s) → voice_result(error) ──► toast de aviso
                                  ├─ SIM (>15s) → releaseIfStale() → continua
                                  └─ NÃO → recordAndRespond()
                                       ├─ PreFlightChecks.runAll()
                                       ├─ VoiceAgent.recordAndRespond()
                                       │    ├─ AudioCapturePool.lease()
                                       │    │    ├─ POOL: → READY_TO_LISTEN (0ms)
                                       │    │    └─ fallback: FFmpeg start (~500ms)
                                       │    └─ aguarda stop_voice_recording
                                       └─ WhisperCliService.transcribeWithLanguageDetection()

MicButton (release) ────────► stop_voice_recording
                              └─► agent.stop()

                              STT concluído → voice_result { transcriptionText }
◄──────────────────────────── voice_result
ChatInput auto-submit ──────► LLM processa resposta

                              LLM response → VoiceSessionManager.requestSpeak()
                              └─► onSpeakRequest handler
                                   ├─ EdgeTtsService.synthesizeEdgeTts() × N sentences
                                   ├─ SpeakerGate.activate()
                                   ├─ broadcast(voice_agent_state_changed: PLAYING)
                                   ├─ HostAudioPlayer.playWavBuffer() × N (sequencial)
                                   └─ finally: SpeakerGate.deactivate()
                                              broadcast(voice_agent_state_changed: IDLE)

                              ✅ Gate livre → pronto para nova rodada
```

---

## Estados e transições

| # | Estado Avatar | Ação que dispara | Log key string |
|---|---------------|-----------------|----------------|
| 0 | `IDLE` | Extensão ativa, nenhuma gravação em curso | – |
| 1 | `INITIALIZING` | Usuário pressiona o botão de mic | `start_voice_recording recebido` |
| 2 | `INITIALIZING` | Preflight passando | `✅ Preflight checks passed` |
| 3 | `READY_TO_LISTEN` | Pool entrega captura pré-aquecida | `POOL — READY_TO_LISTEN instantaneous` |
| 3b | `READY_TO_LISTEN` | Sem pool, FFmpeg iniciado do zero | `State: READY_TO_LISTEN - Pode falar agora` |
| 4 | `RECORDING` | Primeiro chunk de áudio chega | `Chunk #1 \|` |
| 5 | `PROCESSING` | Usuário solta o botão | `stop_voice_recording received` |
| 5 | `PROCESSING` | STT iniciando | `🔄 Step 3: Running Whisper transcription` |
| 6 | `IDLE` (webview) | STT concluído, resultado enviado | `✍️ Transcrição:` |
| 7 | `IDLE` (webview) | LLM termina resposta | `onSpeakRequest FIRED` |
| 8 | `PLAYING` | Gate ativado, broadcast PLAYING | `voice_agent_state_changed` → `PLAYING` |
| 8 | `PLAYING` | Síntese de cada sentença | `[TTS] … ✅ Synth[1] done:` |
| 8 | `PLAYING` | Reprodução de cada sentença | `[TTS] … 🔊 Playing sentence 1/` |
| 9 | `IDLE` | TTS finalizado, gate desativado | `[TTS] … 🏁 TTS pipeline complete` |
| 9 | `IDLE` | Broadcast IDLE | `voice_agent_state_changed` → `IDLE` |
| 10 | **Pronto** | Gate `isBlocked()` = false | próximo `start_voice_recording` passa sem rejeição |

---

## Checklist de validação em 2 minutos

Execute uma conversa de voz completa (uma pergunta + resposta do LLM) e cole
as linhas abaixo no filtro do log. Todas devem aparecer **na ordem indicada**.

```bash
# Filtro para Linux/macOS — adapte para Get-Content no PowerShell
grep -E "start_voice_recording recebido|Preflight checks passed|\
READY_TO_LISTEN|stop_voice_recording received|Whisper transcription|\
Transcrição:|onSpeakRequest FIRED|voice_agent_state_changed|TTS pipeline complete" \
  ~/Library/Logs/NexusAI/NexusAI.log | tail -30
```

```powershell
# PowerShell (Windows)
Get-Content "$env:APPDATA\NexusAI\logs\NexusAI.log" -Tail 200 |
  Select-String "start_voice_recording recebido|Preflight checks passed|`
READY_TO_LISTEN|stop_voice_recording received|Whisper transcription|`
Transcrição:|onSpeakRequest FIRED|voice_agent_state_changed|TTS pipeline complete"
```

### Sequência esperada para **UMA** rodada

```
[recordAndRespond]  🎤 start_voice_recording recebido
[recordAndRespond]  ✅ Preflight checks passed
[VoiceAgent]        State: INITIALIZING → READY_TO_LISTEN (Pode falar agora)
                    ─ ou ─
                    🎙️ POOL — READY_TO_LISTEN instantaneous (zero warmup)
[VoiceAgent]        State: READY_TO_LISTEN → RECORDING
[VscodeWebviewProvider] stop_voice_recording received at T=…
[recordAndRespond]  🔄 Step 3: Running Whisper transcription…
[recordAndRespond]  ✍️ Transcrição: "…texto transcrito…"
[TTS]               onSpeakRequest FIRED — N chars
[TTS]               ✅ Synth[1] done: … B in …ms
[TTS]               🔊 Playing sentence 1/N: …ms
[recordAndRespond / broadcast] voice_agent_state_changed → PLAYING
[TTS]               🏁 TTS pipeline complete — total …ms
[recordAndRespond / broadcast] voice_agent_state_changed → IDLE
```

### Verificação de segunda rodada (loop contínuo)

Após o log mostrar `IDLE`, pressione o mic novamente. O log **não deve** conter:

```
Speaker gate active … — rejecting recording request during TTS
```

Se aparecer, o gate ficou bloqueado — verificar se `SpeakerGate.deactivate()` foi
chamado (deve aparecer `TTS pipeline complete` antes do segundo `start_voice_recording`).

---

## Diagnósticos rápidos por sintoma

| Sintoma | String a buscar no log | Causa provável |
|---------|----------------------|----------------|
| Mic não responde após TTS | `Speaker gate active … ms — rejecting` | Gate preso; espere 15 s ou reinicie a extensão |
| Gate auto-liberado | `Speaker gate was stale and got auto-released` | TTS travou; gate liberado por watchdog de 15 s |
| Sem áudio na resposta | `Edge TTS audio conversion failed` | Falha na conversão MP3→WAV; verificar rede/Edge TTS |
| Transcrição em branco | `[BLANK_AUDIO]` | Silêncio detectado; verificar microfone |
| FFmpeg ausente | `FFMPEG_NOT_FOUND` | Instalar FFmpeg e reiniciar VS Code |
| STT trava | `stt failed` | Whisper CLI com erro; verificar modelo e `globalStoragePath` |

---

## Invariantes críticos do sistema

1. **SpeakerGate é singleton** — nunca existem dois leitores simultâneos.  
2. **`activate()` + `deactivate()` sempre em par** — o `finally` do handler TTS garante `deactivate()` mesmo em erro.  
3. **`releaseIfStale(15000)`** — se o gate ficar preso >15 s a próxima tentativa de gravação o libera automaticamente e registra `Speaker gate was stale and got auto-released`.  
4. **`controller.pendingVoiceInput = true`** só é setado **após** STT bem-sucedido — garante que o ChatInput submeta automaticamente apenas transcrições válidas.  
5. **AudioCapturePool** pré-aquece imediatamente após cada `lease()` — o segundo ciclo é sempre fast-path (zero warmup), exceto na primeira chamada da sessão.

---

## Diagrama de estados do SpeakerGate

```
         ┌──────────────────────────────────────────┐
         │              SpeakerGate                 │
         │                                          │
  isBlocked=false ◄──── deactivate() ──────────── isBlocked=true
         │                                       ▲  │
         │ activate()                            │  │
         └───────────────────────────────────────┘  │
                                                     │
                          releaseIfStale(15000) ─────┘
                          (auto-libera se >15s bloqueado)
```

---

*Última atualização gerada automaticamente pelo agente de codificação. Regenerar após mudanças em `VscodeWebviewProvider.ts`, `recordAndRespond.ts`, `SpeakerGate.ts` ou `EdgeTtsService.ts`.*
