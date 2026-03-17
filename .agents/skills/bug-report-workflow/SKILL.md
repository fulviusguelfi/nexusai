---
name: bug-report-workflow
description: |
  Guardião dos bugs de uso da extensão NexusAI. Use este skill para:
  1. Registrar um novo bug reportado pelo usuário (diagnóstico → issue → fix → close)
  2. Revisar o estado atual de todos os bugs de uso abertos (triagem periódica)
  3. Cobrar testes pendentes do usuário (issues marcados como aguardando:teste-usuario)
  Requer: `gh` CLI autenticado.
---

# Bug Report Workflow — Guardião de Bugs de Uso

Este skill tem dois modos de operação:

| Situação | Modo a usar |
|---|---|
| Usuário reportou um bug durante o uso | **Modo A — Registrar novo bug** |
| Revisão periódica / triagem de issues | **Modo B — Revisar bugs abertos** |

---

## Identificação do tipo de bug

Bugs de **uso da extensão** (`bug:uso-extensao`) são os que o usuário encontra ao usar a extensão em situação real:
- UI se comporta de forma inesperada (dropdowns, listas, configurações)
- Requisições ao LLM falham silenciosamente
- Configurações não são salvas ou aplicadas corretamente
- Integrações com VS Code (vscode-lm, terminal, etc.) quebram em casos reais

Bugs de **código interno** (lógica de tools, prompts, protobuf, esbuild) **não** seguem este workflow — são tratados diretamente no branch de desenvolvimento.

---

## Prerequisites

```bash
gh --version       # gh CLI instalado
gh auth status     # autenticado
git remote get-url origin  # confirmar repo
```

---

# MODO A — Registrar novo bug

## A1 — Garantir labels necessárias

```bash
gh label create "bug:uso-extensao" \
  --color "#e11d48" \
  --description "Bug no comportamento da extensao em uso real" \
  --repo fulviusguelfi/nexusai

gh label create "aguardando:teste-usuario" \
  --color "#0e8a16" \
  --description "Fix implementado, aguardando confirmacao do usuario que reportou o bug" \
  --repo fulviusguelfi/nexusai
```

Erros por label já existente podem ser ignorados.

---

## A2 — Criar o issue

```bash
gh issue create \
  --repo fulviusguelfi/nexusai \
  --title "[BUG] <descrição curta e objetiva>" \
  --label "bug,bug:uso-extensao" \
  --body-file "$env:TEMP\issue_body.md"
```

**Template do corpo** (salvar em `$env:TEMP\issue_body.md`):

```markdown
## Descrição

<Comportamento observado vs. esperado.>

## Como reproduzir

1. <passo 1>
2. <passo 2>
3. <resultado observado>

## Diagnóstico técnico

<Arquivos, linhas, causa raiz.>

## Impacto

<Severidade, frequência, workaround disponível.>

## Plano de correção

- [ ] <tarefa 1>
- [ ] <tarefa 2>

## Contexto adicional

<Logs, screenshots, versões.>
```

---

## A3 — Implementar o fix

- Implemente o fix no código
- Use `manage_todo_list` para rastrear cada subtarefa
- Após cada etapa, comente no issue:

```bash
gh issue comment <NUMBER> \
  --repo fulviusguelfi/nexusai \
  --body-file "$env:TEMP\issue_comment.md"
```

---

## A4 — Marcar como aguardando teste

Após o fix implementado:

```bash
gh issue edit <NUMBER> \
  --repo fulviusguelfi/nexusai \
  --add-label "aguardando:teste-usuario"
```

Avise o usuário explicitamente:
> "O fix foi implementado. Para fechar o issue #N, preciso que você teste [descrição do que testar] e confirme que o problema foi resolvido."

---

## A5 — Fechar o issue (após confirmação)

```bash
# Remover label de pendência
gh issue edit <NUMBER> \
  --repo fulviusguelfi/nexusai \
  --remove-label "aguardando:teste-usuario"

# Fechar com comentário
gh issue close <NUMBER> \
  --repo fulviusguelfi/nexusai \
  --comment "Fix confirmado pelo usuário. Fechando."
```

---

# MODO B — Revisar bugs abertos (triagem periódica)

