# 🚀 Guia de Deploy para Produção

Este guia descreve como fazer deploy da **WhatsApp API** em diferentes ambientes de produção.

---

## 📋 Pré-requisitos

- Node.js 16+ instalado
- Acesso SSH ao servidor (para VPS)
- Domínio (opcional, mas recomendado)
- Certificado SSL (para HTTPS)

---

## 🔧 Preparação do Código

### 1. Build do projeto

```bash
# Compilar TypeScript para JavaScript
npm run build

# Verificar pasta dist/
ls dist/
```

### 2. Variáveis de ambiente

Crie um arquivo `.env` no servidor com as configurações de produção:

```bash
PORT=3001
CORS_ORIGINS=https://seu-dominio.com,https://app.seu-dominio.com
AUTH_STATE_DIR=auth_info_baileys
DELAY_SECONDS=3
NODE_ENV=production
```

---

## ☁️ Opções de Deploy

### Opção 1: VPS (DigitalOcean, AWS EC2, Linode, etc.)

#### 1.1 Conectar ao servidor

```bash
ssh usuario@seu-servidor.com
```

#### 1.2 Instalar Node.js (se necessário)

```bash
# Via NVM (recomendado)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

#### 1.3 Clonar o repositório

```bash
cd /var/www
git clone https://github.com/seu-usuario/whatsapp-disparo.git
cd whatsapp-disparo
```

#### 1.4 Instalar dependências e fazer build

```bash
npm install --production=false
npm run build
```

#### 1.5 Configurar variáveis de ambiente

```bash
nano .env
# Cole as variáveis de produção
```

#### 1.6 Usar PM2 para manter o processo rodando

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar aplicação
pm2 start dist/index.js --name whatsapp-api

# Salvar configuração
pm2 save

# Auto-start no boot
pm2 startup
```

#### 1.7 Comandos úteis do PM2

```bash
# Ver status
pm2 status

# Ver logs
pm2 logs whatsapp-api

# Reiniciar
pm2 restart whatsapp-api

# Parar
pm2 stop whatsapp-api

# Remover
pm2 delete whatsapp-api
```

#### 1.8 Configurar Nginx como proxy reverso

```bash
# Instalar Nginx
sudo apt update
sudo apt install nginx

# Criar configuração
sudo nano /etc/nginx/sites-available/whatsapp-api
```

Cole esta configuração:

```nginx
server {
    listen 80;
    server_name api.seu-dominio.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ativar configuração:

```bash
sudo ln -s /etc/nginx/sites-available/whatsapp-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 1.9 Configurar SSL com Let's Encrypt (Certbot)

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx

# Obter certificado SSL
sudo certbot --nginx -d api.seu-dominio.com

# Auto-renovação (já configurado automaticamente)
sudo certbot renew --dry-run
```

---

### Opção 2: Railway.app

#### 2.1 Criar conta no Railway

1. Acesse [railway.app](https://railway.app)
2. Faça login com GitHub

#### 2.2 Deploy direto do GitHub

1. Clique em **New Project**
2. Selecione **Deploy from GitHub repo**
3. Escolha `whatsapp-disparo`
4. Railway detectará automaticamente como Node.js

#### 2.3 Configurar variáveis de ambiente

No dashboard do Railway:
- Vá em **Variables**
- Adicione cada variável:
  ```
  PORT=3001
  CORS_ORIGINS=https://seu-frontend.com
  AUTH_STATE_DIR=auth_info_baileys
  DELAY_SECONDS=3
  NODE_ENV=production
  ```

#### 2.4 Configurar comando de start

No arquivo `railway.json` (criar na raiz):

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run build && npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

Railway fará deploy automático a cada push no GitHub.

---

### Opção 3: Render.com

#### 3.1 Criar conta no Render

1. Acesse [render.com](https://render.com)
2. Faça login com GitHub

#### 3.2 Criar Web Service

1. Clique em **New +** → **Web Service**
2. Conecte seu repositório GitHub
3. Configure:
   - **Name**: whatsapp-api
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free (ou pago para melhor performance)

#### 3.3 Variáveis de ambiente

No dashboard do Render, adicione:
```
PORT=3001
CORS_ORIGINS=https://seu-frontend.com
AUTH_STATE_DIR=auth_info_baileys
DELAY_SECONDS=3
NODE_ENV=production
```

---

### Opção 4: Docker

#### 4.1 Criar Dockerfile

Crie `Dockerfile` na raiz:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código fonte
COPY . .

# Build TypeScript
RUN npm run build

# Expor porta
EXPOSE 3001

# Comando de start
CMD ["npm", "start"]
```

