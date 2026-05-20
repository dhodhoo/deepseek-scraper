import "./globals.css";

export const metadata = {
  title: "XyloAI",
  description: "XyloAI powered through DeepSeek Scraper by DhoDho",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
