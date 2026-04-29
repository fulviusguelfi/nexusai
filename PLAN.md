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
- **Pendência**: exibição de sessão SSH ativa na webview — resolvida na Fase 3.5

### Fase 3.5 — SSH Panel + Bug Fixes ✅ _(concluído em 2026-06-08)_
- **SshSessionRegistry**: estendido com `SshSessionInfo`, `setMetadata()`, `getActiveSessions()`, `onDidChange()` + notificações em `delete()`
- **SshConnectToolHandler**: salva metadados da sessão imediatamente após conexão bem-sucedida
- **ExtensionState**: campo `activeSshSessions: SshSessionInfo[]` exposto via `getStateToPostToWebview()` no Controller
- **SshSessionsPanelProvider**: `WebviewViewProvider` registrado em `extension.ts` para o painel `nexusai.sshPanel` na Activity Bar
- **package.json**: `nexusai-panels` Activity Bar container + views `nexusai.sshPanel` (SSH Sessions) e `nexusai.iotPanel` (IoT Devices — placeholder)
- **Bug #15 corrigido**: `kill_process` agora usa `taskkill /T` no Windows e `pkill -P` no Linux/macOS para matar toda a árvore de processos
- **Bug #18**: confirmado já implementado (3 auto-retries com backoff 2s/4s/8s no `Task.ts`) — sem mudanças necessárias
- **Testes unitários**: 8 novos testes para `SshSessionRegistry`; 2 novos testes para `KillProcessToolHandler` (tree kill)
- **Suite completa**: 1244 testes passando, 3 falhas pré-existentes em `BannerService` (timeout)
- **Commits**: `c59a67d`, `66db2c6`, `e72e22a`, `a8d431b`

### Fase 4 — SSH e Rede ❌ **CANCELADA PROPOSITALMENTE**
- Todo código removido do branch principal em `commit fce94f31d`
- Motivo: Funcionalidades de SSH e IoT serão implementadas como **Agentes MCP independentes** e não mais no core da extensão
- Arquivo de referência mantido em `docs/archived/Fase-3-SSH.md`
- Esta decisão permite manter o core pequeno, estável e focado na experiência de voz e loop principal da IA

### Fase 5 — Voz Local (Piper TTS, Whisper STT) ✅ _(concluído em 2026-03-29)_
✅ Funcionalmente Completo (STT + TTS operacionais em produção)
- Backend 100% Completo
- Webview / Host 100% Completo
- Todos bugs conhecidos resolvidos
- 1421 testes unitários passando
- Smoke tests e E2E implementados

### Fase 5 — Voz Local (Piper TTS, Whisper STT) ✅ _(concluído em 2026-03-29)_

**Status**: ✅ Funcionalmente Completo (STT + TTS operacionais em produção)

- **Backend**: ✅ 100% Completo
  - `WhisperService` (STT) com detecção de PT-BR e language hint `"pt"`
  - `PiperService` (TTS synthesis) — binário + modelos `en_US-lessac-medium` e `pt_BR-faber-medium`
  - `VoiceSessionManager` (state & events, onSpeakRequest listener)
  - `VoiceResponseHandler` (pipeline separation: STT → LLM → TTS)
  - `recordAndRespond` controller (entrada por voz end-to-end)
  - `speak_text` & `listen_for_speech` tools handlers

- **Webview / Host**: ✅ 100% Completo
  - `VoiceRecorder` component (UI de gravação)
  - `VoiceSettingsSection` component (painel de configurações)
  - Chat integration — microfone conectado ao pipeline de envio
  - **Audio playback**: movido para extension host (`System.Media.SoundPlayer` / `afplay` / `aplay`) — resolve bloqueio de autoplay do Chromium/Electron
  - `useVoiceAudioPlayer` hook (fallback para webview, mantido)

- **Fixes aplicados (2026-03-29)**:
  - ✅ Autoplay bloqueado: playback de WAV movido de `HTMLAudioElement` no webview para `System.Media.SoundPlayer` no extension host (Node.js)
  - ✅ Double TTS: `completion_result` removido das 3 condições TTS em `say()` — fala apenas `type="text"`
  - ✅ `<thinking>` tags strip nos 3 call sites (incluindo bug residual no call site 2)
  - ✅ Diagnóstico LOG `[TTS] Firing requestSpeak (type=..., chars=...)` visível no Output Channel

