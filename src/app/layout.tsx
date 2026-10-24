import type { Metadata } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';
export const metadata:Metadata={title:'ATLAS — Local market intelligence',description:'Explore mapped business evidence in New York, London, Dubai, and Singapore.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
