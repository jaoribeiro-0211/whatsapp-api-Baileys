# Documentação de Integração com Baileys

## Introdução
- **Baileys** é uma biblioteca TypeScript/JavaScript para automação da API Web do WhatsApp (Node suportado). Ela se conecta aos servidores do WhatsApp usando o protocolo WebSocket do WhatsApp Web, não via automação de navegador【406961184283867†L23-L26】.
- O projeto **não usa a API oficial do WhatsApp Business**; em vez disso, conecta‑se a uma conta pessoal ou comercial via recurso "Dispositivos Vinculados"【406961184283867†L33-L36】. Não é afiliado ao WhatsApp e desencoraja o uso para spam ou automação em massa【406961184283867†L37-L40】.
- Para usar a biblioteca é preciso dominar **JavaScript ou TypeScript**【406961184283867†L30-L31】.

## Requisitos e Instalação
- A biblioteca requer **Node.js 17 ou superior**【406961184283867†L61-L62】.
- Instale o pacote Baileys no seu projeto com `npm`, `yarn`, `pnpm` ou `bun`【406961184283867†L42-L57】:
  ```bash
  # usando npm
  npm install baileys

  # usando yarn (versão estável)
  yarn add @whiskeysockets/baileys

  # versão edge
  yarn add github:WhiskeySockets/Baileys
  ```
- Você importará a função `makeWASocket` do pacote para criar o socket de conexão:
  ```ts
  import makeWASocket from '@whiskeysockets/baileys';
  ```

## Conceitos Básicos
- A função principal exportada é `makeWASocket`; ela retorna um objeto (socket) com várias funções e eventos para interagir com o WhatsApp【406961184283867†L67-L77】.
- O socket implementa `EventEmitter`, permitindo escutar eventos como atualizações de conexão, novos chats, mensagens recebidas, etc.【406961184283867†L67-L77】.
- A autenticação é realizada com um estado de credenciais (`auth`) que você fornece; por padrão o site demonstra `useMultiFileAuthState`, mas **não o utilize em produção**, pois é ineficiente【502991741092002†L72-L90】.

## Configuração Inicial
Crie uma função assíncrona que inicializa o socket:

```ts
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true, // imprime o QR no terminal
  });

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      // se não estiver deslogado, tente reconectar
      if (shouldReconnect) connectToWhatsApp();
    } else if (connection === 'open') {
      console.log('Conectado ao WhatsApp');
    }
  });

  // salve credenciais sempre que atualizadas
  sock.ev.on('creds.update', saveCreds);
}

connectToWhatsApp();
```
Esse exemplo usa a função `useMultiFileAuthState` para armazenar as credenciais em arquivos; ele imprime o QR no terminal para parear via QR code e tenta reconectar automaticamente【942327849038141†L411-L453】. **Em produção, implemente seu próprio armazenamento de credenciais** (por exemplo, salvando em banco de dados)【542764804408260†L48-L60】.

### Configurações do Socket
Ao criar o socket, você pode passar configurações opcionais:
- `logger`: Baileys usa a biblioteca `pino` para logs; você pode substituir pelo seu logger ou customizar o `pino`【542764804408260†L40-L45】.
- `auth`: objeto contendo credenciais; implemente seu próprio estado de autenticação (por exemplo, SQL, NoSQL ou Redis)【542764804408260†L48-L53】.
- `getMessage`: função para recuperar mensagens antigas (necessária para reenviar mensagens ou descriptografar votos de enquete)【542764804408260†L55-L60】.
- `browser`/`version`: defina se quer emular navegador desktop ou web; normalmente é seguro manter a versão padrão【542764804408260†L64-L82】.
- `markOnlineOnConnect`: defina `false` para não marcar sua presença como online em cada conexão【542764804408260†L101-L105】.
- `cachedGroupMetadata`: forneça um cache de participantes de grupo para evitar limitações e banimentos quando enviar mensagens em grupos【542764804408260†L110-L123】.

