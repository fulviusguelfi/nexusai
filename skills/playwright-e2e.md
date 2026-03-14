# Playwright E2E — NexusAI

## Pipeline de Build (obrigatório antes dos testes)
```powershell
npm run ci:build          # compile + build:webview + compile-tests
npm run test:e2e:build    # gera dist/e2e.vsix
npx playwright test --reporter=line
npx playwright test src/test/e2e/ssh.test.ts --reporter=line
npx playwright test --last-failed --reporter=line
```
> **Regra**: sempre rodar `ci:build` + `test:e2e:build` se qualquer `.ts` foi modificado.  
> **Exceção**: se só `dist/extension.js` mudou (via `node esbuild.mjs`) e o `e2e.vsix` já existe, não precisa reempacotar — o VS Code usa `--extensionDevelopmentPath` que carrega `dist/extension.js` diretamente.

## Estrutura
```
src/test/e2e/
├── utils/helpers.ts          # E2ETestHelper, fixture `e2e`
├── fixtures/server/
│   ├── api.ts                # constantes de resposta LLM por cenário
│   └── index.ts              # ClineApiServerMock (roteamento)
├── fixtures/ssh-server/
│   └── index.ts              # MockSshServer
└── *.test.ts                 # auth, chat, checkpoint, diff, editor, ssh, terminal
```

## Fixtures disponíveis
| Fixture | Tipo | Descrição |
|---|---|---|
| `sidebar` | `Frame` | iframe da extensão |
| `helper` | `E2ETestHelper` | `signin()`, `getSidebar()`, etc. |
| `server` | `ClineApiServerMock` | Mock LLM (compartilhado no `describe`) |
| `workspaceDir` | `string` | Caminho do workspace fixture |

## Mock LLM Server — padrão de roteamento
O mock analisa o `body` da request e retorna XML de tool-call predefinido.

**1. `fixtures/server/api.ts`** — definir constantes:
```typescript
export const MEU_TOOL_REQUEST = `<tool_call><minha_ferramenta><param>valor</param></minha_ferramenta></tool_call>`
export const MEU_TOOL_COMPLETION = "Tarefa concluída."
```

**2. `fixtures/server/index.ts`** — adicionar roteamento:
```typescript
if (body.includes("minha_ferramenta_request")) return res.end(MEU_TOOL_REQUEST)
if (body.includes("<tool_result>") && body.includes("minha_ferramenta")) return res.end(MEU_TOOL_COMPLETION)
```

**3. No teste** — usar a keyword como trigger:
```typescript
await inputbox.fill("minha_ferramenta_request")
await sidebar.getByTestId("send-button").click()
await E2ETestHelper.waitForChatMessage(sidebar, "Tarefa concluída.", 60_000)
```

## ⚠️ Formato correto do `say()` para ferramentas
```typescript
// ✅ JSON com { tool, content } — ChatRow sabe renderizar
await say("tool", JSON.stringify({ tool: "nome_ferramenta", content: resultado }))
// ❌ String plana — waitForChatMessage nunca encontrará o texto
await say("tool", resultado)
```

## Checklist ao criar novo tool handler
- [ ] `say("tool", JSON.stringify({ tool, content }))` no handler
- [ ] Tool name na union `ClineSayTool.tool` em `src/shared/ExtensionMessage.ts`
- [ ] Case em `ChatRow.tsx` para renderizar output
- [ ] Parâmetros em `toolParamNames` em `src/core/assistant-message/index.ts`
- [ ] Mock response em `fixtures/server/api.ts` + roteamento em `index.ts`
- [ ] Teste em `src/test/e2e/`
- [ ] Build antes de rodar

## waitForChatMessage — Race Condition
Cuidado: `waitForChatMessage("texto")` é satisfeito quando o texto aparece em QUALQUER mensagem do chat, incluindo linhas de tool row durante execução. Para verificar que o TASK foi concluído, espere texto que só aparece na completion response (ex: texto do `MEU_TOOL_COMPLETION`), não texto que aparece durante a chamada da ferramenta.

## MockSshServer
```typescript
const sshServer = new MockSshServer()
e2e.beforeAll(async () => await sshServer.start(2222))
e2e.afterAll(async () => await sshServer.stop())

sshServer.acceptPassword("usuario", "senha")
sshServer.onExecute("ls /tmp", (ch) => { ch.write("file.txt\n"); ch.exit(0); ch.end() })
```
- Host key RSA pkcs1 gerado dinamicamente em cada `start()`
- `ssh2` importado via `await import("ssh2")` com `module.default ?? module` (CJS/ESM interop)
- `stop()` força encerramento de conexões ativas (evita timeout no teardown)

## Diagnóstico de Falhas
| Sintoma | Causa | Solução |
|---|---|---|
| `TypeError: X is not a constructor` | CJS/ESM mismatch em `await import()` | Usar `module.default ?? module` |
| `Cannot parse privateKey` | Formato errado | Usar `type: "pkcs1"` (não `pkcs8`) |
| `Worker teardown timeout` | Conexões ativas | Fechar clients antes do server |
| `waitForChatMessage timeout` | Texto não aparece | Verificar mock routes + `say()` format |
| `e2e.vsix` desatualizado | Build antigo | `ci:build` + `test:e2e:build` |
| ECONNRESET em testes SSH | Native .node binário incompatível com VS Code Node | ssh2 deve ser bundled (não external no esbuild) |

```powershell
Get-Content "test-results\.last-run.json" | ConvertFrom-Json | Format-List
npx playwright test --last-failed --reporter=list
Get-Content playwright-errors.txt | Select-Object -Last 50
$env:PWDEBUG=1; npx playwright test src/test/e2e/ssh.test.ts  # debug visual
```

## Referência Rápida
| Objetivo | Comando |
|---|---|
| Build completo | `npm run ci:build` |
| Empacotar E2E | `npm run test:e2e:build` |
| Só extensão | `node esbuild.mjs` |
| Rodar todos E2E | `npx playwright test --reporter=line` |
| Rodar últimos falhos | `npx playwright test --last-failed` |
| Ver resultado anterior | `Get-Content test-results\.last-run.json \| ConvertFrom-Json` |
| Snapshots unit | `UPDATE_SNAPSHOTS=true npm run test:unit` |
| Testes unitários | `npm run test:unit` |