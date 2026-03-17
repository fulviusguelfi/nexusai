# Contribuindo com o NexusAI

Obrigado por querer contribuir! Este guia cobre tudo que você precisa para configurar o ambiente, entender os padrões do projeto e abrir seu primeiro PR.

---

## Sumário

- [Configurando o Ambiente](#configurando-o-ambiente)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Fluxo de Desenvolvimento](#fluxo-de-desenvolvimento)
- [Comandos Importantes](#comandos-importantes)
- [Padrões de Código](#padrões-de-código)
- [Trabalhando com Protobuf](#trabalhando-com-protobuf)
- [Adicionando Features](#adicionando-features)
- [Testes](#testes)
- [Abrindo um PR](#abrindo-um-pr)

---

## Configurando o Ambiente

### Pré-requisitos

- **Node.js 20+** (`node --version`)
- **npm 10+** (`npm --version`)
- **VS Code** — este projeto é uma extensão VS Code
- **Git** com acesso ao repositório

### Instalação

```bash
git clone https://github.com/fulviusguelfi/nexusai.git
cd nexusai

# Instala dependências (extensão + webview + CLI)
npm install

# Gera tipos TypeScript dos arquivos .proto (OBRIGATÓRIO)
npm run protos
```

### Rodando em Modo Desenvolvimento

Pressione **F5** no VS Code (ou vá em Run → Start Debugging → "Run Extension (local)").

Isso abrirá uma segunda janela do VS Code (**Extension Development Host**) com a extensão carregada.

Para rebuild automático enquanto você edita:

```bash
npm run watch
# Isso roda em paralelo:
# - watch:tsc       → type-check em watch mode
# - watch:esbuild   → recompila extensão
# - dev:webview     → Vite HMR para o webview
```

> **Dica**: abra dois terminais — um para `npm run watch`, outro para comandos pontuais. O watch nunca termina.

### Verificando que Tudo Funciona

```bash
npm run compile   # deve terminar sem erros
npm run test:unit # deve mostrar "passed"
```

---

## Estrutura do Projeto

```text
nexusai/
├── src/                        # Extensão VS Code (TypeScript)
│   ├── extension.ts            # Ponto de entrada (activate())
│   ├── common.ts               # Inicialização cross-platform
│   ├── registry.ts             # IDs de comandos e views
│   ├── core/
│   │   ├── controller/         # Handlers de RPC por domínio
│   │   ├── task/               # Loop do agente, tool executor
│   │   ├── prompts/            # System prompt modular
│   │   └── webview/            # WebviewProvider abstrato
│   ├── hosts/
│   │   └── vscode/             # Implementação VS Code específica
│   ├── services/               # Serviços singleton
│   │   └── auth/GitHubAuthService.ts
│   └── shared/
│       ├── proto/              # Tipos gerados (não editar)
│       └── tools.ts            # Enum de ferramentas
│
├── webview-ui/                 # Interface React (Vite)
│   └── src/
│       ├── context/            # React contexts (estado global)
│       ├── components/         # Componentes por feature
│       └── grpc-client/        # Clientes gerados (não editar)
│
├── cli/                        # CLI React Ink
│   └── src/
│
├── proto/cline/                # Definições Protobuf
│   ├── account.proto
│   ├── task.proto
│   └── ...
│
├── src/generated/              # Código gRPC gerado (não editar)
├── src/test/e2e/               # Testes E2E Playwright
├── scripts/                    # Scripts de build e ferramentas
├── docs/wiki/                  # Esta documentação
└── .clinerules/
    └── general.md              # Tribal knowledge — LEIA ANTES DE CODAR
```

> **Antes de começar**, leia `.clinerules/general.md`. Ele contém padrões críticos e armadilhas comuns que não ficam bem em documentação formal.

---

## Fluxo de Desenvolvimento

### 1. Crie uma branch

```bash
git checkout develop
git pull origin develop
git checkout -b feat/nome-da-feature
# ou:
git checkout -b fix/nome-do-bug
git checkout -b docs/nome-da-doc
```

### 2. Desenvolva

Faça suas mudanças seguindo os [padrões de código](#padrões-de-código).

Se alterou um `.proto`: **rode `npm run protos` imediatamente.**

### 3. Verifique

```bash
npm run compile       # tipos + lint + build
npm run test:unit     # testes unitários
```

### 4. Commit

```bash
git add .
git commit -m "feat: descrição clara do que foi feito"
```

O hook de pré-commit verifica formatação e lint automaticamente via lint-staged.

### 5. Push e PR

```bash
git push origin feat/nome-da-feature
# Abra PR para develop no GitHub
```

---

## Comandos Importantes

| Comando | Quando usar |
| ------- | ----------- |
| `npm run protos` | **DEPOIS de qualquer mudança em `.proto`** |
| `npm run compile` | Antes de commitar — verifica tudo |
| `npm run watch` | Desenvolvimento contínuo |
| `npm run test:unit` | Verificar testes unitários |
| `npm run check-types` | Só checagem de tipos sem build |
| `npm run lint` | Só lint sem build |
| `npm run format:fix` | Auto-corrigir formatação |
| `UPDATE_SNAPSHOTS=true npm run test:unit` | Após mudar system prompt |
| `npx playwright test -c playwright.config.ts` | Rodar testes E2E |

---

## Padrões de Código

### TypeScript

- **Strict mode habilitado** — sem `any` implícito, sem `!` desnecessário
- **Sem magic strings** — use enums ou constantes nomeadas
- **Paths cross-platform** — sempre use `toPosixString()` de `src/utils/path`

```typescript
// ✅ Correto
import { toPosixString } from "../../utils/path"
const normalizedPath = toPosixString(rawPath)

// ❌ Errado
const normalizedPath = rawPath.replace(/\\/g, "/")
```

### Formatação (Biome)

O projeto usa [Biome](https://biomejs.dev/) — linter e formatter unificado (substitui ESLint + Prettier). A configuração está em `biome.jsonc`.

O `npm run format:fix` corrige tudo automaticamente. Não configure plugins de formatação diferentes no VS Code para este projeto.

### Nomenclatura

| Contexto | Padrão | Exemplo |
| -------- | ------ | ------- |
| Arquivos | `camelCase.ts` | `githubSignIn.ts` |
| Classes e interfaces | `PascalCase` | `GitHubAuthService` |
| Funções e variáveis | `camelCase` | `signIn()`, `authState` |
| Enums e membros | `PascalCase` | `ClineDefaultTool.FILE_READ` |
| Proto services | `PascalCaseService` | `AccountService` |
| Proto RPCs | `camelCase` | `githubSignIn` |
| Proto messages | `PascalCase` | `GitHubAuthState` |
| Constantes de módulo | `SCREAMING_SNAKE` | `SIDEBAR_ID` |

### Logging

Use sempre o Logger centralizado:

```typescript
import { Logger } from "../shared/services/Logger"

Logger.log("mensagem informativa")
Logger.warn("alerta")
Logger.error("erro", error)
```

Nunca use `console.log` diretamente no código de produção.

---

## Trabalhando com Protobuf

Os arquivos `.proto` em `proto/cline/` definem o contrato de comunicação entre extensão e webview. **Nunca edite os arquivos em `src/shared/proto/` ou `src/generated/` diretamente** — eles são gerados.

### Fluxo completo para adicionar um RPC

**Passo 1** — Edite o `.proto` adequado:

```protobuf
// proto/cline/account.proto
service AccountService {
  // Adicione o novo RPC
  rpc meuNovoRpc(MinhaRequest) returns (MinhaResponse);
}

message MinhaRequest {
  string campo = 1;
}

message MinhaResponse {
  bool sucesso = 1;
  string mensagem = 2;
}
```

**Passo 2** — Regenere:

```bash
npm run protos
```

**Passo 3** — Implemente o handler:

```typescript
// src/core/controller/account/meuNovoRpc.ts
import type { Controller } from "../index"
import type { MinhaRequest, MinhaResponse } from "../../../shared/proto/cline/account"

export async function meuNovoRpc(
  controller: Controller,
  request: MinhaRequest
): Promise<MinhaResponse> {
  // implementação
  return MinhaResponse.create({ sucesso: true, mensagem: "ok" })
}
```

**Passo 4** — Registre no Controller (veja o padrão nos handlers existentes em `src/core/controller/account/`).

**Passo 5** — Use no frontend:

```typescript
import { AccountServiceClient } from "../../grpc-client"
import { MinhaRequest } from "../../grpc-client/cline/account"

const response = await AccountServiceClient.meuNovoRpc(
  MinhaRequest.create({ campo: "valor" })
)
```

### Adicionando enums novos

Se o novo RPC usa um enum que precisa aparecer na UI ou no state, ele também precisa de conversores:

```typescript
// src/shared/proto-conversions/models/api-configuration-conversion.ts
export function convertMeuEnumToProto(value: MeuEnumNativo): ProtoMeuEnum { ... }
export function convertProtoToMeuEnum(value: ProtoMeuEnum): MeuEnumNativo { ... }
```

---

## Adicionando Features

### Nova Ferramenta (Tool)

Veja [Arquitetura — Sistema de Ferramentas](Arquitetura.md#sistema-de-ferramentas--tools) para o guia completo dos 5 arquivos obrigatórios.

### Novo Provider de IA

Esta é uma das operações com mais "armadilhas silenciosas". Existem **3 lugares obrigatórios** no proto + conversores — se um faltar, o provider será silenciosamente resetado para Anthropic:

1. `proto/cline/models.proto` — adicione ao enum `ApiProvider`
2. `npm run protos`
3. `src/shared/proto-conversions/models/api-configuration-conversion.ts` — ambas as funções: `convertApiProviderToProto()` e `convertProtoToApiProvider()`
4. `src/shared/api.ts` — tipos nativos
5. `src/shared/providers/providers.json` — metadados do provider
6. `src/core/api/index.ts` — factory
7. `webview-ui/src/utils/providerUtils.ts` — utilitários de UI
8. `webview-ui/src/utils/validate.ts` — validação de configuração
9. `webview-ui/src/components/settings/ApiOptions.tsx` — formulário de configuração
10. `cli/src/components/ModelPicker.tsx` — seleção no CLI

### Novo Componente de UI

1. Crie em `webview-ui/src/components/nome-da-feature/NomeDoComponente.tsx`
2. Se precisar de estado global, adicione ao `ExtensionStateContext.tsx`
3. Se precisar de comunicação com a extensão, adicione ao proto correspondente
4. Adicione ao Storybook: `npm run storybook` para visualização isolada

---

## Testes

### Testes Unitários

```bash
npm run test:unit
```

Ficam em `src/__tests__/` e usam **Mocha**. Se você alterou o system prompt, regenere os snapshots:

```bash
UPDATE_SNAPSHOTS=true npm run test:unit
```

### Testes E2E

```bash
# Build especial para testes (inclui helpers de teste)
npm run test:e2e:build

# Rodar todos os testes
npx playwright test -c playwright.config.ts

# Rodar arquivo específico
npx playwright test src/test/e2e/github.test.ts

# Modo interativo (abre browser)
npx playwright test --headed
```

Os testes ficam em `src/test/e2e/`. Para adicionar um novo:

```typescript
// src/test/e2e/minha-feature.test.ts
import { test, expect } from "@playwright/test"

test.describe("Minha Feature", () => {
  test("faz algo esperado", async ({ page }) => {
    // Use seletores semânticos: getByRole, getByLabel
    // Evite seletores por classe ou ID — são instáveis
    await expect(page.getByRole("heading", { name: "Título" })).toBeVisible()
  })
})
```

> **Dica**: use `{ exact: true }` em `getByText()` quando o texto pode aparecer em múltiplos elementos para evitar violações de strict mode.

---

## Abrindo um PR

### Checklist antes de abrir

- [ ] `npm run compile` passa sem erros
- [ ] `npm run test:unit` passa
- [ ] Se alterou `.proto`: `npm run protos` foi rodado e os arquivos gerados estão no commit
- [ ] Se alterou system prompt: snapshots foram regenerados
- [ ] Commits seguem o padrão Conventional Commits
- [ ] A branch está atualizada com `develop`

### Template de PR

Ao abrir o PR, o template em `.github/PULL_REQUEST_TEMPLATE.md` será preenchido automaticamente. Preencha todas as seções, especialmente:

- **O que foi feito** — descrição clara
- **Como testar** — passo a passo para o reviewer reproduzir
- **Tipo de mudança** — feature / fix / docs / refactor
- **Checklist** — marque o que se aplica

### Tamanho ideal de PR

PRs menores são revisados mais rápido e com menos conflitos. Prefira PRs focados em uma única feature ou fix. Se uma feature é grande, quebre em PRs sequenciais — cada um deve deixar o código em estado funcional.

---

## Recursos Adicionais

- [Visão do Projeto](Visao.md) — por que o NexusAI existe
- [Arquitetura](Arquitetura.md) — como funciona por dentro
- [Fase 1 — Fundação](Fase-1-Fundacao.md) — o que já foi feito
- [Roadmap](Roadmap.md) — o que está por vir
- `.clinerules/general.md` — tribal knowledge do projeto
- [Cline (projeto base)](https://github.com/cline/cline) — documentação do upstream

---

[← Roadmap](Roadmap.md) · [Home](Home.md)
