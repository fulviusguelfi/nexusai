# Roadmap — NexusAI v1.0

> Este documento detalha o que está planejado para cada fase do desenvolvimento.
> Para o que já foi entregue, veja [Fase 1 — Fundação](Fase-1-Fundacao.md).

---

## Resumo das Fases

| Fase | Nome | Versão Alvo | Status |
| ---- | ---- | ----------- | ------ |
| 1 | Fundação | 1.0.0-alpha | ✅ Concluída |
| 2 | Controle Local | 1.0.0-beta | ✅ Concluída |
| 3 | Conexão SSH | 1.0.0-beta | ✅ Concluída |
| 4 | IoT — MQTT, mDNS, HTTP | 1.0.0-rc | ✅ Concluída |
| 5 | Voz (TTS/STT) | 1.0.0-rc | ✅ Concluída |
| 6 | Agentes Autônomos | 1.0.0 | ⏳ Planejada |
| — | Stable | 1.0.0 | ⏳ Planejada |

---

## Fase 2 — Controle Local 🖥️ ✅

> **Status**: Concluída em `2026-03-11` · Veja [Fase-2-Terminal.md](Fase-2-Terminal.md) para detalhes completos.

### Entregues

| # | Entrega | Descrição |
| - | ------- | --------- |
| A1 | Renomeações + barrels | `NexusError`, `NexusAuthProvider` com retrocompatibilidade |
| A2 | Testes unitários GitHubAuthService | 12 testes cobrindo todos os métodos públicos |
| B2 | Ferramenta `list_processes` | Spec + handler + 12 variantes de prompt |
| B3 | Ferramenta `kill_process` | Spec + handler + 12 variantes de prompt |
| B4 | Puppeteer lazy-load | Import dinâmico em `BrowserSession.ts` |
| B5 | Suite E2E Playwright | Mock server, auth flow, diff editor, chat, editor — todos passando |

### Issues Abertas (tech-debt Fase 2 → resolver antes/durante Fase 3)

