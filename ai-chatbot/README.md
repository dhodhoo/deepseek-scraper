# XyloAI

Next.js chatbot UI yang terhubung ke scraper DeepSeek di folder parent.

## Setup

Jalankan dari root repo:

```bash
npm install
```

Lalu jalankan dari folder ini:

```bash
npm install
npm run dev
```

Token DeepSeek dibaca dari `.env.local`:

```bash
DEEPSEEK_TOKEN=your-token
```

## Scripts

- `npm run dev` menjalankan development server dengan webpack.
- `npm run build` membuat production build.
- `npm run start` menjalankan hasil production build.
