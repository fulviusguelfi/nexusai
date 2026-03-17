# Fase 1 — Fundação ✅

> **Status**: Concluída em `2026-03-11`
> **Branch**: `feat/fase-1-fundacao` → PR [#2](https://github.com/fulviusguelfi/nexusai/pull/2) para `develop`

A Fase 1 estabeleceu a base do projeto: identidade, estrutura de repositório e o primeiro fluxo funcional de autenticação com GitHub Copilot.

---

## Sumário

- [Tarefas Concluídas](#tarefas-concluídas)
- [1.3 — Renomeação do Projeto](#13--renomeação-do-projeto)
- [1.4 — Identidade Visual](#14--identidade-visual)
- [1.5 — Licença e Autoria](#15--licença-e-autoria)
- [1.6 — Documentação Base](#16--documentação-base)
- [1.7 — GitHub Copilot como Auth Primária](#17--github-copilot-como-auth-primária)
- [Testes](#testes)
- [O que vem a seguir](#o-que-vem-a-seguir)

---

## Tarefas Concluídas

| # | Tarefa | Commit | Detalhes |
| - | ------ | ------ | -------- |
| 1.1 | Criar repositório GitHub | setup inicial | Repositório `fulviusguelfi/nexusai` |
| 1.2 | Configurar branches (master, develop) | setup inicial | Gitflow com PR obrigatório |
| 1.3 | Renomear projeto para NexusAI | `chore: rename project` | `package.json`, `README.md`, metadados |
| 1.4 | Identidade visual | `feat: redesign visual identity` | Ícone SVG, PNGs, logos Mintlify |
| 1.5 | Autores e licença | `docs: update documentation` | `NOTICE`, atribuição Apache-2.0 |
| 1.6 | Documentos do projeto | `chore: update dot-folders` | `PLAN.md`, `CRONOGRAMA.md`, `.clinerules/` |
| 1.7 | GitHub Copilot como auth primária | `feat: add GitHub Copilot integration` | Ver seção detalhada abaixo |

---

## 1.3 — Renomeação do Projeto

O fork foi renomeado de `cline` para `nexusai` com as seguintes mudanças:

- `package.json`: `name`, `displayName`, `version`, `author`, `publisher`, `repository`
- `README.md`: completamente reescrito em PT-BR com identidade NexusAI
- Metadados de comandos VS Code (`cline.*`) mantidos **intencionalmente** — renomear quebra compatibilidade com configurações existentes e está planejado para versão futura

---

## 1.4 — Identidade Visual

Novo ícone desenhado do zero usando Lucide icons (`brain-circuit` + `sparkles`):

- **Fundo**: gradiente `#0B1220 → #1D4ED8 → #0891B2` (escuro-azul-ciano)
- Arquivos gerados:
  - `assets/icons/icon.svg` — fonte, editável
  - `assets/icons/icon.png` — 128×128 para VS Code Marketplace
  - `assets/icons/robot_panel_light.png` / `dark.png` — 29×30 para Activity Bar
  - `docs/assets/nexusai-logo-*.png` — 256×256 para documentação Mintlify

---

## 1.5 — Licença e Autoria

Por ser um fork Apache-2.0, o arquivo `NOTICE` foi atualizado para incluir:

- Atribuição ao projeto upstream **Cline** (saoudrizwan) conforme Apache-2.0 §4(a)
- Crédito ao mantenedor: **Fulvius Titanero Guelfi**

A licença MIT (mais permissiva) está em avaliação para versões futuras após análise jurídica.

---

## 1.6 — Documentação Base

Documentos criados ou atualizados:

| Arquivo | Conteúdo |
| ------- | -------- |
| `PLAN.md` | Plano geral do projeto, arquitetura, modos de operação |
| `docs/CRONOGRAMA.md` | Cronograma detalhado com tarefas por fase |
| `.clinerules/general.md` | Tribal knowledge — padrões de código, commits, protobuf |
| `.github/CODEOWNERS` | `@fulviusguelfi` como responsável por todos os arquivos |
| `.github/ISSUE_TEMPLATE/` | Templates de issue adaptados para NexusAI |
| `.github/workflows/` | Workflows ajustados para `master` e `fulviusguelfi/nexusai` |

---

## 1.7 — GitHub Copilot como Auth Primária

Esta foi a maior entrega técnica da Fase 1. O objetivo: permitir que o usuário comece a usar o NexusAI imediatamente, sem precisar criar conta em provedores externos ou configurar chaves de API.

### Por que vscode.authentication?

O VS Code possui uma API nativa de autenticação (`vscode.authentication`) que integra com todos os provedores suportados pelo editor — incluindo GitHub. Ao usar esta API:

- ✅ O usuário já está autenticado no GitHub (na maioria dos casos)
- ✅ Nenhum token é armazenado manualmente no código
- ✅ Suporte nativo a todos os métodos: browser OAuth, passkey, app mobile, PAT
- ✅ Renovação automática de sessão gerenciada pelo VS Code

### Arquitetura

```text
VS Code Authentication API
         │
         ▼
  GitHubAuthService          ← singleton, src/services/auth/
         │
    ┌────┴────┐
    │         │
Controller   Webview
handlers     context
    │         │
  gRPC-like  React state
  (protobuf)
```

### GitHubAuthService

Localização: `src/services/auth/GitHubAuthService.ts`

```typescript
// Autenticar (abre fluxo nativo do VS Code)
const state = await GitHubAuthService.getInstance().signIn()
// state.isSignedIn === true se sucesso

// Escutar mudanças em tempo real
GitHubAuthService.getInstance().subscribe(async (state) => {
  // chamado cada vez que o estado muda
})
```

**Métodos públicos:**

| Método | Retorno | Descrição |
| ------ | ------- | --------- |
| `signIn()` | `Promise<GitHubAuthState>` | Abre fluxo de auth do VS Code |
| `signOut()` | `Promise<void>` | Remove sessão do provider |
| `getState()` | `Promise<GitHubAuthState>` | Estado atual sem criação de sessão |
| `subscribe(cb)` | função de cleanup | Stream de mudanças de estado |
| `refreshSilently()` | `Promise<void>` | Atualiza sessão sem interação |

### Protobuf RPCs

Definidos em `proto/cline/account.proto`:

```protobuf
// Iniciar login
rpc githubSignIn(EmptyRequest) returns (GitHubAuthState);

// Logout
rpc githubSignOut(EmptyRequest) returns (google.protobuf.Empty);

// Stream de estado (escuta mudanças em tempo real)
rpc subscribeToGitHubAuthState(EmptyRequest) returns (stream GitHubAuthState);

message GitHubAuthState {
  bool is_signed_in = 1;
  optional string display_name = 2;
  optional string email = 3;
  optional string avatar_url = 4;
  optional string login = 5;
}
```

### Controller Handlers

Cada RPC tem um handler em `src/core/controller/account/`:

- `githubSignIn.ts` → delega para `GitHubAuthService.getInstance().signIn()`
- `githubSignOut.ts` → delega para `GitHubAuthService.getInstance().signOut()`
- `subscribeToGitHubAuthState.ts` → stream via `GitHubAuthService.getInstance().subscribe()`

### Webview — GitHubAuthContext

`webview-ui/src/context/GitHubAuthContext.tsx` fornece um contexto React com:

```typescript
const { state, signIn, signOut } = useGitHubAuth()

// signIn() retorna Promise<boolean> — true se autenticou com sucesso
const success = await signIn()
if (success) {
  // redirecionar para próxima etapa
}
```

O contexto assina `subscribeToGitHubAuthState` automaticamente no mount, mantendo o estado sincronizado em tempo real sem polling.

### Fluxo de Onboarding

```text
WelcomeView
  └─ "Connect GitHub Copilot" (botão primário)
       │
       ▼
  OnboardingView (step 0 — GitHub como default)
       │
       ▼
  handleFooterAction("github")
       │
       ├─ chama githubSignIn()
       │
       ├─ se isSignedIn === true
       │    └─ define provider vscode-lm + fecha welcome
       │
       └─ se false
            └─ mostra mensagem de erro
```

---

## Testes

### Testes Unitários

```bash
npm run test:unit
# ✅ 1 passed, 0 failed
```

### Testes E2E (Playwright)

Cobertura adicionada em `src/test/e2e/github.test.ts`:

| Cenário | Descrição |
| ------- | --------- |
| 1 | GitHub Copilot aparece como primeiro tipo de usuário no step 0 |
| 2 | Navega do tipo GitHub para step de conexão e volta |
| 3 | Troca de GitHub para BYOK e acessa configuração de provider |
| 4 | Troca de GitHub para free tier e vê seleção de modelo |

```bash
# Build + run E2E
npm run test:e2e:build
npx playwright test -c playwright.config.ts
# ✅ 9/11 passed (2 flaky pré-existentes, não relacionados)
```

---

## O que vem a seguir

A **Fase 2** implementará o controle local — adaptação do terminal do Cline, comandos shell básicos e gerenciamento de processos.

Veja o [Roadmap](Roadmap.md) para detalhes.

---

[← Home](Home.md) · [Arquitetura →](Arquitetura.md)
