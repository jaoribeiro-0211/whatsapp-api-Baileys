# 🛠️ Setup Local - Guia Completo

Este guia detalha como configurar e rodar o projeto **WhatsApp API** localmente na sua máquina.

---

## 📋 Pré-requisitos

Certifique-se de ter instalado:

- **Node.js** 16+ ([Download](https://nodejs.org/))
- **npm** ou **yarn** (vem com Node.js)
- **Git** ([Download](https://git-scm.com/))
- **WhatsApp** ativo no celular (para escanear QR Code)

Verifique as versões instaladas:

```bash
node -v   # deve mostrar v16.0.0 ou superior
npm -v    # deve mostrar 7.0.0 ou superior
git -v    # qualquer versão
```

---

## 🚀 Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/whatsapp-disparo.git
cd whatsapp-disparo
```

### 2. Instale as dependências

```bash
npm install
```

Isso instalará todas as bibliotecas listadas em `package.json`:
- `express` - Framework web
- `@whiskeysockets/baileys` - Cliente WhatsApp
- `socket.io` - WebSocket para tempo real
- `cors` - Controle de CORS
- `multer` - Upload de arquivos
- `csv-parser` - Parse de CSV
- `pino` - Logs
- `dotenv` - Variáveis de ambiente
- E outras dependências...

### 3. Configure as variáveis de ambiente

O arquivo `.env` já foi criado com valores padrão. Você pode editá-lo se necessário:

```bash
# Ver o arquivo
cat .env

# Editar (opcional)
nano .env
```

Valores padrão:
```env
PORT=3001
CORS_ORIGINS=http://localhost:3000,http://localhost:3002,http://localhost:5173
AUTH_STATE_DIR=auth_info_baileys
DELAY_SECONDS=3
NODE_ENV=development
```

---

## ▶️ Executando o Projeto

### Modo Desenvolvimento (recomendado)

Com hot-reload (reinicia automaticamente ao salvar arquivos):

```bash
npm run dev
```

Você verá:
```
> tsx watch index.ts
{"level":30,"msg":"HTTP server on :3001"}
```

### Modo Produção

Primeiro compile TypeScript para JavaScript:

```bash
npm run build
```

Depois execute:

```bash
npm start
```

---

## 📱 Conectar WhatsApp

### 1. Acesse a página do QR Code

Abra no navegador:
```
http://localhost:3001/qr-page
```

### 2. Escaneie o QR Code

1. Abra o WhatsApp no celular
2. Vá em **Configurações** → **Aparelhos conectados**
3. Toque em **Conectar um aparelho**
4. Escaneie o QR Code exibido na página

### 3. Aguarde conexão

Quando conectado, você verá:
- ✅ No navegador: "WhatsApp conectado!"
- ✅ No terminal: `{"level":30,"msg":"✅ WhatsApp conectado"}`

---

## 🧪 Testando a API

### 1. Verificar status

```bash
curl http://localhost:3001/status
```

Resposta esperada:
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
  "timestamp": "2024-11-05T12:00:00.000Z"
}
```

### 2. Testar envio de mensagens

Crie um arquivo CSV de teste (`contatos.csv`):

```csv
nome,telefone,mensagem
João Silva,11999999999,"Olá João, esta é uma mensagem de teste!"
Maria Santos,11988888888,"Oi Maria, tudo bem?"
```

Envie via API:

```bash
curl -X POST http://localhost:3001/send \
  -F "file=@contatos.csv"
```

Ou use ferramentas gráficas:
- [Postman](https://www.postman.com/)
- [Insomnia](https://insomnia.rest/)
- [Thunder Client](https://www.thunderclient.com/) (extensão VS Code)

### 3. Ver histórico

```bash
curl http://localhost:3001/history
```

---

## 🌐 Rotas Disponíveis

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/` | Página inicial com links |
| GET | `/status` | Status da conexão WhatsApp |
| GET | `/qr` | QR Code em JSON |
| GET | `/qr-page` | Página visual do QR Code |
| GET | `/debug` | Informações de debug |
| GET | `/history` | Histórico de envios |
| GET | `/delay-config` | Configuração atual de delay |
| POST | `/send` | Enviar mensagens via CSV |
| POST | `/restart` | Reiniciar cliente WhatsApp |
| POST | `/clean-session` | Limpar sessão e reiniciar |
| POST | `/configure-delay` | Configurar delay entre mensagens |

Documentação completa: [`API_REFERENCE.md`](./API_REFERENCE.md)

---

## 🔧 Configurações Avançadas

### Alterar porta

Edite `.env`:
```env
PORT=8080
```

Ou use variável de ambiente:
```bash
PORT=8080 npm run dev
```

### Configurar CORS

Para aceitar requisições de outros domínios, edite `.env`:

```env
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,https://meu-app.com
```

### Ajustar delay entre mensagens

Para evitar bloqueios do WhatsApp, configure delays maiores:

Via API:
```bash
curl -X POST http://localhost:3001/configure-delay \
  -H "Content-Type: application/json" \
  -d '{"delaySeconds": 10}'
```

Ou via `.env`:
```env
DELAY_SECONDS=10
```

---

## 🐛 Resolução de Problemas

### Erro: "EADDRINUSE: address already in use"

A porta 3001 já está em uso. Opções:

1. **Matar processo na porta:**
   ```bash
   # macOS/Linux
   lsof -ti :3001 | xargs kill -9
   
   # Windows
   netstat -ano | findstr :3001
   taskkill /PID <PID> /F
   ```

2. **Usar outra porta:**
   ```bash
   PORT=3002 npm run dev
   ```

### Erro: "QR refs attempts ended"

O QR Code expirou. Soluções:

1. **Reiniciar conexão:**
   ```bash
   curl -X POST http://localhost:3001/restart
   ```

2. **Limpar sessão:**
   ```bash
   curl -X POST http://localhost:3001/clean-session
   ```

### WhatsApp não conecta

1. Verifique se o WhatsApp está ativo no celular
2. Tente limpar a sessão:
   ```bash
   # Parar servidor (Ctrl+C)
   rm -rf auth_info_baileys/
   npm run dev
   # Escaneie novamente
   ```

### Mensagens não são enviadas

1. Verifique se está conectado:
   ```bash
   curl http://localhost:3001/status | jq '.data.ready'
   # Deve retornar: true
   ```

2. Confira o formato dos números no CSV:
   - ✅ `11999999999`
   - ✅ `5511999999999`
   - ✅ `(11) 99999-9999`

3. Observe os logs do servidor para erros específicos

### Erro de permissão

```bash
# Limpar cache do npm
npm cache clean --force

# Reinstalar
rm -rf node_modules package-lock.json
npm install
```

---

## 📁 Estrutura de Pastas

```
whatsapp-disparo/
├── index.ts              # Código principal da API
├── package.json          # Dependências e scripts
├── tsconfig.json         # Configuração TypeScript
├── .env                  # Variáveis de ambiente (não versionar)
├── .env.example          # Exemplo de variáveis
├── .gitignore           # Arquivos ignorados pelo Git
├── README.md            # Documentação principal
├── SETUP.md             # Este arquivo
├── DEPLOYMENT.md        # Guia de deploy
├── API_REFERENCE.md     # Referência completa da API
├── auth_info_baileys/   # Sessão do WhatsApp (criada automaticamente)
└── dist/                # Build de produção (após npm run build)
```

---

## 🔄 Workflow de Desenvolvimento

### 1. Fazer alterações no código

```bash
# O servidor reinicia automaticamente (modo dev)
npm run dev
```

### 2. Testar mudanças

```bash
# Testar endpoint
curl http://localhost:3001/status

# Ou usar o navegador
open http://localhost:3001
```

### 3. Commitar mudanças

```bash
git add .
git commit -m "feat: adicionar nova funcionalidade"
git push origin main
```

---

## 📚 Próximos Passos

1. ✅ Configuração local completa
2. 📖 Ler [`API_REFERENCE.md`](./API_REFERENCE.md) para detalhes da API
3. 🚀 Ver [`DEPLOYMENT.md`](./DEPLOYMENT.md) quando for para produção
4. 🔧 Personalizar variáveis em `.env` conforme necessário
5. 📱 Integrar com seu frontend

---

## 💡 Dicas

- **Sessão do WhatsApp**: A pasta `auth_info_baileys/` mantém você conectado. Faça backup!
- **Logs**: Use `tail -f` em modo dev para ver logs em tempo real
- **Hot Reload**: Mudanças no código recarregam automaticamente em modo dev
- **CSV**: Aceita colunas `nome`, `telefone`, `mensagem` (nome é opcional)

---

## 🆘 Suporte

Problemas? Verifique:
1. Logs do servidor no terminal
2. Status: `curl http://localhost:3001/status`
3. Debug: `curl http://localhost:3001/debug`
4. Issues no GitHub

---

**Pronto para começar!** 🎉

Execute `npm run dev` e abra `http://localhost:3001/qr-page`

