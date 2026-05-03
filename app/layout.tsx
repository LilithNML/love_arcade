import type { Metadata } from 'next';
import { Inter, Orbitron } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const orbitron = Orbitron({ subsets: ['latin'], variable: '--font-orbitron', weight: ['500', '700'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://love-arcade.vercel.app'),
  title: {
    default: 'Love Arcade',
    template: '%s | Love Arcade',
  },
  description: 'Arcade modular con múltiples motores de juego y persistencia con Supabase.',
  applicationName: 'Love Arcade',
  icons: {
    icon: '/assets/icon/icon.png',
  },
  openGraph: {
    title: 'Love Arcade',
    description: 'Arcade social con economía, eventos y tienda.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${orbitron.variable}`}>{children}</body>
    </html>
  );
}
