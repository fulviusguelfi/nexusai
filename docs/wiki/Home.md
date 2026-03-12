# NexusAI — Documentação do Projeto

> **NexusAI** é uma extensão para VS Code que transforma o editor em um agente de IA autônomo, capaz de escrever código, controlar computadores remotos via SSH, interagir por voz e integrar dispositivos IoT.
>
> É baseado no [Cline](https://github.com/cline/cline) (Apache-2.0) e expande suas capacidades com uma identidade própria e funcionalidades avançadas.

---

## Por que NexusAI?

O Cline já é um dos melhores agentes de IA para VS Code. O NexusAI parte dessa base sólida e adiciona:

- 🔐 **Autenticação simplificada** via GitHub Copilot — sem precisar cadastrar chave de API
- 🎙️ **Voz local** (planejado) — fale com o agente e ouça as respostas usando Piper e Whisper
- 🖥️ **Controle de computadores** (planejado) — execute comandos em máquinas remotas via SSH
- 📡 **IoT** (planejado) — controle dispositivos na sua rede local
- 🤖 **Múltiplos modos** — ACT, PLAN, ASK e JUST CHAT

---

## Status Atual

| Fase | Descrição | Status |
| ---- | --------- | ------ |
| **Fase 1** | Fundação — estrutura, identidade, auth GitHub Copilot | ✅ Concluída |
| **Fase 2** | Controle Local — terminal e shell | ⏳ Planejada |
| **Fase 3** | Conexão SSH — controle remoto | ⏳ Planejada |
| **Fase 4** | Voz (TTS/STT) — Piper + Whisper | ⏳ Planejada |
| **Fase 5** | IoT — MQTT, HTTP, WebSocket | ⏳ Planejada |

**Versão atual**: `1.0.0-alpha` · **Branch estável**: `master` · **Branch de integração**: `develop`

---

## Documentação

### Por onde começar

- [Visão do Projeto](Visao.md) — por que o NexusAI existe, a filosofia e o futuro
- [Arquitetura](Arquitetura.md) — como funciona por dentro: fluxo de dados, protobuf, webview, tools
- [Contribuindo](Contribuindo.md) — setup do ambiente, padrões de código, como abrir PRs

### O que já foi feito

- [Fase 1 — Fundação](Fase-1-Fundacao.md) — identidade, estrutura, auth GitHub Copilot — tudo detalhado

### O que vem a seguir

- [Roadmap](Roadmap.md) — Fases 2–5: terminal, SSH, voz, IoT

---

## Início Rápido

### Usando o NexusAI

1. Instale a extensão no VS Code (publisher: `fulviusguelfi`)
2. Abra a Activity Bar — clique no ícone do NexusAI
3. Na tela de boas-vindas, clique em **Connect GitHub Copilot**
4. Autorize no browser e volte ao VS Code — pronto!

### Desenvolvendo

```bash
git clone https://github.com/fulviusguelfi/nexusai.git
cd nexusai
npm install
npm run protos      # gera código dos .proto
npm run watch       # compila extensão + webview em watch mode
# F5 no VS Code para abrir Extension Development Host
```

> Veja [Contribuindo](Contribuindo.md) para um guia completo.

---

## Links

- [Repositório](https://github.com/fulviusguelfi/nexusai)
- [Issues e Bug Reports](https://github.com/fulviusguelfi/nexusai/issues)
- [Pull Requests](https://github.com/fulviusguelfi/nexusai/pulls)
- [Changelog](../../CHANGELOG.md)
- [Licença (Apache-2.0)](../../LICENSE)
