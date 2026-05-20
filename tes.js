"use strict";

const fs = require("fs");
const path = require("path");
const { DeepSeekClient } = require("./deepseek");

function loadEnv(filePath = path.join(__dirname, ".env")) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnv();

  const email = process.env.DEEPSEEK_EMAIL;
  const password = process.env.DEEPSEEK_PASSWORD;

  if (!email || !password) {
    throw new Error("DEEPSEEK_EMAIL dan DEEPSEEK_PASSWORD wajib diisi di .env");
  }

  const client = new DeepSeekClient();

  await client.login(email, password);
  console.log("Login berhasil!");

  const reply = await client.quickChat("Halo! Siapa kamu?");
  console.log("Reply:", reply.content);

  /*
  client.setToken(process.env.DEEPSEEK_TOKEN);
  console.log('Token set!');

  const sessionId = await client.createSession();

  const r1 = await client.chat(sessionId, 'nama gw xai cuy');
  console.log('Turn 1:', r1.content);

  const r2 = await client.chat(sessionId, 'tadi nama gw siapa?');
  console.log('Turn 2:', r2.content);

  const fileId = await client.uploadFile('./foto.jpg', 'foto.jpg', 'image/jpeg');
  await client.waitForFile(fileId);
  const r3 = await client.chat(sessionId, 'ini gambar apa?', { fileIds: [fileId] });
  console.log('Chat + file:', r3.content);

  await client.logout();
  console.log('Done!');
  */
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