#### 4.2 Criar docker-compose.yml

```yaml
version: '3.8'

services:
  whatsapp-api:
    build: .
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - CORS_ORIGINS=https://seu-frontend.com
      - AUTH_STATE_DIR=auth_info_baileys
      - DELAY_SECONDS=3
      - NODE_ENV=production
    volumes:
      - ./auth_info_baileys:/app/auth_info_baileys
    restart: unless-stopped
```

#### 4.3 Build e executar

```bash
# Build
docker-compose build

# Executar
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar
docker-compose down
```

---

## 🔒 Segurança em Produção

### 1. Firewall

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. Fail2ban (proteção contra ataques de força bruta)

```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 3. Rate limiting (via Nginx)

Adicione no bloco `http` do Nginx:

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

server {
    location / {
        limit_req zone=api burst=20 nodelay;
        # ... resto da config
    }
}
```

### 4. Variáveis de ambiente seguras

- Nunca commite `.env` no git
- Use secrets managers (AWS Secrets Manager, Railway Variables, etc.)
- Rotacione tokens periodicamente

---

## 📊 Monitoramento

### Logs com PM2

```bash
# Logs em tempo real
pm2 logs whatsapp-api

# Histórico
pm2 logs whatsapp-api --lines 1000

# Limpar logs
pm2 flush
```

### Monitoramento com PM2 Plus

1. Crie conta em [pm2.io](https://pm2.io)
2. Conecte seu servidor:
   ```bash
   pm2 link <secret> <public>
   ```
3. Acesse dashboard online

### Uptime monitoring

Use serviços como:
- [UptimeRobot](https://uptimerobot.com) (grátis)
- [Pingdom](https://www.pingdom.com)
- [StatusCake](https://www.statuscake.com)

Configure para monitorar: `https://api.seu-dominio.com/status`

---

## 🔄 Atualização em Produção

### VPS com PM2

```bash
cd /var/www/whatsapp-disparo
git pull origin main
npm install
npm run build
pm2 restart whatsapp-api
```

### Railway/Render

Apenas faça push no GitHub:
```bash
git push origin main
# Deploy automático
```

---

## ⚠️ Backup da Sessão do WhatsApp

A pasta `auth_info_baileys/` contém a sessão autenticada. **Faça backup regularmente!**

```bash
# Backup manual
tar -czf backup-whatsapp-$(date +%Y%m%d).tar.gz auth_info_baileys/

# Backup automático com cron (diariamente às 3h)
crontab -e
# Adicione:
0 3 * * * cd /var/www/whatsapp-disparo && tar -czf ~/backups/whatsapp-$(date +\%Y\%m\%d).tar.gz auth_info_baileys/
```

---

## 📞 Suporte

Em caso de problemas:
1. Verifique logs: `pm2 logs whatsapp-api`
2. Teste endpoint: `curl https://api.seu-dominio.com/status`
3. Revise configurações de CORS e firewall
4. Verifique se a porta está aberta: `netstat -tulpn | grep 3001`

---

## 📚 Recursos Adicionais

- [Documentação PM2](https://pm2.keymetrics.io/)
- [Documentação Nginx](https://nginx.org/en/docs/)
- [Railway Docs](https://docs.railway.app/)
- [Render Docs](https://render.com/docs)
- [Docker Docs](https://docs.docker.com/)

