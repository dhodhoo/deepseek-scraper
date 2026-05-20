@echo off
setlocal

cd /d "%~dp0"

set "TMP_JS=%TEMP%\get-deepseek-token-%RANDOM%-%RANDOM%.js"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$bat = '%~f0'; $text = Get-Content -Raw -LiteralPath $bat; $parts = [regex]::Split($text, '-----BEGIN-JS-----\r?\n', 2); if ($parts.Count -lt 2) { throw 'Marker JavaScript tidak ditemukan.' }; Set-Content -LiteralPath $env:TMP_JS -Value $parts[1] -Encoding UTF8"

if errorlevel 1 (
  echo Gagal membuat script sementara.
  pause
  exit /b 1
)

node "%TMP_JS%"
set "EXIT_CODE=%ERRORLEVEL%"

del "%TMP_JS%" >nul 2>nul

echo.
if not "%EXIT_CODE%"=="0" (
  echo Proses gagal. Pastikan Node.js tersedia dan .env berisi DEEPSEEK_EMAIL serta DEEPSEEK_PASSWORD.
)

pause
exit /b %EXIT_CODE%

-----BEGIN-JS-----
const fs = require('fs');
const path = require('path');
const { DeepSeekClient } = require(path.join(process.cwd(), 'deepseek'));

const envPath = path.join(process.cwd(), '.env');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const data = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const index = trimmed.indexOf('=');
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    data[key] = value;
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return data;
}

function upsertEnv(text, key, value) {
  const lines = text ? text.split(/\r?\n/) : [];
  const next = [];
  let found = false;

  for (const line of lines) {
    if (line.trim().startsWith(`${key}=`)) {
      next.push(`${key}=${value}`);
      found = true;
    } else {
      next.push(line);
    }
  }

  if (!found) next.push(`${key}=${value}`);
  return next.join('\n').replace(/\n*$/, '\n');
}

function syncToken(filePath, token) {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  fs.writeFileSync(filePath, upsertEnv(current, 'DEEPSEEK_TOKEN', token));
}

(async () => {
  const env = loadEnv(envPath);

  if (!env.DEEPSEEK_EMAIL || !env.DEEPSEEK_PASSWORD) {
    throw new Error('DEEPSEEK_EMAIL dan DEEPSEEK_PASSWORD wajib diisi di .env');
  }

  const client = new DeepSeekClient();
  const result = await client.login(env.DEEPSEEK_EMAIL, env.DEEPSEEK_PASSWORD);

  if (!result?.token) {
    throw new Error('Login berhasil, tapi token tidak ditemukan.');
  }

  syncToken(envPath, result.token);

  const uiEnvPath = path.join(process.cwd(), 'ai-chatbot', '.env.local');
  if (fs.existsSync(path.dirname(uiEnvPath))) {
    syncToken(uiEnvPath, result.token);
  }

  console.log('');
  console.log('TOKEN BERHASIL DIDAPATKAN');
  console.log('');
  console.log(result.token);
  console.log('');
  console.log('Token juga sudah disimpan ke:');
  console.log('- .env');
  if (fs.existsSync(path.dirname(uiEnvPath))) console.log('- ai-chatbot/.env.local');
})().catch((error) => {
  console.error('');
  console.error('GAGAL MENDAPATKAN TOKEN');
  console.error(error.message || error);
  if (error.code) console.error('Code:', error.code);
  process.exit(1);
});
