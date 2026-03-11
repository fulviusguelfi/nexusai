# Planner Skill

## Descrição
Esta skill permite que o NexusAI planeje soluções complexas, dividindo tarefas em passos gerenciáveis, estimando tempo e recursos, e criando roadmap de execução.

## Quando Usar
- Quando o usuário pedir para planejar algo
- Para projetos grandes que precisam de decomposition
- Antes de executar tarefas complexas
- Para estimar prazos e recursos
- Para identificar dependências

## Funcionalidades

### Planejamento Estratégico
- Análise de requisitos
- Decomposição de tarefas
- Identificação de dependências
- Estimativa de esforço
- Gestão de riscos

### Gestão de Projeto
- Criação de milestones
- Definição de prioridades
- Alocação de recursos
- Cronograma
- Checklist de execução

### Tomada de Decisão
- Análise de prós e contras
- Comparação de alternativas
- Recomendação baseada em critérios
- Plano de contingência

## Comandos
- `planejar` - Cria plano detalhado
- `decompor` - Divide tarefa em partes
- `estimar` - Estima tempo/esforço
- `priorizar` - Organiza por prioridade
- `revisar plano` - Revisa plano existente

## Estrutura de Plano

### Template
```markdown
# Plano: [Nome do Projeto]

## Objetivo
[Descrição clara do objetivo]

## Escopo
### Inclui
- Item 1
- Item 2

### Não Inclui
- Item 1
- Item 2

## Tarefas
### Fase 1: [Nome]
- [ ] Tarefa 1
- [ ] Tarefa 2

### Fase 2: [Nome]
- [ ] Tarefa 3
- [ ] Tarefa 4

## Dependências
- Tarefa 2 depende de Tarefa 1
- Tarefa 4 depende de Tarefa 3

## Recursos Necessários
- Recurso 1
- Recurso 2

## Estimativa de Tempo
- Fase 1: X dias
- Fase 2: Y dias

## Riscos
| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Risco 1 | Alto | Ação preventiva |

## Critérios de Sucesso
- Critério 1
- Critério 2
```

## Exemplos

### Planejar Projeto
```
Usuário: "Preciso criar um app de tarefas"
IA: Cria plano completo com tarefas, cronograma, recursos
```

### Decompor Tarefa
```
Usuário: "Refatorar o código do login"
IA: Divide em: analisar código, identificar issues, implementar, testar
```

### Estimar Esforço
```
Usuário: "Quanto tempo para implementar login social?"
IA: Estima baseado em complexidade, dependencias, experiencia
```

## Integrações
- Ferramentas de项目管理 (Jira, Trello)
- GitHub Projects
- Notion
- Ferramentas de análise de código
