# NexusAI — Roadmap

> Última atualização: 2026-03-21  
> Para detalhes completos de cada fase, veja `docs/wiki/Fase-*.md`

---

## Status Geral

| Fase | Nome | Data Conclusão | Status |
|------|------|----------------|--------|
| 1 | Fundação | 2026-03-10 | ✅ Concluída |
| 2 | Controle Local | 2026-03-11 | ✅ Concluída |
| 3 | SSH e Rede | 2026-03-13 | ✅ Concluída |
| 4 | IoT (MQTT, HTTP, Dispositivos) | 2026-03-14 | ✅ Concluída |
| 5 | Voz (TTS/STT) | 2026-03-15 | ✅ Concluída |
| — | Rebranding Cline → NexusAI | 2026-03-17 | 🔄 8/10 etapas concluídas |
| — | Refactoring Task.ts | 2026-03-18 | 🔄 2/5 sub-issues concluídos |
| 6 | Agentes Autônomos | — | ⏳ Planejada |
| — | Release 1.0.0 Stable | — | ⏳ Meta |

---

## Fase 1: Fundação ✅

- [x] Repositório criado, branches configuradas (master, develop)
- [x] Renomear projeto para NexusAI (package.json, identidade visual, ícones)
- [x] Configurar autores e licença (Apache-2.0 mantida por ser fork; NOTICE atualizado)
- [x] Integração GitHub Copilot como auth primária
- [x] Documentação inicial (PLAN.md, CRONOGRAMA.md, skills)

## Fase 2: Controle Local ✅ (`2026-03-11`)

- [x] Renomear ClineError → NexusError / ClineAuthProvider → NexusAuthProvider (barrels de retrocompatibilidade)
- [x] Ferramenta `list_processes` (spec + handler + 12 variantes de prompt)
- [x] Ferramenta `kill_process` (spec + handler + 12 variantes de prompt)
- [x] Testes unitários GitHubAuthService (12 testes)
- [x] Puppeteer lazy-load (import dinâmico em BrowserSession.ts)
- [x] Suite E2E Playwright — mock server, auth flow, diff editor, chat, editor, terminal, checkpoint

## Fase 3: SSH ✅ (`2026-03-13`)

