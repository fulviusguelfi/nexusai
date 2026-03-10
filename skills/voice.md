# Voice Skill

## Descrição
Esta skill gerencia o sistema de voz do NexusAI, incluindo TTS (Text-to-Speech) usando Piper e STT (Speech-to-Text) usando Whisper, além do avatar interativo com personalidade.

## Quando Usar
- Quando o usuário interagir por voz
- Para ativar/desativar resposta de voz
- Para configurar a voz do avatar
- Para definir personalidade do assistente

## Funcionalidades

### TTS - Text-to-Speech
- **Piper**: Voz neural local de alta qualidade
- Múltiplas vozes disponíveis
- Ajuste de velocidade e tom
- Suporte a múltiplos idiomas

### STT - Speech-to-Text
- **Whisper**: Reconhecimento de fala local
- Suporte a diversos idiomas
- Reconhecimento em tempo real
- Punctuação automática

### Avatar Interativo
- Animação visual同步 com fala
- Expressões faciais
- Indicador de escuta
- Feedback visual de processamento

### Detecção de Locutor
⚠️ **IMPORTANTE**: O sistema deve distinguir entre:
- Voz do usuário
- Voz da IA (TTS)
- Ruídos ambiente

O sistema NUNCA deve responder à própria voz.

## Comandos de Voz
- `ativar voz` - Liga resposta de voz
- `desativar voz` - Desliga resposta de voz
- `mudar voz` - Altera voz do TTS
- `ajustar velocidade` - Muda velocidade da fala
- `configurar avatar` - Personaliza aparência

## Configuração de Voz

### Piper
```json
{
  "tts": {
    "engine": "piper",
    "voice": "en_US-lessac-medium",
    "speed": 1.0,
    "pitch": 1.0,
    "volume": 1.0
  }
}
```

### Whisper
```json
{
  "stt": {
    "engine": "whisper",
    "model": "base",
    "language": "pt",
    "translate": false
  }
}
```

## Personalidade do Avatar

### Atributos de Personalidade
- **Nome**: Nome do avatar
- **Tom de voz**: Formal, casual, técnico
- **Emojis**: Uso de emojis nas respostas
- **Reações**: Como responde a comandos
- **Humor**: Sério, engraçado, neutro

### Exemplo de Personalidade
```json
{
  "avatar": {
    "nome": "Nexus",
    "tom": "casual",
    "usaEmoji": true,
    "humor": "amigavel"
  }
}
```

## Fluxo de Conversa por Voz

```
1. Usuário fala (Whisper captura)
   ↓
2. Sistema identifica que é voz do usuário (não IA)
   ↓
3. Processa comando/pedido
   ↓
4. Gera resposta em texto
   ↓
5. Converte para áudio (Piper)
   ↓
6. Avatar reproduz animação
   ↓
7. Detecção de locutor ignora saída de áudio
```

## Integrações
- Piper TTS
- Whisper STT
- Libraries de animação (Lottie, etc.)
- APIs de detecção de voz

## Notas Importantes

⚠️ **Prevenção de Loop**:
- O sistema detecta quando está "ouvindo" a própria voz
- Usa VAD (Voice Activity Detection) para filtrar
- Implementa timeout para evitar eco
- Não responde a comandos do próprio TTS
