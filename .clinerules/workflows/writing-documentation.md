# Documentação — Guia NexusAI

## Princípios
- Títulos: orientados ao objetivo do leitor ("Como conectar via SSH" > "SSH Connection Feature")
- Sem adjetivos vagos — use evidências: "executa em <100ms" > "rápido"
- Exemplos de código: mínimos, funcionais, com comentários só onde não é óbvio
- Foco: uma coisa por doc; não misture guia e referência

## Estrutura preferida
1. O que isso faz (1 frase)
2. Pré-requisitos / quando usar
3. Passos ou referência
4. Exemplos

## Para docs de tools/features NexusAI
- Referencie arquivos reais: `src/core/task/tools/handlers/SshConnectToolHandler.ts`
- Parâmetros obrigatórios vs. opcionais claramente separados
- Inclua o comportamento de erro esperado