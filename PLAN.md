# NexusAI - Plano do Projeto

## 1. Informações do Projeto

| Campo | Valor |
| ----- | ----- |
| **Nome** | NexusAI |
| **Versão** | 1.0.0 |
| **Autores** | Fulvius Titanero Guelfi + IA |
| **Base** | Cline (Extensão VSCode) |
| **Licença** | Apache-2.0 (atual) / MIT (proposta) |
| **Repositório** | [fulviusguelfi/nexusai](https://github.com/fulviusguelfi/nexusai) |

---

## 2. Visão Geral

NexusAI é uma extensão de IA para VSCode que oferece assistência autônoma ao desenvolvedor, combinando um backend robusto com uma interface moderna. O projeto é baseado no Cline e visa expandir suas funcionalidades com TTS, STT, controle SSH, IoT e agentes autônomos.

### Objetivos Principais

1. 🤖 **Assistente de IA** com múltiplos modos de operação
2. 🎙️ **Voz Local** usando Piper (TTS) e Whisper (STT)
3. 🖥️ **Controle de Computadores** via SSH e terminal local
4. 📡 **Integração IoT** para dispositivos na rede local
5. 🔄 **IA Auto-Gerenciável** que pode usar outras IAs como ferramentas

---

## 3. Modos de Operação da IA

### 3.1 ACT Mode (Execução)

- IA principal que executa ações diretas
- Modifica arquivos, executa comandos
- Controla dispositivos IoT
- Pode usar outras IAs como ferramentas

### 3.2 PLAN Mode (Planejamento)

- Usado para planejar soluções complexas
- Faz perguntas clarificadoras
- Cria planos detalhados antes da execução

### 3.3 ASK Mode (Pesquisa e Conhecimento)

- Pesquisa na internet
- Monta base de conhecimento
- Salva snippets de código e skills
- Busca projetos no GitHub como referência
- Agrega informações para uso futuro

### 3.4 JUST CHAT Mode (Conversação)

- Conversa naturalmente como duas pessoas
- **IMPORTANTE**: Não se confunde com a própria voz
- Personalidade configurável
- Modo livre de interação

---

## 4. Arquitetura Técnica

### 4.1 Estrutura de Pastas

```text
nexusai/
├── src/                    # Backend (TypeScript)
│   ├── core/              # Lógica principal
│   ├── api/               # Provedores de IA
│   └── services/          # Serviços (MCP, IoT, SSH)
├── webview-ui/            # Frontend (React)
├── cli/                   # CLI (React Ink)
├── proto/                 # Protobuf definitions
├── docs/                  # Documentação
├── skills/                # Skills da IA (MD)
├── mcp-servers/           # Configurações MCP
└── .clinerules/          # Regras do projeto
```

### 4.2 Componentes Principais

| Componente | Descrição |
| ---------- | --------- |
| WebviewProvider | Gerencia UI e comunicação |
| Controller | Estado e mensagens |
| Task | Execução de tarefas |
| VoiceEngine | Piper + Whisper |
| SSHManager | Conexões remotas |
| IoTController | Dispositivos IoT |

---

## 5. Modelos de IA Suportados

- **Ollama** (local)
- **Modelos na rede local**
- **Anthropic Claude** (original Cline)
- **OpenRouter** (múltiplos provedores)
- **AWS Bedrock**
- **Google Gemini**
- **GitHub Copilot Models** (integrado via vscode.authentication — browser, passkey, app mobile, token)
- **Outros provedores Cline**

---

## 6. MCP Servers Recomendados

### 6.1 Pesquisa e Internet

- Fetch - Requisições HTTP
- Puppeteer - Automação de browser
- Brave Search - Busca na web

### 6.2 Gerenciamento de Código

- Git - Controle de versão
- Filesystem - Operações de arquivo
- Todo - Gerenciamento de tarefas

### 6.3 IoT e Rede

- MQTT - Protocolo IoT
- SSH - Conexões remotas
- Network - Descoberta de dispositivos

### 6.4 Conhecimento

- Memory - Armazenamento vetorial
- SQLite - Banco de dados local

---

## 7. Skills a Desenvolver

### 7.1 Skills Principais

1. `skills/developer.md` - Conhecimento de desenvolvimento
2. `skills/researcher.md` - Pesquisa e investigação
3. `skills/network.md` - Rede e conexões
4. `skills/iot.md` - Dispositivos IoT
5. `skills/voice.md` - Comandos de voz
6. `skills/planner.md` - Planejamento estratégico
7. `skills/playwright-e2e.md` - ✅ **ADICIONADO** — Ciclo de vida de testes E2E com Playwright (definição, implementação, execução, diagnóstico, monitoramento)

### 7.2 Estrutura de Cada Skill

```markdown
# Nome da Skill

## Descrição
...

## Quando Usar
...

## Comandos
...

## Exemplos
...
```

---

## 8. Personalidade do Avatar

O NexusAI terá uma personalidade configurável:

- Nome do avatar
- Tom de voz (formal, casual, técnico)
- Comportamento responses
- Reações a comandos
- Emoji usage

### Regras de Identificação

⚠️ **IMPORTANTE**: O avatar não deve se confundir com o usuário

- Sistema de detecção de locutor
- Diferenciação entre voz do usuário e da IA
- Prevenção de loop de resposta

---

## 9. Requisitos de Licença

O projeto é baseado no Cline (MIT License). Ao usar o código do Cline:

- Manter atribuições necessárias
- Adicionar créditos dos autores (Fulvius Titanero Guelfi + IA)
- Manter licença MIT para código derivado

---

## 10. Fluxo de Desenvolvimento

```text
master (release)
   ↑
develop (integração)
   ↑
feature branches (funcionalidades)
   ↑
pull requests
```

### Padrão de Commits

- `feat: description` - Nova funcionalidade
- `fix: description` - Correção de bug
- `docs: description` - Documentação
- `refactor: description` - Refatoração
- `test: description` - Testes

---

## 11. Notas Importantes

⚠️ **Problema de Auto-Escuta**: Desenvolver sistema para que a IA não se confunda com a própria voz.

⚠️ **Base Legal**: Manter atribuições ao Cline conforme licença MIT.

---

## 12. Contato

- **Autor**: Fulvius Titanero Guelfi
- **GitHub**: [fulviusguelfi/nexusai](https://github.com/fulviusguelfi/nexusai)
- **Issues**: [fulviusguelfi/nexusai/issues](https://github.com/fulviusguelfi/nexusai/issues)

---

## 13. Status de Implementação das Fases

### Fase 1 — Fundação ✅
- Renomeação Cline → NexusAI
- Configuração de build, CI, protobuf
- Estrutura de pastas, licença, documentação inicial

### Fase 2 — Ferramentas de Terminal e Processos ✅
- `list_processes`, `kill_process` handlers implementados
- Testes unitários com DI para mocks de `execSync`
- Pattern DI-for-testability documentado em `.clinerules/general.md`

### Fase 3 — SSH e Rede ✅ _(concluído em 2026-03-13)_
- **Handlers implementados**: `ssh_connect`, `ssh_execute`, `ssh_disconnect`, `ssh_upload`, `ssh_download`, `discover_network_hosts`
- **Sessões SSH**: `SshSessionRegistry` com gerenciamento por `taskId`
- **Say format**: JSON `say("tool", JSON.stringify({tool, content}))` para integração com ChatRow
- **Tipos**: `ClineSayTool.tool` atualizado com 6 SSH tool names; `private_key_content` em `toolParamNames`
- **ChatRow**: 6 novos casos de renderização
- **E2E Mock Server**: respostas LLM e roteamento para todos os cenários SSH
- **MockSshServer**: correção ESM/CJS interop (`ssh2Module.default ?? ssh2Module`), formato de chave `pkcs1`, `stop()` com force-close de conexões
- **ssh2 bundling**: `nativeNodePlugin` no esbuild.mjs — resolve ECONNRESET em testes E2E
- **Testes E2E**: 7 cenários ativos, 26 testes, Exit Code: 0
- **Issues**: #20 (feat), #21 (skill), #22 (bug fix documentado), todos fechados
- **Skill criada**: `skills/playwright-e2e.md`
- **Wiki**: `docs/wiki/Fase-3-SSH.md`
- **Pendência**: exibição de sessão SSH ativa na webview — adiada para Fase 4 ou 5

### Fase 4 — IoT (próxima)
- **Objetivo**: controle de dispositivos IoT na rede local via MQTT, mDNS e HTTP
- **Ferramentas planejadas**: `mqtt_publish`, `mqtt_subscribe`, `mdns_discover`, `http_request`
- **Issues**: [#23](https://github.com/fulviusguelfi/nexusai/issues/23) (overview), [#24](https://github.com/fulviusguelfi/nexusai/issues/24) (mdns), [#25](https://github.com/fulviusguelfi/nexusai/issues/25) (mqtt), [#26](https://github.com/fulviusguelfi/nexusai/issues/26) (http_request)
- **Dependência**: `mqtt` e `mdns-js` (ou `bonjour`) como dependências externas; avaliar bundling

### Próximas Fases

| # | Descrição | Issues Relacionados |
|---|---|---|
| Fase 4 | IoT — MQTT, mDNS, device discovery | [#23](https://github.com/fulviusguelfi/nexusai/issues/23), [#24](https://github.com/fulviusguelfi/nexusai/issues/24), [#25](https://github.com/fulviusguelfi/nexusai/issues/25), [#26](https://github.com/fulviusguelfi/nexusai/issues/26) |
| Fase 5 | Voz — Piper TTS, Whisper STT | — |
| Fase 6 | Agentes Autônomos e multi-IA | — |

### Backlog — Tech Debt e Bugs Pendentes

| Issue | Tipo | Título |
|---|---|---|
| [#18](https://github.com/fulviusguelfi/nexusai/issues/18) | bug | Invalid API Response loop + Checkpoint timeout |
| [#15](https://github.com/fulviusguelfi/nexusai/issues/15) | bug | kill_process cross-platform (Linux/macOS) |
| [#13](https://github.com/fulviusguelfi/nexusai/issues/13) | tech-debt | Unit tests para MultiRootCheckpointManager |
| [#12](https://github.com/fulviusguelfi/nexusai/issues/12) | tech-debt | Lazy-init CheckpointManager |
| [#11](https://github.com/fulviusguelfi/nexusai/issues/11) | tech-debt | Interface ICheckpointManager |
| [#10](https://github.com/fulviusguelfi/nexusai/issues/10) | refactor | Extract TaskRunner de Task.ts |
| [#9](https://github.com/fulviusguelfi/nexusai/issues/9) | refactor | Extract PresentationLayer de Task.ts |
| [#8](https://github.com/fulviusguelfi/nexusai/issues/8) | refactor | Extract ContextCompactor de Task.ts |
| [#7](https://github.com/fulviusguelfi/nexusai/issues/7) | refactor | Extract NativeToolCallProcessor de Task.ts |
| [#6](https://github.com/fulviusguelfi/nexusai/issues/6) | refactor | Extract EnvironmentDetailsService de Task.ts |
