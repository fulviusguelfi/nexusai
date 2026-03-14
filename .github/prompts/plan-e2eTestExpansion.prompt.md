## Plan: E2E Test Expansion — Phase 2 + Phase 3

**TL;DR:** Criar 3 novos arquivos de teste, 1 novo fixture de mock SSH, e atualizar o mock server + helpers para cobrir as novas ferramentas de terminal (Fase 2) e SSH (Fase 3).

---

### Estado atual dos testes (13 passando, 1 skipped)

| Arquivo | Cobre |
|---|---|
| auth.test.ts | Onboarding BYOK, What's New modal |
| chat.test.ts | Envio/recebimento, mode switch, slash/@ autocomplete |
| diff.test.ts | `replace_in_file` → diff editor (single + multi-root) |
| editor.test.ts | Code action "Add to NexusAI" |
| cline-account.test.ts | Free-tier onboarding (skip condicional) |
| github.test.ts | Navegação onboarding Copilot |
| copilot-provider.test.ts | vscode-lm real (skip por env flag) |

Lacunas: **zero cobertura** para ferramentas de terminal, kill_process, checkpoint/retry e qualquer coisa SSH.

---

### Fase 2 — Novos Cenários

**Passo 1** — `src/test/e2e/terminal.test.ts` *(novo arquivo)*
1. `list_processes` → mock server retorna `PROCESS_LIST_REQUEST` keyword → chat exibe tabela de processos
2. `run_command` (longa duração) → chat mostra botão **"Proceed While Running"**
3. `kill_process` happy path → envia PID → mock confirma → chat exibe "process killed"
4. `kill_process` cross-platform → dois sub-cenários via parâmetro `platform: "win32" | "linux"` (parametrizado como `diff.test.ts` faz com workspace types)

**Passo 2** — `src/test/e2e/checkpoint.test.ts` *(novo arquivo)*
1. Mock server recebe 2 timeouts seguidos, depois 200 → verifica que NexusAI retentou com backoff e exibiu a resposta final
2. Mock retorna `"Invalid API Response"` → verifica botão de retry visível no chat

**Passo 3** — Atualizações em arquivos existentes *(paralelo com passos 1 e 2)*
- `src/test/e2e/fixtures/server/index.ts`: adicionar keywords `PROCESS_LIST_REQUEST`, `KILL_REQUEST`, `TIMEOUT_THEN_SUCCESS` com respostas mock correspondentes
- `src/test/e2e/utils/helpers.ts`: adicionar `waitForChatMessage(sidebar, text, timeout?)` — helper reutilizável para aguardar texto no chat (reduz boilerplate nos novos testes)
- `src/test/e2e/fixtures/workspace/`: adicionar `process-list-test.sh` como script de exemplo para o kill test

---

### Fase 3 — Novos Cenários SSH

**Passo 4** — `src/test/e2e/fixtures/ssh-server/index.ts` *(novo fixture — depende de nada)*
- Mock SSH server em-processo usando `ssh2` npm, porta `2222`
- Interface: `start()`, `stop()`, `acceptKey(publicKey)`, `acceptPassword(user, pass)`, `onExecute(command, handler)`
- Integrado ao fixture chain como `sshServer` (análogo a `server` no helpers.ts)

**Passo 5 — depende do Passo 4** — `src/test/e2e/ssh.test.ts` *(novo arquivo)*
1. `discover_network_hosts` → mock server retorna JSON com lista de hosts → UI exibe hosts
2. `ssh_connect` key auth → sshServer aceita chave pública → chat confirma "connected to..."
3. `ssh_connect` password auth → sshServer aceita senha → chat confirma
4. `ssh_execute` → comando na sessão ativa → mock retorna stdout → chat exibe saída
5. `ssh_upload` → arquivo local → mock confirma transferência → chat exibe "uploaded"
6. `ssh_download` → path remoto → mock retorna conteúdo → verifica arquivo criado localmente
7. `ssh_disconnect` → fecha sessão → `ssh_execute` subsequente falha gracefully com erro amigável
8. *(skip sem env flag)* `SSH_CONNECT_REAL=true` → testa localhost com credenciais reais

---

### Arquivos a criar/modificar

- `src/test/e2e/terminal.test.ts` — NOVO
- `src/test/e2e/checkpoint.test.ts` — NOVO
- `src/test/e2e/ssh.test.ts` — NOVO *(depende do fixture ssh-server)*
- `src/test/e2e/fixtures/ssh-server/index.ts` — NOVO
- `src/test/e2e/fixtures/server/index.ts` — MODIFICAR (+3 keywords)
- `src/test/e2e/utils/helpers.ts` — MODIFICAR (+1 helper)
- `src/test/e2e/fixtures/workspace/process-list-test.sh` — NOVO

---

### Verificação

1. `npx playwright test terminal --project="e2e tests"` → todos passando
2. `npx playwright test checkpoint --project="e2e tests"` → todos passando
3. `npx playwright test ssh --project="e2e tests"` → cenários 1–7 passando; cenário 8 skipped sem env flag
4. `npx playwright test --project="e2e tests"` → suite completa, sem regressão nos 13 testes existentes

---

### Decisões / Escopo

- **Incluído**: terminal tools (Fase 2), checkpoint/retry (Fase 2 debt #18), SSH tools 1–7 (Fase 3)
- **Excluído**: IoT, TTS/STT, Task.ts refactors (#6–#10) — não são Fase 2/3
- **Dependência de ordem**: Passo 4 (ssh-server fixture) deve ser implementado antes do Passo 5 (ssh.test.ts). Os demais passos são independentes entre si.
- **ssh2 npm** já está na arquitetura decidida — reutilizar para o mock server do fixture também.
