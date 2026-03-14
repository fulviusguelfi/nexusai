# Fase 3 — SSH e Descoberta de Rede ✅

> **Status**: Concluída em `2026-03-13`
> **Branch**: `feat/fase-3-ssh` → PR [#20](https://github.com/fulviusguelfi/nexusai/issues/20) para `develop`

A Fase 3 entregou controle remoto via SSH com 6 ferramentas novas, MockSshServer para E2E, correção de interop ESM/CJS e cobertura completa de testes.

---

## Sumário

- [Ferramentas Implementadas](#ferramentas-implementadas)
- [Arquitetura SSH](#arquitetura-ssh)
- [Correções de Bug](#correções-de-bug)
- [Testes E2E](#testes-e2e)
- [Skill Criada](#skill-criada)
- [Issues Relacionados](#issues-relacionados)
- [Pendências Registradas](#pendências-registradas)

---

## Ferramentas Implementadas

| Ferramenta | Handler | Descrição |
|---|---|---|
| `discover_network_hosts` | `DiscoverNetworkHostsToolHandler` | Lista hosts na rede local via ARP |
| `ssh_connect` | `SshConnectToolHandler` | Abre sessão SSH (password ou private key) |
| `ssh_execute` | `SshExecuteToolHandler` | Executa comando remoto e retorna stdout |
| `ssh_upload` | `SshUploadToolHandler` | Envia arquivo via SFTP |
| `ssh_download` | `SshDownloadToolHandler` | Baixa arquivo via SFTP |
| `ssh_disconnect` | `SshDisconnectToolHandler` | Encerra sessão e limpa SshSessionRegistry |

Todas seguem o padrão: `say("tool", JSON.stringify({ tool: "nome_ferramenta", content: resultado }))`.

---

## Arquitetura SSH

### SshSessionRegistry

`src/services/ssh/SshSessionRegistry.ts` — singleton com escopo por `taskId`.

```typescript
SshSessionRegistry.getInstance().set(taskId, sessionId, client)
SshSessionRegistry.getInstance().get(taskId, sessionId)
SshSessionRegistry.getInstance().delete(taskId, sessionId)
```

Sessions são criadas em `ssh_connect` e destruídas em `ssh_disconnect` ou no fim da task.

---

## Correções de Bug

### ESM/CJS Interop — `ssh2` dynamic import

`await import('ssh2')` retorna namespace com classes em `.default` (CJS via ESM wrapper). Sem o padrão correto, `new ssh2.Client()` e `new ssh2.Server()` são `undefined`.

```typescript
// ✅ Padrão correto para todo dynamic import de CJS
const ssh2Module = await import("ssh2")
const ssh2 = ssh2Module.default ?? ssh2Module
```

Documentado em `skills/playwright-e2e.md` e issue #22.

### Formato de chave SSH para `ssh2.Server`

`generateKeyPairSync` com `{ type: 'pkcs8' }` gera chave no formato não aceito pelo ssh2. Usar `{ type: 'pkcs1' }`.

```typescript
// ✅
privateKey.export({ type: "pkcs1", format: "pem" })
```

### Bundling: ssh2 como dependência integrada

O comando `node esbuild.mjs` deve incluir `ssh2` no bundle (não como `external`). Se ssh2 for marcado como external, o VS Code tenta carregar binários nativos compilados para Node.js do sistema, causando ECONNRESET. Controle via `nativeNodePlugin` que externaliza apenas arquivos `.node`.

---

## Testes E2E

### MockSshServer

`src/test/e2e/fixtures/ssh-server/index.ts`

```typescript
const sshServer = new MockSshServer()
e2e.beforeAll(async () => await sshServer.start(2222))
e2e.afterAll(async () => await sshServer.stop())

sshServer.acceptPassword("usuario", "senha")
sshServer.onExecute("ls /tmp", (ch) => { ch.write("file.txt\n"); ch.exit(0); ch.end() })
```

`stop()` force-fecha conexões ativas para evitar `Worker teardown timeout`.

### Cenários cobertos em `ssh.test.ts`

| # | Cenário |
|---|---|
| 1 | `discover_network_hosts` — retorna lista de IPs |
| 2 | `ssh_connect` com password |
| 3 | `ssh_execute` — retorna stdout do comando |
| 4 | `ssh_disconnect` — encerra sessão |
| 5 | `ssh_upload` — envia arquivo via SFTP |
| 6 | `ssh_download` — baixa arquivo via SFTP |
| 7 | `ssh_connect` com private key inline |

Todos os 7 cenários ativos (sem `.skip`). Suite completa: **26 testes, Exit Code: 0**.

---

## Skill Criada

`skills/playwright-e2e.md` — skill de IA com ciclo de vida completo dos testes E2E:
- Pipeline de build obrigatório
- Padrão de mock LLM server (3 passos)
- Formato correto de `say()` + checklist de novo tool handler
- Race condition em `waitForChatMessage`
- API do `MockSshServer`
- Tabela de diagnóstico de falhas
- Quick reference de comandos

---

## Issues Relacionados

| Issue | Tipo | Status |
|---|---|---|
| [#20](https://github.com/fulviusguelfi/nexusai/issues/20) | feat — SSH handlers + E2E | ✅ Fechado |
| [#21](https://github.com/fulviusguelfi/nexusai/issues/21) | docs — skills/playwright-e2e.md | ✅ Fechado |
| [#22](https://github.com/fulviusguelfi/nexusai/issues/22) | bug — ESM/CJS interop + pkcs1 | ✅ Fechado |

---

## Pendências Registradas

| Issue | Título | Fase Prevista |
|---|---|---|
| [#18](https://github.com/fulviusguelfi/nexusai/issues/18) | Invalid API Response loop + Checkpoint timeout | Tech Debt |
| [#15](https://github.com/fulviusguelfi/nexusai/issues/15) | kill_process cross-platform (Linux/macOS) | Bug |
| [#13](https://github.com/fulviusguelfi/nexusai/issues/13) | Unit tests para MultiRootCheckpointManager | Tech Debt |
| [#12](https://github.com/fulviusguelfi/nexusai/issues/12) | Lazy-init CheckpointManager | Tech Debt |
| [#11](https://github.com/fulviusguelfi/nexusai/issues/11) | Interface ICheckpointManager | Tech Debt |
| [#10](https://github.com/fulviusguelfi/nexusai/issues/10) | Extract TaskRunner de Task.ts | Refactoring |
| [#9](https://github.com/fulviusguelfi/nexusai/issues/9) | Extract PresentationLayer de Task.ts | Refactoring |
| [#8](https://github.com/fulviusguelfi/nexusai/issues/8) | Extract ContextCompactor de Task.ts | Refactoring |
| [#7](https://github.com/fulviusguelfi/nexusai/issues/7) | Extract NativeToolCallProcessor de Task.ts | Refactoring |
| [#6](https://github.com/fulviusguelfi/nexusai/issues/6) | Extract EnvironmentDetailsService de Task.ts | Refactoring |
| SSH webview | Exibir sessão SSH ativa na interface | Fase 3.1 ou 4 |
