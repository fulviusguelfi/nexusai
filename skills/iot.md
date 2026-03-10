# IoT Skill

## Descrição
Esta skill permite o controle de dispositivos IoT na rede local, incluindo descoberta automática, comunicação via múltiplos protocolos, e gerenciamento de dispositivos inteligentes.

## Quando Usar
- Quando o usuário precisar controlar dispositivos IoT
- Para descobrir novos dispositivos na rede
- Para integrar com automação residencial
- Para monitorar sensores
- Para controlar luzes, tomadas, termostatos, etc.

## Funcionalidades

### Descoberta de Dispositivos
- mDNS/Bonjour discovery
- Varredura de rede
- SSDP/UPnP
- Bluetooth LE scanning
- Zigbee/Z-Wave (via hub)

### Protocolos de Comunicação
- **MQTT**: Pub/Sub para IoT
- **HTTP/REST**: API web
- **WebSocket**: Comunicação em tempo real
- **CoAP**: Protocolo leve para IoT
- **Modbus**: Automação industrial

### Tipos de Dispositivos Suportados
- Luzes inteligentes (Philips Hue, LIFX, etc.)
- Tomadas conectadas
- Termostatos (Nest, Ecobee)
- Sensores (temperatura, umidade, movimento)
- Cameras IP
- Fechaduras inteligentes
- Assistentes vocais (Alexa, Google Home)

## Comandos
- `descobrir dispositivos` - Encontra novos dispositivos
- `listar dispositivos` - Mostra dispositivos conhecidos
- `ligar dispositivo` - Ativa dispositivo
- `desligar dispositivo` - Desativa dispositivo
- `status dispositivo` - Verifica estado
- `configurar dispositivo` - Altera configurações

## Estrutura de Dispositivos

### Configuração
```json
{
  "dispositivos": [
    {
      "id": "luz-sala",
      "nome": "Luz da Sala",
      "tipo": "luz",
      "protocolo": "mqtt",
      "broker": "mqtt://192.168.1.50:1883",
      "topico": "home/luz-sala"
    }
  ]
}
```

## Exemplos

### Descobrir Dispositivos
```
Usuário: "Quais dispositivos IoT tem na minha rede?"
IA: Varre a rede e lista dispositivos encontrados
```

### Controlar Dispositivo
```
Usuário: "Liga a luz da sala"
IA: Envia comando MQTT para ativar a luz
```

### Monitorar Sensor
```
Usuário: "Qual a temperatura agora?"
IA: Lê sensor e retorna valor atual
```

## Integrações
- MQTT Brokers (Mosquitto, HiveMQ)
- Home Assistant
- OpenHAB
- Philips Hue Bridge
- AWS IoT
- Google Cloud IoT
- Azure IoT Hub

## Notas de Segurança
- Usa TLS/SSL quando disponível
- Autenticação por token/API key
- Não expõe credenciais
- Suporta VLANs para isolamento
