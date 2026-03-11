# Cronograma de Desenvolvimento - NexusAI

## Visão Geral do Release 1.0

Este documento detalha o cronograma de desenvolvimento para a versão 1.0 do NexusAI.

---

## Fases de Desenvolvimento

### Fase 1: Fundação ⚙️
**Objetivo**: Preparar a estrutura base do projeto

| Tarefa | Descrição | Status |
|--------|-----------|--------|
| 1.1 | Criar repositório GitHub | ✅ Concluído |
| 1.2 | Configurar branches (master, develop) | ✅ Concluído |
| 1.3 | Renomear projeto para NexusAI | ⏳ Pendente |
| 1.4 | Atualizar identidade visual (ícones, nome) | ⏳ Pendente |
| 1.5 | Configurar autores e licença | ⏳ Pendente |
| 1.6 | Criar documentos do projeto | ⏳ Pendente |

### Fase 2: Controle Local 🖥️
**Objetivo**: Terminal local e comandos shell

| Tarefa | Descrição | Status |
|--------|-----------|--------|
| 2.1 | Adaptar terminal do Cline | ⏳ Pendente |
| 2.2 | Comandos shell básicos | ⏳ Pendente |
| 2.3 | Gerenciamento de processos | ⏳ Pendente |

### Fase 3: Conexão SSH 🔐
**Objetivo**: Controlar computadores remotos

| Tarefa | Descrição | Status |
|--------|-----------|--------|
| 3.1 | Descoberta de máquinas na rede | ⏳ Pendente |
| 3.2 | Implementar cliente SSH | ⏳ Pendente |
| 3.3 | Execução remota de comandos | ⏳ Pendente |
| 3.4 | Gerenciamento de conexões | ⏳ Pendente |

### Fase 4: Voz (TTS/STT) 🎙️
**Objetivo**: Sistema de voz local

| Tarefa | Descrição | Status |
|--------|-----------|--------|
| 4.1 | Integrar Piper (TTS) | ⏳ Pendente |
| 4.2 | Integrar Whisper (STT) | ⏳ Pendente |
| 4.3 | Avatar interativo | ⏳ Pendente |
| 4.4 | Sistema de detecção de locutor | ⏳ Pendente |
| 4.5 | Personalidade do avatar | ⏳ Pendente |

### Fase 5: IoT 📡
**Objetivo**: Controle de dispositivos na rede

| Tarefa | Descrição | Status |
|--------|-----------|--------|
| 5.1 | Descoberta de dispositivos | ⏳ Pendente |
| 5.2 | Protocolo MQTT | ⏳ Pendente |
| 5.3 | Protocolo HTTP | ⏳ Pendente |
| 5.4 | Protocolo WebSocket | ⏳ Pendente |
| 5.5 | Interface de controle IoT | ⏳ Pendente |

---

## Marco de Releases

### Release 1.0.0 - Alpha
- Projeto renomeado para NexusAI
- Estrutura base configurada
- Primeiros documentos

### Release 1.0.0 - Beta
- Terminal local funcionando
- SSH básico implementado
- Primeiras skills

### Release 1.0.0 - RC (Release Candidate)
- Voz integrada (Piper + Whisper)
- IoT básico funcionando
- Skills principais criadas

### Release 1.0.0 - Stable
- Todas as funcionalidades da v1.0
- Documentação completa
- Testes unitários

---

## Critérios de Aceitação

Para cada fase ser considerada concluída:

1. ✅ Código implementado
2. ✅ Testes básicos passando
3. ✅ Documentação atualizada
4. ✅ PR mergeado para develop

---

## Notas

- O standalone (versão desktop) não está no cronograma da v1.0
- Prioridades podem ser ajustadas conforme feedback
- Cada feature deve ser pequena e entregar valor

---

## Referência

- **Repositório**: https://github.com/fulviusguelfi/nexusai
- **Branch Master**: Releases estáveis
- **Branch Develop**: Integração contínua
- **Feature Branches**: `feat/nome-da-feature`
