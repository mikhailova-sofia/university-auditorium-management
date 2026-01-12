import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Учет занятости аудиторий ВУЗа',
  description: 'Система автоматизации учета занятости аудиторий',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=5',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}

