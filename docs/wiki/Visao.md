# Visão do Projeto — NexusAI

> *"O computador não deveria ser apenas uma ferramenta que você usa.
> Ele deveria ser um parceiro que pensa com você."*

---

## O Problema que Estamos Resolvendo

Desenvolvedores modernos vivem em um paradoxo: nunca tivemos acesso a tanto poder computacional, mas ainda passamos horas em tarefas repetitivas — debugar logs, navegar em documentação, configurar ambientes, copiar código entre arquivos, lembrar a sintaxe exata de uma API que usamos uma vez seis meses atrás.

As ferramentas de IA generativa prometeram resolver isso. E em parte, resolveram. Mas ainda há uma lacuna enorme entre **"o assistente escreveu código para mim"** e **"o agente executou a tarefa por mim"**.

Essa lacuna é o que o NexusAI preenche.

---

## O que é o NexusAI

O NexusAI é um **agente de IA autônomo** integrado ao VS Code. Não é um autocomplete avançado. Não é um chatbot com janela lateral. É um agente que:

- **Lê e entende** sua base de código como um desenvolvedor sênior
- **Executa ações** — edita arquivos, roda comandos, navega na web
- **Toma decisões** — planeja antes de agir, pede confirmação quando necessário
- **Aprende com o contexto** — acumula conhecimento sobre seu projeto via skills e MCP

E vai muito além do código:

- **Fala com você** via voz local (sem cloud, sem latência, sem privacidade comprometida)
- **Controla computadores remotos** via SSH — execute tarefas em qualquer máquina da sua rede
- **Integra com dispositivos IoT** — controle sua casa, seu lab, sua fábrica

---

## A Filosofia

### 1. O Agente Deve Merecer Confiança

Um agente que age sem pedir confirmação é perigoso. Um agente que pede confirmação para tudo é inútil. O NexusAI segue o princípio do **mínimo impacto necessário**: age autonomamente nas tarefas seguras (ler arquivos, buscar informação) e pausa para confirmação nas tarefas destrutivas ou irreversíveis (deletar arquivos, executar comandos com sudo, fazer push de código).

### 2. Privacidade é Inegociável

O sistema de voz usa [Piper](https://github.com/rhasspy/piper) (TTS) e [Whisper](https://github.com/openai/whisper) (STT) rodando **100% localmente**. Nenhum áudio sai do seu computador. O mesmo vale para os modelos de IA: suporte a Ollama e modelos locais significa que você pode usar o NexusAI completamente offline, sem enviar nenhum dado para servidores externos.

### 3. Extensibilidade é um Cidadão de Primeira Classe

O NexusAI usa o [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) para integrar com ferramentas externas. Qualquer ferramenta, banco de dados, API ou sistema pode se tornar uma capacidade do agente. O ecossistema MCP já tem centenas de servidores — o NexusAI os usa todos.

### 4. A IA Não é o Produto — é a Plataforma

O NexusAI não está acoplado a nenhum modelo de IA. Suporta Anthropic Claude, Google Gemini, OpenAI, AWS Bedrock, Ollama, OpenRouter, e qualquer provider compatível com a interface OpenAI. **Você escolhe o modelo. O NexusAI fornece a inteligência de orquestração.**

---

## Para Quem é o NexusAI

### 🧑‍💻 Desenvolvedor Individual

Você quer um parceiro de programação que entende seu projeto, executa tarefas enquanto você toma café e não te interrompe a não ser quando realmente precisa de você.

### 🏠 Criador de Sistemas

Você tem Raspberry Pis, ESP32s, homelab, servidor NAS — e quer um agente que possa controlar tudo isso com uma instrução em linguagem natural.

### 🏢 Equipe de Desenvolvimento

Você quer padronizar como a equipe interage com IA — com rules personalizadas, skills de domínio, workflows documentados e um agente que segue as convenções do projeto.

### 🔬 Pesquisador / Cientista

Você precisa de um agente que pesquise, colete dados, escreva scripts de análise e documente resultados — tudo a partir de uma instrução de alto nível.

---

## A Visão de Longo Prazo

Hoje, o desenvolvedor diz ao NexusAI **o que** fazer. No futuro, o NexusAI entende **o que você quer alcançar** e descobre sozinho o que precisa fazer para chegar lá.

Imagine:

```
Você: "Quero automatizar o deploy do projeto Alfa toda vez que houver
       um PR mergeado para main."

NexusAI: analisa o repositório → descobre que é um projeto Node.js com
         Docker → pesquisa as melhores práticas de CI/CD para isso →
         escreve o GitHub Actions workflow → cria os secrets necessários →
         faz o PR → explica cada decisão
```

Isso não é ficção científica. É o que estamos construindo, peça por peça.

---

## O Caminho

```
Fase 1 ✅  →  Base sólida, identidade, auth simplificada
Fase 2 ⏳  →  Terminal e shell — o agente ganha mãos
Fase 3 ⏳  →  SSH — o agente alcança outros computadores
Fase 4 ⏳  →  Voz — o agente ganha voz e ouvidos
Fase 5 ⏳  →  IoT — o agente entra no mundo físico
```

Cada fase entrega valor real. Cada fase abre possibilidades para a próxima.

---

[← Home](Home.md) · [Arquitetura →](Arquitetura.md) · [Roadmap →](Roadmap.md)
