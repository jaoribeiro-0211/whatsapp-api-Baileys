# 📚 API Reference - WhatsApp Bot API

## 🌐 Base URL
```
http://localhost:3001
```

## 📋 Respostas Padronizadas

Todas as respostas seguem este formato:

### ✅ Sucesso
```json
{
  "success": true,
  "data": <dados_da_resposta>,
  "message": "Mensagem opcional",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### ❌ Erro
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Descrição do erro",
    "details": "Detalhes adicionais (opcional)",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## 🔍 Endpoints

### 1. Status & Monitoramento

#### `GET /status`
Verifica o status atual da conexão WhatsApp.

**Resposta de Sucesso:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "ready": true,
    "hasQr": false,
    "clientInfo": {
      "wid": "5511999999999@c.us",
      "pushname": "João Silva"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Estados Possíveis:**
- `connected: false, ready: false, hasQr: true` - Aguardando scan do QR
- `connected: true, ready: true, hasQr: false` - Conectado e pronto
- `connected: false, ready: false, hasQr: false` - Desconectado

---

#### `GET /qr`
Obtém o QR Code para autenticação.

**Resposta de Sucesso:**
```json
{
  "success": true,
  "data": {
    "qr": "2@ABC123XYZ...",
    "connected": false,
    "hasQr": true,
    "ready": false
  }
}
```

**Quando Conectado:**
```json
{
  "success": true,
  "data": {
    "qr": "",
    "connected": true,
    "hasQr": false,
    "ready": true
  }
}
```

---

#### `GET /debug`
Informações de debug do sistema.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "qrCodeString": "Presente",
    "qrLength": 280,
    "isClientReady": true,
    "clientExists": true,
    "clientState": {
      "wid": "5511999999999@c.us",
      "pushname": "João Silva"
    }
  }
}
```

---

### 2. Gerenciamento de Sessão

#### `POST /restart`
Reinicia o cliente WhatsApp mantendo a sessão.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "restarting": true
  },
  "message": "Cliente WhatsApp sendo reiniciado"
}
```

---

#### `POST /clean-session`
Remove completamente a sessão armazenada e reinicia.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "sessionCleaned": true
  },
  "message": "Sessão limpa e cliente reiniciado"
}
```

**⚠️ Atenção:** Este endpoint remove todos os dados de autenticação. Será necessário escanear o QR Code novamente.

---

#### `POST /configure-delay`
Configura o tempo de delay entre o envio de mensagens.

**Parâmetros:**
```json
{
  "delaySeconds": 5
}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "delaySeconds": 5,
    "variation": 2.5,
    "errorPenalty": 2
  },
  "message": "Delay configurado para 5 segundos"
}
```

**Validação:**
- Mínimo: 0 segundos
- Máximo: 300 segundos (5 minutos)
- A variação será 50% do valor base (máximo 3s)

**Exemplo JavaScript:**
```javascript
const response = await fetch('/configure-delay', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ delaySeconds: 5 })
});
```

---

#### `GET /delay-config`
Obtém a configuração atual do delay.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "delaySeconds": 5,
    "variation": 2.5,
    "errorPenalty": 2,
    "description": "5s base, ±2.5s variação, +2s por erro"
  }
}
```

---

### 3. Envio de Mensagens

#### `POST /send`
Processa arquivo CSV e envia mensagens.

**Content-Type:** `multipart/form-data`

**Parâmetros:**
- `file` (required): Arquivo CSV

**Exemplo JavaScript:**
```javascript
const formData = new FormData();
formData.append('file', csvFile);

const response = await fetch('/send', {
  method: 'POST',
  body: formData
});
```

**Resposta de Sucesso:**
```json
{
  "success": true,
  "data": {
    "sessionId": "1705398600000",
    "total": 50,
    "sent": 45,
    "failed": 5
  },
  "message": "Processamento concluído: 45 enviadas, 5 falharam"
}
```

**Possíveis Erros:**
```json
{
  "success": false,
  "error": {
    "code": "CLIENT_NOT_READY",
    "message": "WhatsApp não está conectado. Escaneie o QR Code primeiro."
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "FILE_NOT_PROVIDED",
    "message": "Nenhum arquivo CSV foi enviado"
  }
}
```

---

### 4. Histórico

#### `GET /history`
Retorna o histórico dos últimos 10 arquivos processados.

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1705398600000,
      "fileName": "contatos_janeiro.csv",
      "uploadDate": "2024-01-15T10:30:00.000Z",
      "totalContacts": 100,
      "sent": 95,
      "failed": 5,
      "status": "completed"
    },
    {
      "id": 1705312200000,
      "fileName": "newsletter.csv",
      "uploadDate": "2024-01-14T10:30:00.000Z",
      "totalContacts": 250,
      "sent": 240,
      "failed": 10,
      "status": "completed"
    }
  ]
}
```

