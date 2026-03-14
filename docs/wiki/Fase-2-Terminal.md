# Fase 2 — Controle Local ✅

<!-- markdownlint-disable MD024 -->

> **Status**: Concluída em `2026-03-11`
> **Branch**: `feat/fase-2-terminal` → PR [#14](https://github.com/fulviusguelfi/nexusai/pull/14) para `develop`

A Fase 2 entregou as primeiras ferramentas nativas de controle de terminal, melhorias de testabilidade, renomeações de componentes core e otimizações de performance na inicialização do browser.

---

## Sumário

- [Tarefas Concluídas](#tarefas-concluídas)
- [A1 — Renomeações e Barrels](#a1--renomeações-e-barrels)
- [A2 — Testes de Autenticação GitHub](#a2--testes-de-autenticação-github)
- [B2 — Ferramenta list_processes](#b2--ferramenta-list_processes)
- [B3 — Ferramenta kill_process](#b3--ferramenta-kill_process)
- [B4 — Puppeteer Lazy-Load](#b4--puppeteer-lazy-load)
- [B5 — Build e Testes](#b5--build-e-testes)
- [Issues Relacionados](#issues-relacionados)

---

## Tarefas Concluídas

| # | Tarefa | Descrição |
| - | ------ | --------- |
| A1 | Renomear ClineError → NexusError | `NexusError.ts` com barrels de retrocompatibilidade |
| A1 | Renomear ClineAuthProvider → NexusAuthProvider | `NexusAuthProvider.ts` com barrel `ClineAuthProvider.ts` |
| A1 | Corrigir nome de pacote CLI | `cli/package.json` → `@nexusai/cli` |
| A2 | Testes unitários GitHubAuthService | 12 testes cobrindo todos os métodos públicos |
| B1 | Remover TODO obsoleto | `VscodeTerminalProcess.ts` — comentário `// todo: need to handle errors` removido |
| B2 | Ferramenta `list_processes` | Spec + handler + 12 variantes de prompt + coordinator |
| B3 | Ferramenta `kill_process` | Spec + handler + 12 variantes de prompt + coordinator |
| B4 | Puppeteer lazy-load | `import()` dinâmico em `BrowserSession.ts` |
| B5 | Build e cobertura de testes | tsc clean, 1237 testes passando, snapshots regenerados |

---

## A1 — Renomeações e Barrels

### Motivação

O objetivo é migrar gradualmente a nomenclatura `Cline*` (do projeto upstream) para `Nexus*` (branding próprio) sem quebrar código existente.

### Estratégia

1. **Criar a versão nova** — ex.: `NexusError.ts`, `NexusAuthProvider.ts`
2. **Atualizar o barrel** — o arquivo `ClineError.ts` / `ClineAuthProvider.ts` vira um re-export apontando para o novo:

```ts
// ClineError.ts — backward compat barrel
export {
  NexusError as ClineError,
  NexusErrorType as ClineErrorType,
  NexusError,
  NexusErrorType,
  AuthNetworkError,
  AuthInvalidTokenError,
} from "./NexusError"
```

1. **Código existente** continua importando de `ClineError` sem mudanças.

### Correção CLI Package

O `package.json` da raiz tem `"name": "nexusai"`. Se `cli/package.json` também tiver `"name": "nexusai"`, npm gera `EDUPLICATEWORKSPACE`. Solução: renomear o CLI para `@nexusai/cli`, mantendo o binário chamado `nexusai`.

---

## A2 — Testes de Autenticação GitHub

### Arquivo

`src/services/auth/__tests__/GitHubAuthService.test.ts`

### Cobertura

| Grupo | Testes |
| ----- | ------ |
| `getState()` | sem sessão → `isSignedIn: false`; com sessão → retorna displayName e login |
| `signIn()` | successo, cancelamento pelo usuário, `getSession` retorna undefined |
| `signOut()` | limpa sessão; notifica subscribers |
| `subscribe()` | envia estado atual imediatamente; envia `isSignedIn: false` sem sessão |
| `refreshSilently()` | atualiza sessão com token; limpa sessão sem token |
| `getInstance()` | retorna mesma instância; cria nova após `dispose()` |

### Padrão de Mock

```ts
sandbox.stub(vscodeMock.authentication, "getSession").resolves(mockSession)
```

O módulo `vscode` é interceptado por `src/test/requires.ts` e retorna `vscodeMock`. As stubs funcionam diretamente no objeto mock.

---

## B2 — Ferramenta `list_processes`

### Descrição

Lista os processos em execução no host onde a extensão está rodando. Retorna até 100 linhas de saída.

### Parâmetros

| Parâmetro | Obrigatório | Descrição |
| --------- | ----------- | --------- |
| `filter` | Não | Substring para filtrar processos pelo nome (case-insensitive) |

### Implementação

- **Windows**: `tasklist /fo csv /nh`
- **Unix/macOS**: `ps aux`
- Filtro aplicado com `String.toLowerCase().includes()`
- Output limitado a `MAX_PROCESS_LINES = 100`
- `execSync` injetável via constructor para testabilidade

### Exemplo de Uso

```xml
<list_processes>
<filter>node</filter>
</list_processes>
```

### Arquivos

| Arquivo | Conteúdo |
| ------- | -------- |
| `src/core/prompts/system-prompt/tools/list_processes.ts` | Specs para GENERIC, NATIVE_GPT_5, NATIVE_NEXT_GEN |
| `src/core/task/tools/handlers/ListProcessesToolHandler.ts` | Implementação do handler |
| `src/core/task/tools/handlers/__tests__/ListProcessesToolHandler.test.ts` | 9 testes unitários |
| Todos os 12 `config.ts` de variantes | `LIST_PROCESSES` adicionado após `BASH` |

---

## B3 — Ferramenta `kill_process`

### Descrição

Termina um processo pelo PID. **Requer aprovação explícita do usuário** antes de executar — a extensão apresenta um diálogo de confirmação.

### Parâmetros

| Parâmetro | Obrigatório | Descrição |
| --------- | ----------- | --------- |
| `pid` | **Sim** | PID do processo (inteiro positivo) |
| `signal` | Não | Sinal a enviar (padrão: `SIGTERM`) |

### Implementação

- **Windows**: `taskkill /PID {pid} /F` via `execSync`
- **Unix/macOS**: `process.kill(pid, signal)`
- Validação de PID antes de pedir aprovação
- Se o usuário declinar, retorna mensagem e não mata o processo
- `execSync` injetável via constructor para testabilidade

### Exemplo de Uso

```xml
<kill_process>
<pid>12345</pid>
<signal>SIGKILL</signal>
</kill_process>
```

### Arquivos

| Arquivo | Conteúdo |
| ------- | -------- |
| `src/core/prompts/system-prompt/tools/kill_process.ts` | Specs para GENERIC, NATIVE_GPT_5, NATIVE_NEXT_GEN |
| `src/core/task/tools/handlers/KillProcessToolHandler.ts` | Implementação do handler |
| `src/core/task/tools/handlers/__tests__/KillProcessToolHandler.test.ts` | 14 testes unitários |
| Todos os 12 `config.ts` de variantes | `KILL_PROCESS` adicionado após `LIST_PROCESSES` |

---

## B4 — Puppeteer Lazy-Load

### Problema

`puppeteer-core` é um pacote pesado (~50 MB de binários Chromium). Importá-lo no nível do módulo (`import { launch } from "puppeteer-core"`) causava overhead na inicialização de toda a extensão, mesmo quando o browser nunca era usado.

### Solução

Converter para `import()` dinâmico dentro dos métodos `launchLocalBrowser()` e `launchRemoteBrowser()`:

```ts
// Antes
import { Browser, connect, launch, Page, TimeoutError } from "puppeteer-core"

// Depois
import type { Browser, Page } from "puppeteer-core"

async function launchLocalBrowser() {
  const { launch } = await import("puppeteer-core") // carrega sob demanda
  return launch({ ... })
}
```

### Quirk: `instanceof TimeoutError`

Com a importação removida, `TimeoutError` não está mais disponível como valor. Substituído por:

```ts
// Antes
if (err instanceof TimeoutError) { ... }

// Depois
if (err instanceof Error && err.name === "TimeoutError") { ... }
```

---

## B5 — Build e Testes

### Resultado

| Métrica | Valor |
| ------- | ----- |
| `tsc --noEmit` | ✅ Exit 0 (zero erros) |
| Testes unitários passando | **1237** |
| Testes falhando | **0** |
| Snapshots regenerados | 12 variantes |
| Novos testes adicionados nesta fase | 23 (9 + 14) |
| Testes de auth | 12 (GitHubAuthService) |

### Cobertura por Componente

| Componente | Testes |
| ---------- | ------ |
| `GitHubAuthService` | 12 |
| `ListProcessesToolHandler` | 9 |
| `KillProcessToolHandler` | 14 |

### Nota sobre `toolParamNames`

O tipo `ToolParamName` em `src/core/assistant-message/index.ts` é uma união estrita. Qualquer `block.params.X` usado em um handler exige que `"X"` esteja no array `toolParamNames`. Adicionamos `"filter"`, `"pid"` e `"signal"` nessa fase.

---

## B6 — Suite E2E Playwright

### Problema Raiz

A suite E2E existente falhava silenciosamente porque o servidor mock da API (`ClineApiServerMock` na porta 7777) nunca era iniciado. O fixture `server` estava definido mas nenhum teste o desestruturava explicitamente — e o Playwright só ativa fixtures quando explicitamente solicitados.

### Solução

Três correções foram necessárias em sequência:

#### 1. Dependency entre fixtures (`helpers.ts`)

```typescript
// Antes: app não dependia de server
app: async ({ openVSCode, userDataDir, ... }, use) => { ... }

// Depois: app garante que server está rodando
app: async ({ server, openVSCode, userDataDir, ... }, use) => {
  if (!server) throw new Error("Mock server failed to start")
  // ...
}
```

#### 2. Provider fixado em "cline" (`OnboardingView.tsx`)

O provider estava sendo setado como "openrouter" por padrão durante o signin. Adicionado:

```typescript
case "signin":
  // ...
  await handleFieldsChange({
    planModeApiProvider: "cline",
    actModeApiProvider: "cline",
  })
```

#### 3. Teardown com timeout (`helpers.ts`)

`app.close()` travava indefinidamente em alguns testes no Windows, consumindo todo o timeout do teste:

```typescript
// Antes
await app.close()

// Depois — 10s de limite para fechar o VS Code
await Promise.race([
  app.close(),
  new Promise(resolve => setTimeout(resolve, 10_000)),
])
```

### Resultado Final

| Suite | Testes | Status |
| ----- | ------ | ------ |
| `diff.test.ts` | 2 (Single Root + Multi-Roots) | ✅ Passando |
| `chat.test.ts` | 2 (Single Root + Multi-Roots) | ✅ Passando |
| `editor.test.ts` | 2 (Single Root + Multi-Roots) | ✅ Passando |
| `auth.test.ts` | 2 | ✅ Passando |
| `github.test.ts` | 4 | ✅ Passando |
| `copilot-provider.test.ts` | 1 | ⏭️ Skipped (requer vscode-lm real) |

**Total**: 13 passando · 0 falhando · 1 skipped

---

## Issues Relacionados

Os seguintes issues foram criados para rastrear work futuro identificado durante esta fase:

| Issue | Título | Prioridade |
| ----- | ------ | ---------- |
| [#15](https://github.com/fulviusguelfi/nexusai/issues/15) | feat: cross-platform `kill_process` (Linux/macOS) | Antes de Fase 3 |
| [#16](https://github.com/fulviusguelfi/nexusai/issues/16) | docs: DI-for-testability pattern | ✅ Resolvido — adicionado em `.clinerules/general.md` |
| [#18](https://github.com/fulviusguelfi/nexusai/issues/18) | bug: checkpoint timeout + API retry backoff | Inicio de Fase 3 |
| [#6](https://github.com/fulviusguelfi/nexusai/issues/6) | refactor: extract getEnvironmentDetails | Sprint tech-debt → Fase 4+ |
| [#7](https://github.com/fulviusguelfi/nexusai/issues/7) | refactor: extract processNativeToolCalls | Sprint tech-debt → Fase 4+ |
| [#8](https://github.com/fulviusguelfi/nexusai/issues/8) | refactor: extract ContextCompactor | Sprint tech-debt → Fase 4+ |
| [#9](https://github.com/fulviusguelfi/nexusai/issues/9) | refactor: extract PresentationLayer | Sprint tech-debt → Fase 4+ |
| [#10](https://github.com/fulviusguelfi/nexusai/issues/10) | refactor: extract TaskRunner | Sprint tech-debt → Fase 4+ |
| [#11](https://github.com/fulviusguelfi/nexusai/issues/11) | refactor: ICheckpointManager interface | Durante Fase 3 |
| [#12](https://github.com/fulviusguelfi/nexusai/issues/12) | perf: lazy-initialize MultiRootCheckpointManager | Durante Fase 3 |
| [#13](https://github.com/fulviusguelfi/nexusai/issues/13) | test: unit tests MultiRootCheckpointManager | Durante Fase 3 |

---

## O que vem a seguir

- **Fase 3** — Conexão SSH: controle de máquinas remotas via `ssh2`
- **Fase 4** — Voz TTS/STT: Piper (síntese) + Whisper (reconhecimento)
- **Fase 5** — IoT: MQTT, HTTP, WebSocket para dispositivos locais
