# Researcher Skill

## Descrição
Esta skill permite que a IA pesquise na internet, agregue conhecimento, salve snippets de código, e monte uma base de conhecimento para uso futuro.

## Quando Usar
- Quando o usuário fazer perguntas que exigem pesquisa
- Para buscar documentação de APIs
- Para encontrar projetos no GitHub como referência
- Para agregar informações técnicas
- Para criar uma base de conhecimento

## Funcionalidades

### Pesquisa na Internet
- Buscar no Google/Bing
- Acessar documentação oficial
- Pesquisar no Stack Overflow
- Encontrar tutoriais

### Busca no GitHub
- Procurar repositórios por tema
- Analisar código de projetos
- Encontrar exemplos de implementação
- Verificar trending repositories

### Gestão de Conhecimento
- Salvar snippets de código
- Criar anotações técnicas
- Organizar por categorias
- Indexar para busca posterior

## Comandos
- `pesquisar` - Realiza pesquisa na internet
- `buscar github` - Procura repositórios
- `salvar conhecimento` - Armazena informação
- `buscar na base` - Procura em conhecimento salvo
- `adicionar snippet` - Salva pedaço de código

## Estrutura de Conhecimento

### Categorias
```
knowledge/
├── snippets/       # Snippets de código
├── docs/          # Documentação salva
├── research/      # Pesquisas realizadas
├── projects/     # Projetos interessantes
└── notes/        # Anotações gerais
```

### Formato de Snippet
```markdown
# Snippet: Nome

## Linguagem
typescript

## Descrição
Breve descrição

## Código
```typescript
// código aqui
```

## Tags
- categoria1
- categoria2

## Fonte
link da origem
```

## Exemplos

### Pesquisa
```
Usuário: "Como implementar autenticação JWT em Node.js?"
IA: Pesquisa e retorna resultado com fontes
```

### Busca GitHub
```
Usuário: "Busca projetos React com boas práticas"
IA: Lista repositórios relevantes
```

### Salvar Conhecimento
```
Usuário: "Salva essa função para uso futuro"
IA: Salva na base de conhecimento indexada
```

## Integrações
- Brave Search API
- GitHub API
- Ferramentas de busca web
- Banco de dados local (SQLite)
