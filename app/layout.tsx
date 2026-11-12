import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'CINDY — One more round.', description: '20 minutes. Three exercises. One button. A focused Cindy workout companion.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#FFFFFF', viewportFit: 'cover' };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body>{children}</body></html> }
