# Cronograma de Desenvolvimento — NexusAI

> Última atualização: 2026-03-21  
> Para roadmap detalhado com issues abertas, veja [ROADMAP.md](../ROADMAP.md)  
> Para detalhes de cada fase, veja `docs/wiki/Fase-*.md`

---

## Fases de Desenvolvimento

### Fase 1: Fundação ⚙️ ✅ Concluída (`2026-03-10`)

**Objetivo**: Preparar a estrutura base do projeto

| Tarefa | Descrição | Status |
| ------ | --------- | ------ |
| 1.1 | Criar repositório GitHub | ✅ Concluído |
| 1.2 | Configurar branches (master, develop) | ✅ Concluído |
| 1.3 | Renomear projeto para NexusAI | ✅ Concluído |
| 1.4 | Atualizar identidade visual (ícones, nome) | ✅ Concluído |
| 1.5 | Configurar autores e licença (NOTICE e autoria base atualizados) | ✅ Concluído |
| 1.6 | Criar documentos do projeto | ✅ Concluído |
| 1.7 | Integração GitHub Copilot (login via browser/passkey/app/token) como auth primária | ✅ Concluído |

### Fase 2: Controle Local 🖥️ ✅ Concluída (`2026-03-11`)

**Objetivo**: Terminal local e comandos shell

| Tarefa | Descrição | Status |
| ------ | --------- | ------ |
| 2.1 | Renomear ClineError → NexusError / ClineAuthProvider → NexusAuthProvider | ✅ Concluído |
| 2.2 | Ferramenta `list_processes` (spec + handler + 12 variantes) | ✅ Concluído |
| 2.3 | Ferramenta `kill_process` (spec + handler + 12 variantes) | ✅ Concluído |
| 2.4 | Testes unitários GitHubAuthService (12 testes) | ✅ Concluído |
| 2.5 | Puppeteer lazy-load (import dinâmico em BrowserSession.ts) | ✅ Concluído |
| 2.6 | Suite E2E Playwright — mock server, auth flow, diff editor, chat, editor | ✅ Concluído |

### Fase 3: Conexão SSH 🔐 ✅ Concluída (`2026-03-13`)

**Objetivo**: Controlar computadores remotos

| Tarefa | Descrição | Status |
| ------ | --------- | ------ |
| 3.1 | `discover_network_hosts` — scan ARP da rede local | ✅ Concluído |
| 3.2 | `ssh_connect` — sessão SSH por password/key | ✅ Concluído |
| 3.3 | `ssh_execute` — execução remota de comandos | ✅ Concluído |
| 3.4 | `ssh_upload` / `ssh_download` — transferência SFTP | ✅ Concluído |
| 3.5 | `ssh_disconnect` — encerrar sessão | ✅ Concluído |
| 3.6 | `SshSessionRegistry` + MockSshServer + E2E (26 testes) | ✅ Concluído |

### Fase 4: IoT 📡 ✅ Concluída (`2026-03-14`)

**Objetivo**: Controle de dispositivos na rede

| Tarefa | Descrição | Status |
| ------ | --------- | ------ |
| 4.1 | `discover_devices` — mDNS/Bonjour + SSDP + ARP (#24) | ✅ Concluído |
| 4.2 | `register_device` / `get_device_info` / `operate_device` | ✅ Concluído |
| 4.3 | `mqtt_connect` / `mqtt_publish` / `mqtt_subscribe` / `mqtt_disconnect` (#25) | ✅ Concluído |
| 4.4 | `http_request` com guarda SSRF (#26) | ✅ Concluído |
| 4.5 | `IotDevicesPanelProvider` — painel webview | ✅ Concluído |
| 4.6 | E2E cobertura — 13 cenários IoT | ✅ Concluído |

### Fase 5: Voz (TTS/STT) 🎙️ ✅ Concluída (`2026-03-15`)

**Objetivo**: Sistema de voz local 100% offline

| Tarefa | Descrição | Status |
| ------ | --------- | ------ |
| 5.1 | `speak_text` — PiperService (TTS offline) | ✅ Concluído |
| 5.2 | `listen_for_speech` — WhisperService + worker (STT offline) | ✅ Concluído |
| 5.3 | `VoiceSessionManager` — push-to-talk, UI no chat | ✅ Concluído |
| 5.4 | Voice proto (gRPC), testes unitários e E2E | ✅ Concluído |
| 5.5 | Avatar interativo | ⏳ Pendente |
| 5.6 | Sistema de detecção de locutor (speaker diarization) | ⏳ Pendente |

### Fase 6: Agentes Autônomos 🤖 ⏳ Planejada

**Objetivo**: IA auto-gerenciável que pode usar outras IAs como ferramentas

| Tarefa | Descrição | Status |
| ------ | --------- | ------ |
| 6.1 | Multi-IA (usar outras IAs como ferramentas) | ⏳ Pendente |
| 6.2 | Agent loop autônomo com goal decomposition | ⏳ Pendente |
| 6.3 | Memory persistente entre sessões | ⏳ Pendente |

---

## Marco de Releases

### Release 1.0.0 - Alpha ✅

- Projeto renomeado para NexusAI
- Estrutura base configurada
- Primeiros documentos

### Release 1.0.0 - Beta ✅

- Terminal local funcionando
- SSH implementado com E2E
- IoT implementado (MQTT, HTTP, mDNS)
- Primeiras skills (7 skills .md)

### Release 1.0.0 - RC 🔄

- Voz integrada (Piper + Whisper) ✅
- IoT funcionando ✅
- Rebranding Cline → NexusAI 🔄 (8/10 etapas concluídas)
- Refactoring Task.ts 🔄 (2/5 sub-issues concluídos)

### Release 1.0.0 - Stable ⏳

- Todas as funcionalidades da v1.0
- Rebranding 100%
- Refactoring concluído
- CLI funcional
- Documentação completa
- Publicação na Marketplace

---

## Critérios de Aceitação

Para cada fase ser considerada concluída:

1. ✅ Código implementado
2. ✅ Testes básicos passando
3. ✅ Documentação atualizada
4. ✅ PR mergeado para develop

---

## Notas

- O standalone (versão desktop) não está no cronograma da v1.0
- Prioridades podem ser ajustadas conforme feedback
- Cada feature deve ser pequena e entregar valor

---

## Referência

- **Repositório**: [fulviusguelfi/nexusai](https://github.com/fulviusguelfi/nexusai)
- **Branch Master**: Releases estáveis
- **Branch Develop**: Integração contínua
- **Feature Branches**: `feat/nome-da-feature`
