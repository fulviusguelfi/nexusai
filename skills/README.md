# NexusAI Skills

Este diretório contém as skills (habilidades) do NexusAI que definem o comportamento e capacidades da IA em diferentes contextos.

## Índice de Skills

| Skill | Descrição | Status |
|-------|-----------|--------|
| [developer.md](developer.md) | Conhecimento de desenvolvimento de software | ✅ Base |
| [researcher.md](researcher.md) | Pesquisa e gestão de conhecimento | ✅ Base |
| [network.md](network.md) | Conexões SSH e gerenciamento de rede | ✅ Base |
| [iot.md](iot.md) | Controle de dispositivos IoT | ✅ Base |
| [voice.md](voice.md) | Sistema de voz (TTS/STT) e avatar | ✅ Base |
| [planner.md](planner.md) | Planejamento estratégico | ✅ Base |

## O que são Skills?

Skills são documentos que definem:
- **O que a IA sabe** - Conhecimento técnico
- **O que a IA pode fazer** - Funcionalidades
- **Quando usar** - Contexto apropriado
- **Como executar** - Comandos e procedimentos

## Estrutura de Cada Skill

Cada skill segue o seguinte formato:

```markdown
# Nome da Skill

## Descrição
...

## Quando Usar
...

## Funcionalidades
...

## Comandos
...

## Exemplos
...

## Integrações
...
```

## Adicionando Novas Skills

Para adicionar uma nova skill:

1. Crie um arquivo `.md` na pasta `skills/`
2. Siga o template acima
3. Adicione ao índice neste README
4. Atualize a documentação do projeto

## Modes de Operação

As skills são usadas em conjunto com os modos de operação:

- **ACT**: developer, network, iot, voice
- **PLAN**: planner
- **ASK**: researcher
- **JUST CHAT**: Todas as skills combinadas

## Uso

As skills são carregadas pelo sistema de IA conforme necessário, baseando-se no contexto da conversa e no modo de operação ativo.

---

**Nota**: Este projeto usa habilidades de IA para extender suas capacidades. As skills são referência para comportamento, não execução direta de código.
