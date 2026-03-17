# Arquitetura do NexusAI

O NexusAI é uma extensão VS Code construída sobre uma arquitetura em camadas, orientada a mensagens, com comunicação baseada em Protobuf/gRPC e uma clara separação entre host (extensão) e cliente (webview/CLI).

---

## Sumário

- [Visão Geral](#visão-geral)
- [Camada de Host — A Extensão](#camada-de-host--a-extensão)
- [Camada de Cliente — Webview e CLI](#camada-de-cliente--webview-e-cli)
- [Protocolo de Comunicação — Protobuf + gRPC](#protocolo-de-comunicação--protobuf--grpc)
- [O Loop do Agente — Task](#o-loop-do-agente--task)
- [Sistema de Ferramentas — Tools](#sistema-de-ferramentas--tools)
- [Serviços](#serviços)
- [Build System](#build-system)
- [Padronizações e Ferramentas](#padronizações-e-ferramentas)

---

## Visão Geral

```text
┌─────────────────────────────────────────────────────────┐
│                    VS Code Extension Host                │
│                                                         │
│  extension.ts ──► common.ts ──► WebviewProvider         │
│                                      │                  │
│                               Controller ◄──────────┐  │
│                                   │                  │  │
│                                 Task                 │  │
│                            (agent loop)              │  │
│                                   │                  │  │
│                           ToolExecutor               │  │
│                        (25+ handlers)                │  │
│                                   │                  │  │
│              ┌────────────────────┼──────────────┐   │  │
│              ▼                   ▼              ▼   │  │
│        FileSystem            Terminal          MCP   │  │
│           SSH               Browser           IoT   │  │
└──────────────────────────────────┬──────────────────┘  │
                                   │ Proto/gRPC           │
                       ┌───────────┴───────────┐         │
                       ▼                       ▼         │
              ┌─────────────────┐   ┌─────────────────┐  │
              │   Webview UI    │   │      CLI         │  │
              │  (React/Vite)   │   │  (React Ink)     │  │
              │                 │   │                  │  │
              │ ExtensionState  │   │  CliState        │──┘
              │    Context      │   │                  │
              └─────────────────┘   └─────────────────┘
```

---

## Camada de Host — A Extensão

### extension.ts — Ponto de Entrada

O arquivo `src/extension.ts` é a função `activate()` chamada pelo VS Code ao ativar a extensão. Ele orquestra a inicialização na seguinte sequência:

```text
1. setupHostProvider(context)
   └─ configura adaptadores VS Code para o HostProvider abstrato

2. cleanupLegacyVSCodeStorage(context)
   └─ migra dados legados (chaves globais, histórico de tasks)

3. exportVSCodeStorageToSharedFiles(context, storageContext)
   └─ exporta estado do VS Code para arquivos ~/.cline/data/
      (permite compartilhamento com CLI e outras plataformas)

4. initialize(storageContext)  ← src/common.ts
   └─ inicialização platform-agnostic
   └─ retorna VscodeWebviewProvider

5. Registra providers, comandos e event listeners
```

**Por que separar `extension.ts` de `common.ts`?**

O NexusAI roda em múltiplas plataformas: VS Code, CLI (terminal), JetBrains (futuro). A lógica de negócio e serviços centrais deve ser **idêntica** em todas. O `common.ts` contém essa lógica comum. O `extension.ts` contém apenas o que é específico do VS Code.

### common.ts — Inicialização Comum

```typescript
// src/common.ts — simplificado
export async function initialize(storageContext): Promise<WebviewProvider> {
  Logger.initialize()
  
  StateManager.initialize(storageContext)   // lê/escreve estado persistente
  ErrorService.initialize()                 // captura erros não tratados
  PostHogClientProvider.initialize()        // telemetria opt-in
  
  await startBackgroundSync()               // sincroniza com servidores
  
  return createWebviewProvider()            // WebviewProvider para a plataforma atual
}
```

### WebviewProvider — Coordenador da UI

`src/core/webview/WebviewProvider.ts` gerencia o ciclo de vida da interface:

- **Singleton**: `WebviewProvider.getInstance()` / `getVisibleInstance()`
- **Cria o Controller** no construtor — o Controller é o "dono" do estado
- **Rota mensagens**: recebe eventos da UI, os entrega ao Controller
- **Gerencia lifecycle**: inicialização, visibilidade, disposição

### Controller — Fonte da Verdade

`src/core/controller/index.ts` é o componente mais crítico da extensão:

```text
Controller
├── StateManager          → persiste e lê estado global e de workspace
├── ApiHandler            → gerencia conexão com providers de IA
├── McpHub                → orquestra servidores MCP
├── ContextManager        → rastreia arquivos abertos, contexto do workspace
├── Task (current)        → loop do agente em execução
└── Handlers por domínio:
    ├── account/          → auth, planos, créditos
    ├── settings/         → configurações, API keys, rules
    ├── mcp/              → gerenciar servidores MCP
    ├── task/             → criar, resumir, deletar tasks
    └── ui/               → estado visual, banners, modais
```

O Controller expõe métodos que correspondem diretamente aos RPCs Protobuf — cada RPC do proto tem um handler correspondente aqui.

---

## Camada de Cliente — Webview e CLI

### Webview (React + Vite)

A interface da extensão é uma aplicação React rodando dentro de um WebviewView do VS Code.

**Estrutura em `webview-ui/src/`:**

```text
context/
├── ExtensionStateContext.tsx   ← estado global espelhado da extensão
├── GitHubAuthContext.tsx       ← estado de auth GitHub Copilot
└── (outros contextos por feature)

components/
├── welcome/       WelcomeView — tela inicial
├── onboarding/    OnboardingView + steps — fluxo de primeiro uso
├── chat/          ChatView — interface principal
├── settings/      SettingsView
├── history/       HistoryView
└── mcp/           McpView

grpc-client/       ← clients gerados (não editar manualmente)
```

**Fluxo de estado:**

```text
Extensão envia estado → postMessage({ type: "state", ... })
         │
         ▼
ExtensionStateContext.tsx recebe e atualiza contexto React
         │
         ▼
Componentes re-renderizam automaticamente
         │
Usuário interage → UiServiceClient.methodName(Request.create({...}))
         │
         ▼
Controller processa → atualiza estado → envia de volta
```

### CLI (React Ink)

O CLI (`cli/src/`) reimplementa a UI em terminal usando [React Ink](https://github.com/vadimdemedes/ink) — a mesma API de componentes React, mas renderizando caracteres de terminal em vez de HTML.

Compartilha a mesma lógica de core (`src/`) com a extensão. Útil para automação, scripts e ambientes sem GUI.

---

## Protocolo de Comunicação — Protobuf + gRPC

### Por que Protobuf?

Em vez de `JSON.parse(message)` e `if (type === "...")` espalhados pelo código, o NexusAI usa **Protocol Buffers** para definir todos os contratos de comunicação. Isso garante:

- ✅ **Tipagem forte** — TypeScript sabe exatamente o que cada mensagem contém
- ✅ **Evolução controlada** — adicionar campos não quebra clientes existentes
- ✅ **Documentação como código** — o `.proto` é a especificação

### Estrutura dos protos

```text
proto/cline/
├── account.proto     — autenticação, planos, organizações
├── common.proto      — tipos compartilhados (EmptyRequest, String, etc.)
├── models.proto      — configuração de providers, enum ApiProvider
├── state.proto       — estado global, settings, terminal profiles
├── task.proto        — criação de tasks, mensagens, histórico
├── ui.proto          — estado da UI, ClineSay enum
├── mcp.proto         — servidores MCP, chamada de ferramentas
├── browser.proto     — ações de browser
├── hooks.proto       — hooks pré/pós execução
└── worktree.proto    — operações git worktree
```

### Como adicionar um RPC (passo a passo)

**1. Defina no `.proto`:**

```protobuf
// proto/cline/account.proto
service AccountService {
  rpc githubSignIn(EmptyRequest) returns (GitHubAuthState);
  rpc subscribeToGitHubAuthState(EmptyRequest) returns (stream GitHubAuthState);
}

message GitHubAuthState {
  bool is_signed_in = 1;
  optional string display_name = 2;
  optional string login = 3;
}
```

**2. Gere o código:**

```bash
npm run protos
# Gera em src/shared/proto/cline/*.ts
#       src/generated/grpc-js/
#       src/generated/nice-grpc/
```

**3. Implemente o handler no backend:**

```typescript
// src/core/controller/account/githubSignIn.ts
export async function githubSignIn(
  _controller: Controller,
  _: EmptyRequest
): Promise<GitHubAuthState> {
  return GitHubAuthService.getInstance().signIn()
}
```

**4. Registre no Controller:**

```typescript
// src/core/controller/index.ts
this.accountHandler = new AccountHandler({
  githubSignIn,
  githubSignOut,
  subscribeToGitHubAuthState,
})
```

**5. Chame do frontend:**

```typescript
// webview-ui
import { AccountServiceClient } from "path/to/grpc-client"

const state = await AccountServiceClient.githubSignIn(EmptyRequest.create({}))
// state.isSignedIn === true
```

### Streaming

RPCs com `stream` no retorno criam subscriptions reativas:

```typescript
// Frontend
for await (const state of AccountServiceClient.subscribeToGitHubAuthState(
  EmptyRequest.create({})
)) {
  updateAuthState(state) // chamado cada vez que o backend emite
}
```

---

## O Loop do Agente — Task

`src/core/task/index.ts` é o "cérebro" do agente. Quando o usuário envia uma mensagem, ela cria uma `Task`:

```text
Usuário envia mensagem
        │
        ▼
Task.run()
  │
  ├─ buildSystemPrompt()        → monta prompt com context, rules, skills
  │
  ├─ callAiModel()              → envia para o provider escolhido
  │
  ├─ parseToolUses()            → extrai chamadas de ferramentas da resposta
  │
  ├─ ToolExecutor.execute()     → executa cada ferramenta
  │   ├─ FileRead
  │   ├─ ExecuteCommand
  │   ├─ BrowserAction
  │   ├─ UseMcpTool
  │   └─ ...
  │
  ├─ streamToWebview()          → envia resposta parcial para a UI
  │
  └─ (loop) → se há mais ferramentas a executar, volta ao início
```

### System Prompt Modular

O system prompt é montado de forma modular em `src/core/prompts/system-prompt/`:

```text
components/          → blocos reutilizáveis (tools, rules, skills, context)
variants/            → configurações por família de modelo
  ├── claude/        → prompt otimizado para Claude
  ├── openai/        → prompt otimizado para GPT/O-series
  ├── gemini/        → prompt otimizado para Gemini
  └── xs/            → versão condensada para modelos com janela menor
templates/           → placeholders {{PLACEHOLDER}} substituídos em runtime
```

---

## Sistema de Ferramentas — Tools

O NexusAI possui 25+ ferramentas nativas. Cada uma segue a mesma interface:

```typescript
interface ToolHandler {
  execute(params: ToolParams): Promise<ToolResult>
  validate(params: ToolParams): ValidationResult
  getDescription(): string
}
```

**Categorias de ferramentas:**

| Categoria | Ferramentas |
| --------- | ----------- |
| **Arquivos** | `read_file`, `write_to_file`, `replace_in_file`, `list_files`, `search_files` |
| **Shell** | `execute_command` |
| **Browser** | `browser_action` (Puppeteer) |
| **MCP** | `use_mcp_tool`, `access_mcp_resource`, `load_mcp_documentation` |
| **Web** | `web_fetch`, `web_search` |
| **Agente** | `ask_followup_question`, `attempt_completion`, `new_task` |
| **Skills** | `use_skill`, `use_subagents` |
| **Controle** | `plan_mode_respond`, `act_mode_respond`, `focus_chain` |

**Para adicionar uma nova ferramenta** (5 arquivos obrigatórios):

1. `src/shared/tools.ts` — adiciona ao enum `ClineDefaultTool`
2. `src/core/prompts/system-prompt/tools/` — cria arquivo de definição (com `[GENERIC]`)
3. `src/core/prompts/system-prompt/tools/init.ts` — registra a ferramenta
4. `src/core/prompts/system-prompt/variants/*/config.ts` — whitelist em cada variante
5. `src/core/task/tools/handlers/` — implementa o handler, registra no `ToolExecutor.ts`

---

## Serviços

Serviços em `src/services/` são singleton ou stateless helpers usados pelo Controller e pela Task:

| Serviço | Responsabilidade |
| ------- | ---------------- |
| `auth/GitHubAuthService` | Auth via `vscode.authentication` (GitHub Copilot) |
| `mcp/McpHub` | Orquestra conexões com servidores MCP |
| `browser/BrowserSession` | Controla instância Puppeteer para automação web |
| `browser/UrlContentFetcher` | Busca e converte conteúdo de URLs |
| `glob/` | Listagem de arquivos, integração com ripgrep |
| `tree-sitter/` | Parsing de AST para análise de código |
| `telemetry/` | PostHog — telemetria opt-in |
| `error/ErrorService` | Captura e reporte centralizado de erros |
| `feature-flags/` | Feature toggles para rollout gradual |
| `temp/ClineTempManager` | Limpeza periódica de arquivos temporários (24h) |

---

## Build System

### Fluxo de build

```bash
npm run compile
   │
   ├─ check-types        → tsc (sem emit) em extension + webview + cli
   ├─ lint               → biome lint + proto-lint
   └─ build:esbuild      → empacota extension.ts em dist/extension.js
```

```bash
npm run watch  (desenvolvimento)
   │
   ├─ protos             → gera tipos protobuf
   ├─ watch:tsc          → type-check em modo watch
   ├─ watch:esbuild      → recompila extensão a cada mudança
   └─ dev:webview        → Vite HMR para o webview
```

### Saídas

| Artefato | Caminho | Gerado por |
| -------- | ------- | ---------- |
| Extensão compilada | `dist/extension.js` | esbuild |
| Webview build | `webview-ui/build/` | Vite |
| Tipos proto | `src/shared/proto/cline/` | `buf` + `ts-proto` |
| Clientes gRPC | `src/generated/` | `buf` + plugins |
| CLI | `cli/dist/cli.mjs` | esbuild separado |

### Regra de ouro

> **Sempre rode `npm run protos` após qualquer mudança em `.proto`.**
> O TypeScript compila, mas os handlers e clientes usam tipos gerados — sem regenerar, os tipos estarão defasados e bugs silenciosos surgirão.

---

## Padronizações e Ferramentas

### Linguagens e Frameworks

| Camada | Tecnologia |
| ------ | ---------- |
| Extensão (host) | TypeScript 5 |
| UI (webview) | React 18 + Vite 5 |
| UI (terminal) | React Ink 5 |
| Comunicação | Protocol Buffers 3 + gRPC |
| Geração de protos | `buf` + `ts-proto` + `nice-grpc` |

### Qualidade de Código

| Ferramenta | Função |
| ---------- | ------ |
| **Biome** | Linter + formatter (substitui ESLint + Prettier) |
| **TypeScript strict** | `"strict": true` — sem `any` implícito |
| **Mocha** | Testes unitários |
| **Playwright** | Testes E2E |
| **Snapshot tests** | Validação de mudanças no system prompt |

**Biome** foi escolhido por ser escrito em Rust — ordens de magnitude mais rápido que ESLint + Prettier, com configuração unificada em `biome.jsonc`.

### Padrões de Commit (Conventional Commits)

```
feat:     nova funcionalidade
fix:      correção de bug
docs:     apenas documentação
refactor: sem mudança de comportamento
test:     adição ou correção de testes
chore:    configuração, CI, dependências
perf:     melhoria de performance
```

Todos os commits passam por um hook de **lint-staged** que verifica tipagem e formatação antes do commit.

### Padrões de Caminho

```typescript
// ✅ Sempre use helpers de path para cross-platform
import { toPosixString } from "../../utils/path"
const normalizedPath = toPosixString(absolutePath)

// ❌ Nunca use path.join() diretamente sem normalizar
```

### Gitflow

```text
master ─────────────────────────────► releases estáveis + tags de versão
   ▲
   │ PR
develop ────────────────────────────► integração contínua
   ▲
   │ PR obrigatório
feat/nome-da-feature ───────────────► desenvolvimento isolado
fix/nome-do-bug
docs/nome-da-doc
```

- Nenhum push direto para `master` ou `develop`
- PRs requerem review
- CI deve passar (types + lint + tests)

---

[← Visão](Visao.md) · [Home](Home.md) · [Contribuindo →](Contribuindo.md)