- [x] `discover_network_hosts`, `ssh_connect`, `ssh_execute`, `ssh_upload`, `ssh_download`, `ssh_disconnect`
- [x] `SshSessionRegistry` — gerenciamento por taskId
- [x] MockSshServer — ESM/CJS interop, pkcs1, force-close connections
- [x] E2E cobertura: `ssh.test.ts` (7 cenários, 26 testes)
- [x] Bug fix: ssh2 bundling via esbuild nativeNodePlugin (#22)
- [x] Skill: `skills/playwright-e2e.md`

## Fase 4: IoT ✅ (`2026-03-14`)

- [x] `discover_devices` — scan via mDNS/Bonjour + SSDP + ARP, `DeviceIdentificationService`
- [x] `register_device`, `get_device_info`, `operate_device` — `DeviceRegistry` + `DeviceCommandAdapter`
- [x] `mqtt_connect`, `mqtt_publish`, `mqtt_subscribe`, `mqtt_disconnect` — `MqttConnectionRegistry`
- [x] `http_request` — SSRF guard (IPs privados bloqueados, flag `trusted_local`)
- [x] `IotDevicesPanelProvider` — painel webview de dispositivos
- [x] E2E cobertura: `iot.test.ts` (13 cenários)
- [x] Testes unitários: `DeviceRegistry`, `IotDiscoveryService`, `MqttConnectionRegistry`, `DeviceIdentificationService`
- [x] Issues encerrados: #23, #24, #25, #26

## Fase 5: Voz ✅ (`2026-03-15`)

- [x] `speak_text` — `SpeakTextToolHandler` + `PiperService` (TTS offline)
- [x] `listen_for_speech` — `ListenForSpeechToolHandler` + `WhisperService` + `whisper.worker.ts` (STT offline)
- [x] `VoiceSessionManager` — singleton para estado de voz, push-to-talk
- [x] Voice UI — componentes em `webview-ui/src/components/voice/`, botão push-to-talk no ChatTextArea
- [x] Protobuf: `voice.proto` com `VoiceService`
- [x] E2E cobertura: `voice.test.ts`, `voice-settings.test.ts`
- [x] Testes unitários: `VoiceSessionManager`, `SpeakTextToolHandler`, `ListenForSpeechToolHandler`

## Rebranding Cline → NexusAI 🔄 (EPIC #49)

- [x] A1: Auditoria de referências Cline em runtime (#50)
- [x] A2: Renomeação de UI/UX visível (#51)
- [x] A3: Renomeação interna de classes/tipos (#52)
- [x] A4: Migração de Command IDs e Context Keys (#53)
- [x] A5: Migração de Storage/Secrets com fallback (#54)
- [x] A6: Rebranding de pacotes e scripts (#55)
- [ ] A7: Proto/RPC additive sem breaking change (#56) — **aberto**
- [x] A8: Docs/Workflows/Evals alinhados (#57)
- [ ] A9: Hardening de testes E2E/Smoke (#58) — **aberto**
- [x] A10: Plano de depreciação de legado Cline (#59)

## Refactoring Task.ts 🔄 (Parent #10)

- [x] #7: NativeToolCallProcessor extraído
- [x] #8: ContextCompactor extraído
- [ ] #64: CheckpointOrchestrator — **aberto**
- [ ] #65: Context compaction decision — **aberto**
- [ ] #66: StreamMetricsCollector — **aberto**
- [ ] #67: AssistantResponseBuilder — **aberto**
- [ ] #68: EmptyResponseHandler — **aberto**

## Fase 6: Agentes Autônomos ⏳

- [ ] Multi-IA (usar outras IAs como ferramentas)
- [ ] Agent loop autônomo com goal decomposition
- [ ] Memory persistente entre sessões
- [ ] `SubagentToolHandler` já existe mas coordenação complexa é v2.0

---

## Pendências Transversais

| Item | Origem | Status |
|------|--------|--------|
| Sessão SSH ativa na webview | Fase 3 | Pendente — `SshSessionsPanelProvider` criado mas não integrado |
| Avatar interativo | Fase 5 | Pendente — UI de avatar animado não iniciada |
| Sistema de detecção de locutor | Fase 5 | Pendente — speaker diarization não iniciada |
| Bug: Invalid API Response loop | #18 | Aberto |
| CLI source code | — | `cli/` vazio — referências em docs apontam para código do Cline original não portado |

---

## Inventário de Ferramentas (50 tools)

### Core (10)
`ask_followup_question`, `attempt_completion`, `execute_command`, `apply_patch`, `read_file`, `write_to_file`, `search_files`, `list_files`, `list_code_definition_names`, `browser_action`

### Network & SSH (7)
`discover_network_hosts`, `ssh_connect`, `ssh_execute`, `ssh_upload`, `ssh_download`, `ssh_disconnect`, `http_request`

### IoT (8)
`discover_devices`, `register_device`, `get_device_info`, `operate_device`, `mqtt_connect`, `mqtt_publish`, `mqtt_subscribe`, `mqtt_disconnect`

### Voz (2)
`speak_text`, `listen_for_speech`

### Web (3)
`web_fetch`, `web_search`, `condense`

### MCP & Skills (4)
`use_mcp_tool`, `access_mcp_resource`, `load_mcp_documentation`, `use_skill`

### Agent (6)
`plan_mode_respond`, `act_mode_respond`, `new_task`, `summarize_task`, `use_subagents`, `todo`

### Meta (4)
`report_bug`, `new_rule`, `generate_explanation`, `apply_patch`

---

## Release 1.0.0 — Critérios de Lançamento

- [ ] Todas as fases 1-5 concluídas (✅)
- [ ] Rebranding completo A1-A10 (🔄 faltam A7, A9)
- [ ] Refactoring Task.ts (🔄 faltam 5 sub-issues)
- [ ] Bug #18 resolvido (checkpoint timeout + API retry)
- [ ] Documentação completa
- [ ] Cobertura de testes ≥ 80% nas partes críticas
- [ ] CLI funcional (ainda não portado do Cline)
- [ ] Publicação na VS Code Marketplace
