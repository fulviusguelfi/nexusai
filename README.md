# NexusAI

NexusAI e uma extensao de IA para VS Code baseada no projeto Cline, evoluida para um roadmap proprio com foco em automacao de desenvolvimento, controle local e expansao para voz, SSH e IoT.

## Status

- Versao: `1.0.0-alpha`
- Branch principal de integracao: `develop`
- Fase atual: `Fase 1 - Fundacao`

## Objetivos da v1.0

1. Assistente de IA para tarefas de desenvolvimento no VS Code
2. Planejamento e execucao em modos dedicados (ACT, PLAN, ASK, JUST CHAT)
3. Base pronta para recursos futuros de voz local, SSH e IoT

## Roadmap resumido

- Fase 1: Fundacao (renomeacao, identidade, autores/licenca, documentacao)
- Fase 2: Controle local (terminal e processos)
- Fase 3: Conexao SSH
- Fase 4: Voz (TTS/STT)
- Fase 5: IoT

Detalhes completos em:
- `PLAN.md`
- `ROADMAP.md`
- `docs/CRONOGRAMA.md`

## Desenvolvimento

### Requisitos

- Node.js (conforme `package.json`)
- npm
- VS Code

### Comandos principais

```bash
npm install
npm run compile
npm run test:unit
```

Notas importantes do projeto:
- Build principal: `npm run compile`
- Apos alterar arquivos `.proto`, execute: `npm run protos`

## Estrutura

- `src/`: backend da extensao
- `webview-ui/`: frontend (React/Vite)
- `cli/`: interface de linha de comando
- `proto/`: contratos Protobuf
- `docs/`: documentacao
- `skills/`: skills e materiais de apoio

## Contribuicao

Fluxo de branches:
- `master`: releases estaveis
- `develop`: integracao continua
- `feat/*`: novas funcionalidades

Padrao de commit:
- `feat: ...`
- `fix: ...`
- `docs: ...`
- `refactor: ...`
- `test: ...`

## Base do projeto

Este repositorio deriva do Cline e preserva sua base tecnica. As atribuicoes e termos de licenciamento atuais devem ser respeitados enquanto a estrategia final de licenca do NexusAI e consolidada.

## Repositorio

- GitHub: https://github.com/fulviusguelfi/nexusai
