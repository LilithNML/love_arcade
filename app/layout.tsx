import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://love-arcade.vercel.app'),
  title: {
    default: 'Love Arcade',
    template: '%s | Love Arcade',
  },
  description: 'Arcade modular con múltiples motores de juego y persistencia con Supabase.',
  applicationName: 'Love Arcade',
  icons: { icon: '/assets/icon/icon.png' },
  openGraph: {
    title: 'Love Arcade',
    description: 'Arcade social con economía, eventos y tienda.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
