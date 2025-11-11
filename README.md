# WhatsApp Bot API

> **🤖 API moderna para envio de mensagens WhatsApp em massa via CSV**

Uma API robusta e completa para automatizar o envio de mensagens personalizadas do WhatsApp a partir de dados em arquivos CSV. Desenvolvida com Node.js, Express e WhatsApp Web.js, oferece funcionalidades avançadas como monitoramento em tempo real, gestão de sessões e interface web integrada.

## ✨ Funcionalidades

### 🔐 Autenticação & Conexão

- ✅ Conexão segura com WhatsApp via QR Code
- ✅ Autenticação persistente com LocalAuth
- ✅ Gerenciamento automático de sessões
- ✅ Reconexão automática em caso de desconexão
- ✅ Interface web para visualização do QR Code

### 📄 Processamento de Dados

- ✅ Upload e processamento de arquivos CSV
- ✅ Validação automática de números de telefone brasileiros
- ✅ Suporte a múltiplos formatos de telefone
- ✅ Detecção automática de colunas do CSV

### 📱 Envio de Mensagens

- ✅ Envio em massa com controle de rate limiting
- ✅ Delay humanizado entre mensagens
- ✅ Monitoramento em tempo real via WebSocket
- ✅ Tratamento robusto de erros
- ✅ Relatórios detalhados de entrega

### 📊 Monitoramento & Logs

- ✅ Status em tempo real de cada mensagem
- ✅ Histórico de arquivos processados
- ✅ Categorização de erros
- ✅ Interface web para acompanhamento

## 🛠️ Tecnologias

- **Backend**: Node.js + Express
- **WhatsApp**: whatsapp-web.js
- **Real-time**: Socket.io
- **Upload**: Multer
- **CSV**: csv-parser
- **Frontend**: HTML5 + JavaScript (Vanilla)

## 📋 Requisitos

- Node.js (v16 ou superior)
- NPM ou Yarn
- Google Chrome/Chromium (para Puppeteer)
- WhatsApp ativo no celular

## 🚀 Instalação

```bash
# Clone o repositório
git clone <repo-url>
cd whatsapp-bot-api

# Instale as dependências
npm install

# Inicie o servidor
npm start

# Ou use os comandos alternativos:
npm run clean    # Limpa sessão do WhatsApp
npm run restart  # Limpa sessão e reinicia
```

## 🎯 Como Usar

### 1. Iniciar o Servidor

```bash
npm start
```

O servidor será iniciado na porta **3001**.

### 2. Conectar WhatsApp

- Acesse: `http://localhost:3001/qr-page`
- Escaneie o QR Code com seu WhatsApp
- Aguarde a confirmação de conexão

### 3. Preparar CSV

Crie um arquivo CSV com as colunas necessárias:

```csv
nome,telefone,mensagem
João Silva,11999999999,"Olá João! Como você está?"
Maria Santos,11988888888,"Oi Maria, tudo bem?"
Pedro Costa,5511977777777,"Pedro, confira nossa promoção!"
```

### 4. Enviar Mensagens

Use a API REST ou a interface web para processar o arquivo.

## 🌐 API Endpoints

### 📊 Status & Monitoramento

#### `GET /status`

Verifica o status da conexão WhatsApp.

**Resposta:**

```json
{
  "success": true,
  "data": {
    "connected": true,
    "ready": true,
    "hasQr": false,
    "clientInfo": {
      "wid": "5511999999999@c.us",
      "pushname": "Seu Nome"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### `GET /qr`

Obtém o QR Code para autenticação.

**Resposta:**

```json
{
  "success": true,
  "data": {
    "qr": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "connected": false,
    "hasQr": true,
    "ready": false
  }
}
```

### 🔄 Gerenciamento de Sessão

#### `POST /restart`

Reinicia o cliente WhatsApp.

**Resposta:**

```json
{
  "success": true,
  "data": { "restarting": true },
  "message": "Cliente WhatsApp sendo reiniciado"
}
```

#### `POST /clean-session`

Limpa a sessão armazenada e reinicia.

**Resposta:**

```json
{
  "success": true,
  "data": { "sessionCleaned": true },
  "message": "Sessão limpa e cliente reiniciado"
}
```

### 📤 Envio de Mensagens

#### `POST /send`

Processa arquivo CSV e envia mensagens.

**Parâmetros:**

- `file`: Arquivo CSV (multipart/form-data)

**Exemplo de uso:**

```javascript
const formData = new FormData();
formData.append("file", csvFile);

fetch("http://localhost:3001/send", {
  method: "POST",
  body: formData,
})
  .then((response) => response.json())
  .then((data) => console.log(data));
```

**Resposta:**

```json
{
  "success": true,
  "data": {
    "sessionId": "1705398600000",
    "total": 3,
    "sent": 2,
    "failed": 1
  },
  "message": "Processamento concluído: 2 enviadas, 1 falharam"
}
```

### 📈 Histórico

#### `GET /history`

Retorna histórico de arquivos processados.

**Resposta:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1705398600000,
      "fileName": "contatos.csv",
      "uploadDate": "2024-01-15T10:30:00.000Z",
      "totalContacts": 100,
      "sent": 95,
      "failed": 5,
      "status": "completed"
    }
  ]
}
```

## 🔌 WebSocket Events

A API utiliza WebSocket para comunicação em tempo real:

### Eventos Enviados pelo Servidor