**Status Possíveis:**
- `processing` - Arquivo sendo processado
- `completed` - Processamento concluído
- `error` - Erro durante processamento

---

## 🔌 WebSocket Events

### Conexão
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', {
  transports: ['websocket']
});
```

### Eventos do Servidor → Cliente

#### `qrCode`
Emitido quando um novo QR Code é gerado.

```javascript
socket.on('qrCode', (data) => {
  console.log('QR Code:', data.qr);
  // data: { qr: "2@ABC123..." }
});
```

#### `whatsappReady`
Emitido quando o WhatsApp se conecta com sucesso.

```javascript
socket.on('whatsappReady', (data) => {
  console.log('WhatsApp conectado!');
  // data: { connected: true }
});
```

#### `whatsappDisconnected`
Emitido quando o WhatsApp se desconecta.

```javascript
socket.on('whatsappDisconnected', (data) => {
  console.log('Desconectado:', data.reason);
  // data: { reason: "Logout pelo usuário" }
});
```

#### `messageSession`
Emitido quando uma nova sessão de envio é iniciada.

```javascript
socket.on('messageSession', (data) => {
  console.log('Nova sessão:', data.sessionId);
  console.log('Contatos:', data.contacts);
  /*
  data: {
    sessionId: "1705398600000",
    contacts: [
      {
        id: 0,
        nome: "João Silva",
        telefone: "11999999999",
        mensagem: "Olá João!",
        status: "pending",
        error: null,
        timestamp: null
      }
    ],
    total: 50
  }
  */
});
```

#### `messageUpdate`
Emitido sempre que o status de uma mensagem é atualizado.

```javascript
socket.on('messageUpdate', (data) => {
  console.log('Mensagem atualizada:', data);
  /*
  data: {
    sessionId: "1705398600000",
    contactId: 0,
    status: "sent", // ou "sending", "error"
    error: null, // ou mensagem de erro
    timestamp: "2024-01-15T10:30:00.000Z"
  }
  */
});
```

#### `sessionComplete`
Emitido quando toda a sessão de envio é concluída.

```javascript
socket.on('sessionComplete', (data) => {
  console.log('Sessão concluída:', data.results);
  /*
  data: {
    sessionId: "1705398600000",
    results: {
      total: 50,
      sent: 45,
      failed: 5
    }
  }
  */
});
```

---

## 📱 Formato de Telefones

### Formatos Aceitos
A API aceita e converte automaticamente os seguintes formatos:

```
11999999999          → 5511999999999@c.us
5511999999999        → 5511999999999@c.us
(11) 99999-9999      → 5511999999999@c.us
+55 11 99999-9999    → 5511999999999@c.us
11 9 9999-9999       → 5511999999999@c.us
```

### Validação
- ✅ Números com 10 ou 11 dígitos (São Paulo)
- ✅ Números com 13 dígitos (incluindo +55)
- ✅ Formatação automática para WhatsApp
- ❌ Números de outros estados (necessário ajuste)

---

## 📄 Estrutura do CSV

### Formato Requerido
```csv
nome,telefone,mensagem
João Silva,11999999999,"Olá João, como está?"
Maria Santos,5511988888888,"Oi Maria!"
```

### Campos Obrigatórios
- `telefone` - Número do WhatsApp
- `mensagem` - Texto a ser enviado

### Campos Opcionais
- `nome` - Nome do contato (para logs)
- Outros campos são ignorados

### Limitações
- Máximo 1000 contatos por arquivo
- Mensagens até 4096 caracteres
- Arquivo CSV até 10MB

---

## ⚡ Rate Limiting & Configuração de Delay

### Delays Configuráveis
O sistema permite configurar o tempo entre mensagens dinamicamente:
- **Base configurável**: 0-300 segundos (padrão: 3 segundos)
- **Variação automática**: ±50% do valor base (máximo 3s)
- **Penalidade por erro**: +2 segundos após 3 falhas consecutivas
- **Timeout por mensagem**: 30 segundos

### Configurar Delay
```javascript
// Configurar para 5 segundos
fetch('/configure-delay', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ delaySeconds: 5 })
});