## Conectando à conta e pareamento
- Após configurar o socket, ele se conecta automaticamente. Você pode parear de duas maneiras【502991741092002†L30-L33】:
  - **QR Code**: o evento `connection.update` fornece um código QR. É comum utilizar o pacote `qrcode` para renderizar esse código no terminal. Exemplo:
    ```ts
    import QRCode from 'qrcode';
    sock.ev.on('connection.update', async (update) => {
      const { qr } = update;
      if (qr) {
        console.log(await QRCode.toString(qr, { type: 'terminal' }));
      }
    });
    ```
    Após escanear o código, o WhatsApp desconecta e reconecta para enviar as credenciais; trate o evento `connection.update` para reconectar conforme necessário【502991741092002†L30-L60】.
  - **Paring Code (código de pareamento)**: você fornece seu número (formato E.164 sem “+”) e solicita um código de pareamento pelo evento `connection.update`. Exemplo:
    ```ts
    sock.ev.on('connection.update', async ({ connection, qr }) => {
      if (connection === 'connecting' || qr) {
        const code = await sock.requestPairingCode('5511999999999');
        // envie o código para seu usuário inserir no WhatsApp
      }
    });
    ```
    Certifique‑se de esperar o evento de conexão/QR antes de solicitar o código【502991741092002†L96-L110】.

## Recebendo Atualizações e Mensagens
Baileys usa um sistema de eventos. Para mensagens e outros dados, escute eventos no objeto `sock.ev`:

- **messages.upsert**: dispara quando chegam mensagens em tempo real ou durante a sincronização inicial【750576416138165†L35-L60】. O evento contém um array de mensagens e uma propriedade `type` (“notify” para mensagens novas). Sempre itere sobre todas as mensagens:
  ```ts
  sock.ev.on('messages.upsert', ({ type, messages }) => {
    if (type === 'notify') {
      for (const message of messages) {
        // processe cada mensagem
      }
    }
  });
  ```
- Outros eventos: `messages.update` (mensagens editadas ou deletadas), `messages.delete`, `messages.reaction` e `message-receipt.update`【750576416138165†L63-L80】; `chats.upsert`, `chats.update`, `chats.delete` para chats【750576416138165†L81-L95】; `contacts.upsert`, `contacts.update` para contatos【750576416138165†L106-L115】; e `groups.upsert`, `groups.update`, `group-participants.update` para grupos【750576416138165†L116-L129】.

### Formato das mensagens
- Mensagens chegam como objetos `proto.IWebMessageInfo`, que contém um campo `message` do tipo `proto.IMessage`【423071884123744†L28-L35】. 
- Textos simples aparecem em `message?.conversation` ou `message?.extendedTextMessage?.text`【423071884123744†L30-L49】. 
- Para mídia (imagem, áudio, vídeo), você deverá usar funções utilitárias como `downloadMediaMessage` para baixar o conteúdo【942327849038141†L847-L874】.

## Enviando Mensagens
Use `sock.sendMessage(jid, content, options)` para enviar mensagens, onde `jid` é o ID do destinatário (ex.: `5531999999999@s.whatsapp.net` para contatos ou `123456@g.us` para grupos). Alguns exemplos:

### Mensagens de texto e formatos simples
```ts
await sock.sendMessage(jid, { text: 'Olá mundo' });                  // texto simples
await sock.sendMessage(jid, { text: 'Olá' }, { quoted: message });   // reply/quote
await sock.sendMessage(
  jid,
  { text: '@551234567890', mentions: ['551234567890@s.whatsapp.net'] } // menção
);
```
Você também pode encaminhar (`forward`) mensagens existentes【942327849038141†L598-L605】.

### Localização e contato
```ts
// enviar localização
await sock.sendMessage(jid, {
  location: { degreesLatitude: -23.5505, degreesLongitude: -46.6333 },
});

// enviar contato em formato vCard
const vcard = 'BEGIN:VCARD\n' +
              'VERSION:3.0\n' +
              'FN:João Silva\n' +
              'ORG:Empresa X\n' +
              'TEL;type=CELL;type=VOICE;waid=5511999999999:+55 11 99999 9999\n' +
              'END:VCARD';
await sock.sendMessage(jid, {
  contacts: {
    displayName: 'João',
    contacts: [{ vcard }],
  },
});
```
【942327849038141†L608-L637】

