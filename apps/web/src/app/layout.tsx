import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ghost Developer Studio',
  description: 'Realtime collaborative developer operating system',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-ghost-bg text-ghost-text font-sans antialiased overflow-hidden">
        {children}
      </body>
    </html>
  )
}
