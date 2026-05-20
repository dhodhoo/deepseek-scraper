# DeepSeek Scraper

Unofficial Node.js client untuk DeepSeek Chat web. Project ini berfokus pada scraping/internal web API DeepSeek Chat, termasuk autentikasi token web, sesi percakapan, SSE response parsing, Proof-of-Work, AWS WAF solver, web search toggle, dan upload file.

> Warning: library ini memakai internal web API DeepSeek Chat, bukan API resmi `https://api.deepseek.com`. Endpoint, token, WAF, PoW, cookie, dan format stream bisa berubah sewaktu-waktu.

## Fitur Utama

- Login dengan email/password DeepSeek web.
- Set token manual lewat `DEEPSEEK_TOKEN`.
- Membuat sesi chat dan menjaga konteks multi-turn conversation.
- Mengirim pesan ke DeepSeek Chat dengan opsi `search` dan `thinking`.
- Streaming response asli lewat async iterator.
- Membaca response SSE sampai hasil final siap dipakai untuk mode non-streaming.
- Upload file dan polling status pemrosesan file.
- Proof-of-Work otomatis memakai `sha3_wasm.wasm`.
- AWS WAF solver memakai `aws-waf-solver.js` dan fingerprint dari `webgl.json`.
- Proxy support lewat opsi constructor.

## Struktur Project

```text
deepseek-scraper/
|-- deepseek.js              # Core DeepSeek scraper client
|-- aws-waf-solver.js        # AWS WAF challenge solver
|-- sha3_wasm.wasm           # WASM untuk Proof-of-Work
|-- webgl.json               # Fingerprint GPU pool untuk WAF
|-- tes.js                   # Contoh penggunaan scraper via Node.js
|-- .env.example             # Template environment variable
|-- package.json             # Dependency dan script project
`-- ai-chatbot/              # Contoh implementasi UI Next.js memakai scraper ini
```

Folder `ai-chatbot` hanya contoh implementasi frontend. Library utama project ini tetap `deepseek.js`.

## Install

```bash
npm install
```

## Environment

Buat file `.env` di root project:

```env
DEEPSEEK_EMAIL=email@example.com
DEEPSEEK_PASSWORD=your-password
DEEPSEEK_TOKEN=your-deepseek-web-token
```

Keterangan:

- `DEEPSEEK_EMAIL` dan `DEEPSEEK_PASSWORD` dipakai jika ingin login dari script.
- `DEEPSEEK_TOKEN` dipakai jika sudah punya token web DeepSeek dan ingin langsung memakai `setToken`.
- `DEEPSEEK_TOKEN` bukan API key resmi DeepSeek. Ini token dari DeepSeek Chat web.

Jangan commit `.env`.

## Quick Start

Contoh paling sederhana memakai token:

```js
const { DeepSeekClient } = require("./deepseek");

async function main() {
  const client = new DeepSeekClient();
  client.setToken(process.env.DEEPSEEK_TOKEN);

  const sessionId = await client.createSession();
  const reply = await client.chat(sessionId, "Halo, apa kabar?", {
    search: true,
    thinking: false,
  });

  console.log(reply.content);
}

main().catch(console.error);
```

Pastikan `DEEPSEEK_TOKEN` sudah tersedia di `process.env`. Contoh bawaan `tes.js` sudah memuat file `.env` secara manual.

Jalankan contoh bawaan:

```bash
npm start
```

## Login Dengan Email dan Password

Jika tidak ingin memakai token manual, client bisa login ke DeepSeek web:

```js
const { DeepSeekClient } = require("./deepseek");

async function main() {
  const client = new DeepSeekClient();

  const auth = await client.login(
    process.env.DEEPSEEK_EMAIL,
    process.env.DEEPSEEK_PASSWORD
  );

  console.log(auth.token);

  const result = await client.quickChat("Jelaskan apa itu scraper API.");
  console.log(result.content);

  await client.logout();
}

main().catch(console.error);
```

## Multi-Turn Conversation

Gunakan `createSession()` sekali, lalu pakai `chat()` berulang dengan `sessionId` yang sama.

```js
const client = new DeepSeekClient();
client.setToken(process.env.DEEPSEEK_TOKEN);

const sessionId = await client.createSession();

const first = await client.chat(sessionId, "Nama saya DhoDho.");
console.log(first.content);

const second = await client.chat(sessionId, "Tadi nama saya siapa?");
console.log(second.content);
```

## Streaming Response

Gunakan `chatStream()` untuk menerima jawaban bertahap saat chunk SSE DeepSeek masuk.

```js
const client = new DeepSeekClient();
client.setToken(process.env.DEEPSEEK_TOKEN);

const sessionId = await client.createSession();

for await (const event of client.chatStream(sessionId, "Tulis cerita pendek.", {
  search: false,
  thinking: false,
})) {
  if (event.type === "delta") {
    process.stdout.write(event.delta);
  }

  if (event.type === "done") {
    console.log("\nMessage ID:", event.message_id);
  }
}
```

Event streaming:

- `delta`: potongan teks baru, plus `content` akumulatif.
- `done`: hasil final `{ content, message_id }`.

## Search dan Thinking

`chat()` menerima opsi:

```js
const reply = await client.chat(sessionId, "Berita terbaru tentang AI?", {
  search: true,
  thinking: false,
});
```

Catatan:

- `search: true` meminta DeepSeek web memakai fitur search.
- `thinking: true` mengaktifkan thinking mode dari DeepSeek web.
- Event thinking dipisahkan dari jawaban final. Scraper hanya mengekspos status `thinking`, bukan raw reasoning text.
- Jawaban final disanitasi agar preamble reasoning/internal instruction tidak ikut masuk ke `content`.

## Upload File

```js
const client = new DeepSeekClient();
client.setToken(process.env.DEEPSEEK_TOKEN);