### Reação, fixar e enquete
```ts
// adicionar reação (ou remover passando texto vazio)
await sock.sendMessage(jid, {
  react: { text: '👍', key: message.key },
});

// fixar mensagem por 24h (86400 segundos); type=1 adiciona, 0 remove
await sock.sendMessage(jid, {
  pin: { type: 1, time: 86400, key: message.key },
});

// criar enquete
await sock.sendMessage(jid, {
  poll: {
    name: 'Qual opção?',
    values: ['A', 'B', 'C'],
    selectableCount: 1,
    toAnnouncementGroup: false,
  },
});
```
【942327849038141†L640-L678】【942327849038141†L683-L694】

### Prévia de link
Adicione `link-preview-js` ao projeto (ex.: `yarn add link-preview-js`). Depois, envie mensagem com link:
```ts
await sock.sendMessage(jid, {
  text: 'Veja https://github.com/whiskeysockets/baileys',
});
```
【942327849038141†L696-L712】

### Mensagens de mídia
- **Gif/Vídeo**: Converta gifs para `.mp4` e use `gifPlayback: true`【942327849038141†L730-L740】.
  ```ts
  await sock.sendMessage(jid, {
    video: fs.readFileSync('./Media/animacao.mp4'),
    caption: 'Exemplo GIF',
    gifPlayback: true,
  });
  ```
- **Vídeo**:
  ```ts
  await sock.sendMessage(jid, {
    video: { url: './Media/video.mp4' },
    caption: 'Assista!',
    ptv: false, // true envia como vídeo tipo “nota de vídeo”
  });
  ```
【942327849038141†L744-L756】
- **Áudio**: Converta para formato OGG Opus com FFmpeg【942327849038141†L759-L770】.
  ```ts
  await sock.sendMessage(jid, {
    audio: { url: './Media/audio.mp3' },
    mimetype: 'audio/mp4',
  });
  ```
- **Imagem** e **mensagem “visualizar uma vez”**:
  ```ts
  // imagem comum
  await sock.sendMessage(jid, {
    image: { url: './Media/imagem.png' },
    caption: 'Foto',
  });

  // imagem que só pode ser vista uma vez
  await sock.sendMessage(jid, {
    image: { url: './Media/imagem.png' },
    viewOnce: true,
    caption: 'Foto única',
  });
  ```
【942327849038141†L783-L812】

### Editar ou excluir mensagens
- Para deletar para todos:
  ```ts
  const msg = await sock.sendMessage(jid, { text: 'Mensagem para deletar' });
  await sock.sendMessage(jid, { delete: msg.key });
  ```
【942327849038141†L814-L821】
- Para editar:
  ```ts
  await sock.sendMessage(jid, {
    text: 'Texto atualizado',
    edit: response.key,
  });
  ```
【942327849038141†L827-L834】

## Outras funcionalidades úteis

### Marcar mensagens como lidas
Você deve marcar mensagens específicas como lidas passando um array de chaves de mensagem:
```ts
const key: WAMessageKey;
await sock.readMessages([key]); // pode passar vários keys
```
【942327849038141†L906-L909】

### Atualizar presença
Atualize seu status (online, offline, digitando, etc.):
```ts
await sock.sendPresenceUpdate('available', jid); // disponível
await sock.sendPresenceUpdate('unavailable', jid); // offline
```
【942327849038141†L924-L926】

### Modificar chats (arquivar, silenciar, marcar como lido/não lido)
Use `sock.chatModify` para arquivar, silenciar ou marcar chats como lidos【942327849038141†L942-L970】.

## Boas práticas e cuidados
- Implemente seu próprio armazenamento de credenciais e mensagens em banco de dados; o exemplo de `useMultiFileAuthState` é apenas para demonstração e **não deve ser usado em produção**【502991741092002†L72-L90】.
- Evite spamming: o projeto não é afiliado ao WhatsApp e o uso indevido pode levar a banimentos【406961184283867†L37-L40】.
- Certifique‑se de que seus usuários aceitam receber mensagens via WhatsApp e siga as diretrizes de privacidade.

---

Esta documentação fornece uma visão geral e exemplos para integrar o Baileys em um projeto Node.js. Ajuste as implementações conforme as necessidades específicas da sua aplicação.
