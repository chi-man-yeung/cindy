import type { Metadata, Viewport } from 'next';
import './globals.css';
import {LanguageProvider} from '@/components/language';
import Pwa from '@/components/pwa';
export const metadata: Metadata = { manifest:'/manifest.webmanifest', appleWebApp:{capable:true,title:'CINDY',statusBarStyle:'default'}, icons:{icon:'/icons/icon-192.png',apple:'/icons/icon-180.png'}, title: 'CINDY — One more round.', description: '20 minutes. Three exercises. One button. A focused Cindy workout companion.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#142D4E', viewportFit: 'cover' };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body><LanguageProvider>{children}<div style={{padding:20,maxWidth:1160,margin:"auto",paddingBottom:"calc(90px + env(safe-area-inset-bottom))"}}><Pwa/></div></LanguageProvider></body></html> }
