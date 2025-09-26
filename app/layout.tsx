import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GCI — Guidance Credibility Index',
  description: 'Multi-company guidance credibility explorer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white antialiased text-neutral-900">{children}</body>
    </html>
  );
}


