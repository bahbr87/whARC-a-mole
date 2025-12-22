"use client"

import { Button } from "@/components/ui/button"

export function FooterButton() {
  return (
    <footer className="fixed bottom-4 right-4 z-50">
      <Button
        variant="outline"
        size="icon"
        className="rounded-full w-12 h-12 border-4 border-amber-900 bg-white/95 hover:bg-amber-50 text-amber-900"
        onClick={() => {
          // Navigate to game profile
          window.location.href = "/profile"
        }}
      >
        <span className="text-xl font-bold">X</span>
      </Button>
    </footer>
  )
}