// Verificar configuração atual
fetch('/delay-config')
  .then(response => response.json())
  .then(data => console.log(data.data.description));
```

### Comportamento
- **Delay humanizado**: Variação aleatória para simular comportamento humano
- **Penalidade progressiva**: Aumenta delay após erros consecutivos
- **Pausa automática**: Em caso de rate limit do WhatsApp
- **Mínimo absoluto**: 1 segundo (por segurança)

### Exemplos de Configuração
```javascript
// Para envios rápidos (cuidado com bloqueios)
{ "delaySeconds": 1 }  // 1s ±0.5s

// Configuração equilibrada
{ "delaySeconds": 3 }  // 3s ±1.5s

// Para envios conservadores
{ "delaySeconds": 10 } // 10s ±3s

// Para envios muito lentos
{ "delaySeconds": 30 } // 30s ±3s
```

---

## 🚨 Códigos de Erro

### Códigos de Status HTTP
- `200` - Sucesso
- `400` - Erro na requisição
- `404` - Rota não encontrada
- `500` - Erro interno do servidor

### Códigos de Erro Customizados

#### Conexão
```json
"CLIENT_NOT_INITIALIZED"     // Cliente não foi criado
"CLIENT_NOT_READY"          // WhatsApp não conectado
"CONNECTION_ERROR"          // Erro de conexão geral
```

#### Arquivo
```json
"FILE_NOT_PROVIDED"         // Nenhum arquivo enviado
"CSV_PARSE_ERROR"          // Erro ao processar CSV
```

#### Mensagem
```json
"MESSAGE_SEND_ERROR"        // Erro ao enviar mensagem
"INVALID_PHONE_NUMBER"      // Número inválido
"WHATSAPP_NOT_REGISTERED"   // Número sem WhatsApp
"RATE_LIMIT_EXCEEDED"       // Limite de mensagens atingido
```

---

## 🧪 Testando a API

### Com cURL

```bash
# Verificar status
curl http://localhost:3001/status

# Obter QR Code
curl http://localhost:3001/qr

# Enviar arquivo
curl -X POST \
  http://localhost:3001/send \
  -F "file=@contatos.csv"

# Reiniciar cliente
curl -X POST http://localhost:3001/restart

# Limpar sessão
curl -X POST http://localhost:3001/clean-session

# Configurar delay para 5 segundos
curl -X POST \
  http://localhost:3001/configure-delay \
  -H "Content-Type: application/json" \
  -d '{"delaySeconds": 5}'

# Verificar configuração atual do delay
curl http://localhost:3001/delay-config
```

### Com JavaScript

```javascript
// Verificar status
const status = await fetch('/status').then(r => r.json());

// Upload de arquivo
const formData = new FormData();
formData.append('file', fileInput.files[0]);
const result = await fetch('/send', {
  method: 'POST',
  body: formData
}).then(r => r.json());

// WebSocket
const socket = io();
socket.on('messageUpdate', (data) => {
  console.log('Status atualizado:', data.status);
});
```

---

## 🔒 Segurança

### Headers CORS
```javascript
// Configuração atual
origin: ["http://localhost:3000", "http://localhost:3002"]
```

### Validações
- ✅ Tipo de arquivo (apenas .csv)
- ✅ Tamanho máximo do arquivo
- ✅ Sanitização de números
- ✅ Validação de dados obrigatórios

### Recomendações
- Use HTTPS em produção
- Implemente autenticação se necessário
- Configure rate limiting no proxy reverso
- Monitore logs para atividades suspeitas

---

## 📊 Monitoramento

### Logs do Console
```
🚀 Inicializando cliente WhatsApp...
📱 QR Code recebido: QR gerado com sucesso
✅ WhatsApp conectado!
📋 50 contatos carregados.
✅ Enviado para João Silva (11999999999)
❌ Erro para 11888888888: Número sem WhatsApp
```

### Métricas Disponíveis
- Total de mensagens enviadas
- Taxa de sucesso/falha
- Tempo médio de processamento
- Histórico de sessões

---

Esta documentação fornece todas as informações necessárias para integrar a WhatsApp Bot API ao seu frontend React de forma eficiente e robusta.