import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "whARC-a-mole - Blockchain Arcade Game",
  description: "A fun whack-a-mole style game on ARC testnet",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon.png",
        type: "image/png",
      },
      {
        url: "/favicon.png",
        type: "image/png",
      },
    ],
    apple: "/icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