- **Pendências movidas para backlog**:
  - Device selection UI (#50) — UI work não crítico para funcionalidade de voz
  - Settings panel linking (#56) — configurações acessíveis via painel existente

- **Testes (2026-03-29)**:
  - ✅ 1421 testes unitários passando (79 novos: SilenceDetector, VoiceErrorMapper, AudioLevelMeter, PiperService, VoiceResponseHandler)
  - ✅ Snapshots do sistema de prompts atualizados (voice input behavior section)
  - ✅ Smoke test scenarios 10 (speak-text) e 11 (voice-settings) criados em `evals/smoke-tests/scenarios/`
  - ✅ E2E voice tests expandidos de 2 para 4 cenários (TTS disabled + custom listen prompt)

- **Issues relacionados**: [#50](https://github.com/fulviusguelfi/nexusai/issues/50), [#51](https://github.com/fulviusguelfi/nexusai/issues/51) ✅, [#52](https://github.com/fulviusguelfi/nexusai/issues/52) ✅
- **Wiki**: `docs/wiki/Fase-5-Voice.md`

### Fase 6X — Retorno ao Pipeline Voz Original 🎯 **EM ANDAMENTO ATUAL**

> ✅ Esta é a prioridade máxima ABSOLUTA. Nenhuma outra funcionalidade será desenvolvida até que esta fase esteja 100% concluída e estável.

**Objetivo**: Reverter o pipeline STT para o modelo original provado e funcional:
```
APERTA BOTÃO → FALA COMPLETAMENTE → SOLTA BOTÃO → TRANSCRIÇÃO COMPLETA → ENVIA PARA IA
```

❌ **Cancelado definitivamente**:
- STT Streaming em tempo real
- Transcrição parcial
- Escrita enquanto fala
- Todas as tentativas de Vosk, FasterWhisper streaming

✅ **Funcionalidades mantidas**:
- O jeito que funcionava originalmente e era perfeito
- Apenas o botão Push-To-Talk
- Nenhuma inteligencia, nenhuma detecção de silencio automatica
- O usuário tem controle total

**Checklist DOD (Definition Of Done)**:
- [ ] Remover todo código de streaming STT
- [ ] Reverter WhisperService para comportamento original: grava arquivo WAV completo, envia uma vez para Whisper, recebe transcrição completa
- [ ] Remover VoskService, FasterWhisperService e todas as alternativas experimentais
- [ ] Manter apenas o Whisper original local
- [ ] Botão mic no chat: clique para começar, clique novamente para parar e transcrever
- [ ] Spinner apenas enquanto transcreve
- [ ] Nenhuma barra de volume, nenhuma animação enquanto fala
- [ ] Todos os testes unitários passando
- [ ] Snapshots atualizados
- [ ] 0 erros no console
- [ ] Funciona perfeitamente no Windows, Linux e MacOS

---

### Próximas Fases (Posteriores ao MVP Estável)

| # | Descrição | Tipo | Status |
|---|---|---|---|
| Fase 6X | Pipeline Voz Original | Prioridade Máxima | 🔴 EM ANDAMENTO |
| Fase 7 | Refatoração da Task.ts | Tech Debt | ⏳ Pendente |
| Fase 8 | Agentes Autônomos MCP | Feature | ⏳ Pendente |
| Fase 9 | Multi-IA | Feature | ⏳ Pendente |

### Backlog — Tech Debt e Bugs Pendentes

| Issue | Tipo | Título |
|---|---|---|
| [#18](https://github.com/fulviusguelfi/nexusai/issues/18) | bug | Invalid API Response loop + Checkpoint timeout — ✅ já implementado (retry backoff em Task.ts) |
| [#15](https://github.com/fulviusguelfi/nexusai/issues/15) | bug | kill_process cross-platform (Linux/macOS) — ✅ corrigido na Fase 3.5 |
| [#13](https://github.com/fulviusguelfi/nexusai/issues/13) | tech-debt | Unit tests para MultiRootCheckpointManager |
| [#12](https://github.com/fulviusguelfi/nexusai/issues/12) | tech-debt | Lazy-init CheckpointManager |
| [#11](https://github.com/fulviusguelfi/nexusai/issues/11) | tech-debt | Interface ICheckpointManager |
| [#10](https://github.com/fulviusguelfi/nexusai/issues/10) | refactor | Extract TaskRunner de Task.ts |
| [#9](https://github.com/fulviusguelfi/nexusai/issues/9) | refactor | Extract PresentationLayer de Task.ts |
| [#8](https://github.com/fulviusguelfi/nexusai/issues/8) | refactor | Extract ContextCompactor de Task.ts |
| [#7](https://github.com/fulviusguelfi/nexusai/issues/7) | refactor | Extract NativeToolCallProcessor de Task.ts |
| [#6](https://github.com/fulviusguelfi/nexusai/issues/6) | refactor | Extract EnvironmentDetailsService de Task.ts |

---

## 14. QA & Documentation Agent — Utilidade para Desenvolvimento ✅

**Data de Criação**: 31 de março de 2026  
**Tipo**: Subagente especializado para análise de cobertura de testes e consolidação de documentação

### Propósito
O `qa-documentation-agent` é um subagente personalizado projetado para:
1. **Análise de Cobertura de Testes** — Verifica quais funções têm testes, identifica lacunas
2. **Correção de Testes Falhando** — Debug e finalização de suites de testes incompletas
3. **Consolidação de Documentação** — Alinha código com documentação sem perda de informação
4. **Manutenção do Conhecimento** — Atualiza wiki, PLAN.md e rastreia progresso do desenvolvimento

### Arquivos Relacionados
- **Configuração principal**: `.agents/qa-documentation-agent.md` (885 linhas, sistema prompt + 5-step QA cycle)
- **Guia de uso rápido**: `.agents/qa-documentation-agent-usage.md` (exemplos práticos + referência)
- **Memória de sessão**: `/memories/session/nexusai-qa-agent-task.md` (rastreamento de progresso)

### Workflow: 5-Step QA Cycle
```
1. ASSESS & PLAN  → Definir escopo e estratégia
2. ANALYZE        → Ler código/testes, identificar lacunas
3. IMPLEMENT      → Escrever/corrigir testes
4. DOCUMENT       → Reconciliar documentação com código
5. REPORT         → Rastrear progresso, atualizar PLAN.md
```

### Como Usar
```bash
# Invocar o agente via subagent tool:
"Analyze test coverage for src/core/prompts/"
"Fix failing tests in src/api/ and write missing ones"
"Consolidate docs/ to match latest code state"
```

### Benefícios para o Projeto
✅ **Automação**: Análise sistemática de cobertura por módulo  
✅ **Consistência**: Testes e docs sincronizados automaticamente  
✅ **Rastreamento**: Progresso salvo entre sessões via memória  
✅ **Conhecimento**: Base de dados de cobertura por módulo para futuras auditorias  

### Estado Atual do Projeto
- **181 arquivos de teste** descobertos
- **Estrutura TypeScript/Jest** consistente
- **Necessidade**: Consolidação de cobertura e alinhamento de documentação
- **Próximo passo**: Executar agente em módulos críticos (core, api, services)

### Comandos de Referência
```bash
npm run test:unit                    # Rodar todos os testes
npm run test:unit -- --grep "test"   # Teste específico
npm run compile                      # Compilar TypeScript
npm run protos                       # Gerar código Protobuf
npm run watch                        # Modo watch com auto-compile
UPDATE_SNAPSHOTS=true npm run test:unit  # Atualizar snapshots
```

### Próximas Ações
1. Invocar agente: `"Analyze test coverage for src/core/prompts/"`
2. Aguardar relatório de cobertura
3. Executar ciclo QA sobre módulos prioritários (core → api → services)
4. Consolidar documentação conforme testes são completados
5. Manter PLAN.md atualizado com progresso