| # | Issue | Prioridade |
| - | ----- | ---------- |
| [#15](https://github.com/fulviusguelfi/nexusai/issues/15) | Cross-platform `kill_process` (Linux/macOS) | Antes de Fase 3 |
| [#16](https://github.com/fulviusguelfi/nexusai/issues/16) | Documentar padrão DI-for-testability | ✅ Resolvido |
| [#18](https://github.com/fulviusguelfi/nexusai/issues/18) | Bug: checkpoint timeout + API retry backoff | Inicio de Fase 3 |
| [#13](https://github.com/fulviusguelfi/nexusai/issues/13) | Unit tests `MultiRootCheckpointManager` | Durante Fase 3 |
| [#11](https://github.com/fulviusguelfi/nexusai/issues/11) | Interface `ICheckpointManager` | Durante Fase 3 |
| [#12](https://github.com/fulviusguelfi/nexusai/issues/12) | Lazy-init checkpoint manager | Durante Fase 3 |
| [#6–#10](https://github.com/fulviusguelfi/nexusai/issues/10) | Refactors grandes de `Task.ts` | Sprint tech-debt → Fase 4+ |

---

## Fase 3 — Conexão SSH 🔐 ✅

> **Status**: Concluída em `2026-03-13` · Veja [Fase-3-SSH.md](Fase-3-SSH.md) para detalhes completos.

### Entregues

| # | Entrega | Descrição |
| - | ------- | --------- |
| 3.1 | `discover_network_hosts` | ARP scan da rede local, retorna lista de hosts |
| 3.2 | `ssh_connect` | Sessão SSH por password ou private key inline |
| 3.3 | `ssh_execute` | Executa comando remoto, retorna stdout |
| 3.4 | `ssh_upload` / `ssh_download` | Transferência de arquivos via SFTP |
| 3.5 | `ssh_disconnect` | Encerra sessão + limpa `SshSessionRegistry` |
| 3.6 | `SshSessionRegistry` | Singleton com escopo por taskId |
| 3.7 | `MockSshServer` | Servidor SSH mock para testes E2E |
| 3.8 | E2E coverage | 7 cenários, 26 testes, Exit Code: 0 |
| 3.9 | `skills/playwright-e2e.md` | Skill de IA para ciclo de vida dos testes E2E |

### Bug Fixes

- **ESM/CJS interop**: `await import('ssh2')` requer `module.default ?? module` — documentado em #22
- **ssh2 bundling**: `nativeNodePlugin` no `esbuild.mjs` resolve ECONNRESET em testes E2E
- **Formato de chave**: `pkcs1` (não `pkcs8`) é aceito pelo `ssh2.Server`

### Pendência Registrada

- Exibição de sessão SSH ativa na webview — adiado para Fase 4/5

### Preview da Arquitetura

```text
SSHManager (src/services/ssh/)
├── ConnectionPool         → reutiliza conexões abertas
├── HostDiscovery          → scan da rede, cache de hosts conhecidos
├── AuthManager            → gerencia credenciais (keychain, config ~/.ssh/)
└── tools/
    ├── SshExecuteToolHandler
    ├── SshUploadToolHandler
    └── SshDownloadToolHandler
```

```protobuf
// Novo RPC: ssh_execute
message SshExecuteRequest {
  string host = 1;
  string command = 2;
  optional int32 timeout_seconds = 3;
}

message SshExecuteResponse {
  string stdout = 1;
  string stderr = 2;
  int32 exit_code = 3;
}
```

### Segurança

- Credenciais nunca aparecem em logs ou state
- Uso do keychain nativo do OS via `keytar`
- Suporte a `~/.ssh/config` — respeita configurações existentes do usuário
- Confirmação obrigatória antes de executar qualquer comando destrutivo em host remoto

---

## Fase 4 — IoT 📡 ✅ Concluída (`2026-03-14`)

> **Status**: Concluída · Veja [Fase-4-IoT.md](Fase-4-IoT.md) para detalhes completos.

### Entregues

| # | Entrega | Descrição |
| - | ------- | --------- |
| 4.1 | `discover_devices` | mDNS/Bonjour + SSDP + ARP scan — #24 |
| 4.2 | `register_device` / `get_device_info` / `operate_device` | DeviceRegistry + DeviceCommandAdapter |
| 4.3 | `mqtt_connect` / `mqtt_publish` / `mqtt_subscribe` / `mqtt_disconnect` | MqttConnectionRegistry + MockMqttBroker — #25 |
| 4.4 | `http_request` | SSRF guard (IPs privados bloqueados, `trusted_local`) — #26 |
| 4.5 | `IotDevicesPanelProvider` | Painel webview de dispositivos |
| 4.6 | E2E coverage | 13 cenários IoT passando |

---

## Fase 5 — Voz (TTS/STT) 🎙️ ✅ Concluída (`2026-03-15`)

> **Status**: Concluída · Veja [Fase-5-Voice.md](Fase-5-Voice.md) para detalhes completos.

### Entregues

| # | Entrega | Descrição |
| - | ------- | --------- |
| 5.1 | `speak_text` | PiperService (TTS offline) + SpeakTextToolHandler |
| 5.2 | `listen_for_speech` | WhisperService + whisper.worker.ts (STT offline) + ListenForSpeechToolHandler |
| 5.3 | VoiceSessionManager | Singleton para estado de voz, push-to-talk |
| 5.4 | Voice UI | Componentes em webview-ui/src/components/voice/, botão push-to-talk |
| 5.5 | Voice proto | voice.proto + VoiceService gRPC |
| 5.6 | E2E coverage | voice.test.ts + voice-settings.test.ts |

### Pendências (adiadas para v2.0 ou sprint dedicada)

- Avatar interativo (visualização animada no webview)
- Speaker diarization / detecção de locutor
- Personalidade configurável (nome, tom, modo)

---

## Fase 6 — Agentes Autônomos 🤖 ⏳ Planejada

> **Objetivo**: IA auto-gerenciável que usa outras IAs como ferramentas.

### Tarefas

| # | Tarefa | Descrição |
| - | ------ | --------- |
| 6.1 | Multi-IA | Usar outras IAs como ferramentas |
| 6.2 | Agent loop autônomo | Goal decomposition, planning |
| 6.3 | Memory persistente | Across sessions |

`SubagentToolHandler` já existe como fundação.

---

## Release 1.0.0 — Stable

Para o release estável, além de todas as fases implementadas:

- [ ] Documentação completa — todos os comandos, todas as ferramentas
- [ ] Cobertura de testes ≥ 80% nas partes críticas
- [ ] Performance baseline — tempo de resposta < 200ms para operações de UI
- [ ] Acessibilidade — A11y no webview
- [ ] Internacionalização (i18n) — PT-BR e EN como idiomas suportados
- [ ] Marketplace — publicação na VS Code Marketplace

---

## O que Não Está no Roadmap v1.0

Algumas capacidades que estão no backlog mas **não** serão priorizadas para a v1.0:

- **Versão Desktop standalone** — o NexusAI existe como extensão VS Code; uma versão Electron standalone é futuro
- **Renomear comandos `cline.*`** — os comandos internos do VS Code mantêm o prefixo `cline` para compatibilidade; renomear seria uma breaking change significativa
- **Multi-agent coordination autônoma** — subagentes já existem via `use_subagents`, mas workflows complexos multi-agente são v2.0
- **Plugin marketplace** — sistema de plugins first-party é pós-v1.0

---

[← Fase 1](Fase-1-Fundacao.md) · [Home](Home.md) · [Contribuindo →](Contribuindo.md)