const sessionId = await client.createSession();
const fileId = await client.uploadFile("./document.pdf", "document.pdf", "application/pdf");

await client.waitForFile(fileId);

const reply = await client.chat(sessionId, "Ringkas isi file ini.", {
  fileIds: [fileId],
  search: false,
  thinking: false,
});

console.log(reply.content);
```

## Proxy

```js
const client = new DeepSeekClient({
  proxy: "http://user:pass@host:port",
});
```

## API Reference

### `new DeepSeekClient(options?)`

Membuat instance client baru.

| Option | Type | Default | Keterangan |
| --- | --- | --- | --- |
| `proxy` | `string` | `null` | Proxy HTTP/HTTPS opsional |

### `client.setToken(token)`

Set bearer token DeepSeek web secara manual.

### `client.login(email, password)`

Login ke DeepSeek web dan menyimpan token ke client.

Returns:

```js
{ ok: true, token: "..." }
```

### `client.logout()`

Logout dan reset token client.

### `client.createSession()`

Membuat sesi chat baru.

Returns:

```js
"session-id"
```

### `client.chat(sessionId, message, opts?)`

Mengirim pesan ke sesi tertentu.

| Option | Type | Default | Keterangan |
| --- | --- | --- | --- |
| `search` | `boolean` | `true` | Aktifkan fitur search DeepSeek web |
| `thinking` | `boolean` | `false` | Aktifkan thinking mode |
| `fileIds` | `string[]` | `[]` | File ID hasil `uploadFile()` |

Returns:

```js
{
  content: "jawaban assistant",
  message_id: "..."
}
```

### `client.chatStream(sessionId, message, opts?)`

Mengirim pesan ke sesi tertentu dan mengembalikan async iterator event streaming.

Event yang dihasilkan:

```js
{ type: "thinking", active: true, message_id: "..." }
{ type: "delta", delta: "...", content: "...", message_id: "..." }
{ type: "done", content: "...", message_id: "..." }
```

### `client.quickChat(message, opts?)`

Shortcut untuk membuat session baru lalu langsung mengirim satu pesan.

### `client.quickChatStream(message, opts?)`

Shortcut untuk membuat session baru lalu langsung streaming satu pesan.

### `client.uploadFile(filePathOrBuffer, filename, mimeType?)`

Upload file ke DeepSeek web.

Returns:

```js
"file-id"
```

### `client.waitForFile(fileId, opts?)`

Polling sampai file selesai diproses.

| Option | Type | Default | Keterangan |
| --- | --- | --- | --- |
| `maxAttempts` | `number` | `10` | Jumlah polling maksimal |
| `intervalMs` | `number` | `2000` | Jeda antar polling dalam ms |

## Error Handling

Library melempar `DeepSeekError` untuk error yang dikenali.

```js
const { DeepSeekClient, DeepSeekError } = require("./deepseek");

try {
  const client = new DeepSeekClient();
  await client.login("wrong@example.com", "wrong-password");
} catch (error) {
  if (error instanceof DeepSeekError) {
    console.error(error.code);
    console.error(error.message);
    console.error(error.data);
  }
}
```

Contoh kode error:

- `AUTH_NO_TOKEN`
- `WAF_FAILED`
- `SESSION_CREATE_FAILED`
- `POW_FAILED`
- `FILE_NOT_FOUND`
- `FILE_TIMEOUT`
- `TIMEOUT`
- `STREAM_ERROR`
- `HTTP_4xx` atau `HTTP_5xx`

## Contoh Implementasi: XyloAI

Folder `ai-chatbot` adalah contoh aplikasi Next.js yang memakai scraper ini sebagai backend chat lokal. Tujuannya hanya menunjukkan cara menghubungkan `DeepSeekClient` ke route API dan UI chatbot, termasuk streaming response bertahap.

Menjalankan contoh UI:

```bash
cd ai-chatbot
npm install
npm run dev
```

Buka:

```text
http://localhost:3000
```

Environment untuk contoh UI:

```env
DEEPSEEK_TOKEN=your-deepseek-web-token
```

Deployment Vercel contoh UI dipisahkan di:

```text
D:\nexaai-vercel
```

## Scraper vs API Resmi DeepSeek

Scraper ini:

- memakai endpoint internal `chat.deepseek.com`
- memakai token web DeepSeek Chat
- perlu WAF, PoW, cookie, dan SSE parser
- cocok untuk eksperimen, riset, dan tooling lokal

API resmi DeepSeek:

- memakai `https://api.deepseek.com`
- memakai `DEEPSEEK_API_KEY`
- lebih stabil untuk production
- punya kontrak API yang lebih jelas

Untuk produk serius, API resmi DeepSeek lebih disarankan.

## Keamanan

- Jangan commit `.env`, `.env.local`, token, password, atau cookie.
- Rotate credential jika pernah terlanjur muncul di file, log, atau chat.
- Gunakan project ini sesuai ToS DeepSeek.
- Anggap internal API DeepSeek tidak stabil dan dapat berubah tanpa pemberitahuan.

## License

MIT