```javascript
// Conexão WebSocket
const socket = io("http://localhost:3001");

// QR Code atualizado
socket.on("qrCode", (data) => {
  console.log("Novo QR Code:", data.qr);
});

// WhatsApp conectado
socket.on("whatsappReady", (data) => {
  console.log("WhatsApp conectado:", data.connected);
});

// WhatsApp desconectado
socket.on("whatsappDisconnected", (data) => {
  console.log("WhatsApp desconectado:", data.reason);
});

// Nova sessão de envio iniciada
socket.on("messageSession", (data) => {
  console.log("Sessão iniciada:", data.sessionId);
  console.log("Contatos:", data.contacts);
});

// Atualização de status de mensagem
socket.on("messageUpdate", (data) => {
  console.log("Mensagem atualizada:", {
    sessionId: data.sessionId,
    contactId: data.contactId,
    status: data.status,
    error: data.error,
  });
});

// Sessão de envio concluída
socket.on("sessionComplete", (data) => {
  console.log("Sessão concluída:", data.results);
});
```

## 📁 Estrutura do Projeto

```
whatsapp-bot-api/
├── server.js              # Servidor principal
├── package.json           # Dependências e scripts
├── clean-session.js       # Script para limpeza de sessão
├── public/                # Interface web
│   ├── index.html        # Dashboard principal
│   └── qr.html           # Página do QR Code
└── uploads/              # Arquivos CSV temporários
```

## 📊 Status de Mensagens

```javascript
const MESSAGE_STATUS = {
  PENDING: "pending", // Aguardando envio
  SENDING: "sending", // Enviando
  SENT: "sent", // Enviada com sucesso
  ERROR: "error", // Erro no envio
};
```

## ⚠️ Códigos de Erro

```javascript
const ERROR_CODES = {
  CLIENT_NOT_INITIALIZED: "CLIENT_NOT_INITIALIZED",
  CLIENT_NOT_READY: "CLIENT_NOT_READY",
  FILE_NOT_PROVIDED: "FILE_NOT_PROVIDED",
  CSV_PARSE_ERROR: "CSV_PARSE_ERROR",
  MESSAGE_SEND_ERROR: "MESSAGE_SEND_ERROR",
  INVALID_PHONE_NUMBER: "INVALID_PHONE_NUMBER",
  CONNECTION_ERROR: "CONNECTION_ERROR",
  WHATSAPP_NOT_REGISTERED: "WHATSAPP_NOT_REGISTERED",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
};
```

## 📱 Formato de Telefones

A API aceita números brasileiros nos seguintes formatos:

- `11999999999` (11 dígitos)
- `5511999999999` (13 dígitos com código do país)
- `(11) 99999-9999` (formatado)

Todos são automaticamente convertidos para o formato internacional: `5511999999999@c.us`

## 🔧 Configuração Avançada

### Delays Customizados

O sistema usa delays humanizados entre mensagens:

- **Base**: 2-6 segundos aleatórios
- **Penalidade por erro**: +2 segundos após 3 erros
- **Timeout por mensagem**: 30 segundos

### CORS

Por padrão, a API aceita requisições de:

- `http://localhost:3000`
- `http://localhost:3002`
- `http://localhost:5173`

Você pode configurar as origens permitidas via variável de ambiente `CORS_ORIGINS` (separadas por vírgula):

```bash
# .env
CORS_ORIGINS=http://localhost:3000,http://localhost:3002,http://localhost:5173
```

Tanto o Express quanto o Socket.IO usam essa configuração para liberar CORS (incluindo credenciais e preflight/OPTIONS).

## 🐛 Resolução de Problemas

### WhatsApp não conecta

```bash
# Limpe a sessão e tente novamente
npm run clean
npm start
```

### Erro "Client not ready"

- Aguarde a conexão completa do WhatsApp
- Verifique se o QR Code foi escaneado
- Use `GET /status` para verificar o estado

### Mensagens não são enviadas

- Verifique se o WhatsApp está ativo no celular
- Confirme o formato dos números de telefone
- Observe os logs do servidor para erros específicos

### Erro de permissão

```bash
# No Linux/Mac, pode ser necessário:
sudo npm install
# Ou usar Node Version Manager (nvm)
```

## 📄 Interface Web

### Dashboard Principal

Acesse `http://localhost:3001` para:

- Verificar status da conexão
- Fazer upload de arquivos CSV
- Acompanhar envios em tempo real
- Visualizar histórico

### Página do QR Code

Acesse `http://localhost:3001/qr-page` para:

- Visualizar QR Code em interface amigável
- Instruções passo-a-passo
- Status de conexão em tempo real

## 🔒 Segurança

- ✅ Validação de tipos de arquivo (apenas CSV)
- ✅ Sanitização de números de telefone
- ✅ Rate limiting automático
- ✅ Limpeza automática de arquivos temporários
- ✅ Tratamento seguro de erros

## 📝 Logs

O sistema fornece logs detalhados:

```
🚀 Inicializando cliente WhatsApp...
📱 QR Code recebido: QR gerado com sucesso
✅ WhatsApp conectado!
📋 50 contatos carregados.
✅ Enviado para João Silva (11999999999)
❌ Erro para 11888888888: Número sem WhatsApp
```

## 🤝 Contribuição

Contribuições são bem-vindas! Consulte o guia em [AGENTS.md](AGENTS.md) antes de começar.

Para contribuir:

1. Faça um fork do projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença ISC.

---

> **💡 Dica**: Para integração com seu frontend React, consulte a seção de WebSocket Events e utilize os endpoints REST documentados acima. A API foi projetada para ser facilmente integrada com qualquer framework frontend moderno.