Use este modo sempre que o usuário pedir para "revisar issues", "ver o que está pendente", "organizar prioridades" ou similar.

## B1 — Listar todos os bugs de uso abertos

```bash
gh issue list \
  --repo fulviusguelfi/nexusai \
  --label "bug:uso-extensao" \
  --state open \
  --json number,title,labels,createdAt,updatedAt \
  --jq '.[] | {number, title, labels: [.labels[].name], createdAt, updatedAt}'
```

## B2 — Separar bugs aguardando teste do usuário

```bash
gh issue list \
  --repo fulviusguelfi/nexusai \
  --label "bug:uso-extensao,aguardando:teste-usuario" \
  --state open \
  --json number,title,updatedAt \
  --jq '.[] | "#\(.number) — \(.title) (atualizado: \(.updatedAt[:10]))"'
```

Após executar, apresente ao usuário **uma lista clara** no seguinte formato:

---

> ### 🟡 Bugs aguardando o seu teste
>
> Os seguintes bugs foram corrigidos mas ainda aguardam confirmação:
>
> | # | Título | Corrigido em |
> |---|---|---|
> | #31 | [BUG] VSCodeLmProvider: dropdown... | 2026-03-15 |
>
> **Por favor, teste cada item acima e me confirme:**
> - ✅ "Confirmado, funcionou" → fecho o issue
> - ❌ "Ainda acontece" → reabrimos o diagnóstico

---

## B3 — Classificar os demais bugs abertos

Para os bugs sem `aguardando:teste-usuario`, classifique por prioridade e apresente ao usuário:

```bash
gh issue list \
  --repo fulviusguelfi/nexusai \
  --label "bug:uso-extensao" \
  --state open \
  --json number,title,labels \
  --jq '.[] | select(.labels | map(.name) | contains(["aguardando:teste-usuario"]) | not) | "#\(.number) — \(.title)"'
```

Categorias de prioridade sugeridas:
- **Alta** — bloqueia uso normal da extensão
- **Média** — comportamento incorreto com workaround disponível
- **Baixa** — cosmético ou edge case raro

Pergunte ao usuário se quer iniciar o fix de algum deles na sessão atual.

---

## B4 — Verificar bugs "esquecidos" (sem atualização há >7 dias)

```bash
gh issue list \
  --repo fulviusguelfi/nexusai \
  --label "bug:uso-extensao" \
  --state open \
  --json number,title,updatedAt \
  --jq --arg cutoff (Get-Date).AddDays(-7).ToString("yyyy-MM-ddTHH:mm:ssZ") \
  '.[] | select(.updatedAt < $cutoff) | "#\(.number) — \(.title) (sem atualização desde \(.updatedAt[:10]))"'
```

Se houver issues parados, alerte o usuário e proponha retomar ou fechar como `wontfix`.

---

# Convenções

| Campo | Valor |
|---|---|
| Label de categoria | `bug:uso-extensao` — cor `#e11d48` |
| Label de estado | `aguardando:teste-usuario` — cor `#0e8a16` |
| Label adicional | `bug` (padrão GitHub) |
| Prefixo do título | `[BUG]` |
| Repo | `fulviusguelfi/nexusai` |

## Ciclo de vida de um issue

```
[aberto] bug:uso-extensao
    → fix em andamento    (comentários de progresso)
    → aguardando:teste-usuario  (fix entregue)
    → [fechado]           (confirmado pelo usuário)
    ↘ [fechado wontfix]   (decidido não corrigir)
```

---

# Exemplo de uso — Modo A

Usuário reporta que o dropdown de modelos mostra modelos de outros providers:
1. Diagnóstico → identificar arquivo e causa raiz
2. A1: garantir labels → A2: criar issue → A3: implementar fix
3. A4: marcar `aguardando:teste-usuario` + avisar usuário
4. Usuário testa e confirma → A5: fechar

# Exemplo de uso — Modo B

Durante a revisão do projeto, o usuário pede "vamos ver os bugs pendentes":
1. B1: listar todos os bugs de uso abertos
2. B2: separar os que aguardam teste → apresentar lista ao usuário pedindo confirmação
3. B3: classificar os restantes por prioridade → propor qual atacar
4. B4: alertar sobre bugs parados há mais de 7 dias
