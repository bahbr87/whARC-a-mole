"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Wallet } from "lucide-react"

// Extend Window interface for wallet detection
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean
      isRabby?: boolean
      isCoinbaseWallet?: boolean
      isTrust?: boolean
      request: (args: { method: string; params?: any[] }) => Promise<any>
      on: (event: string, handler: (args: any) => void) => void
      removeListener: (event: string, handler: any) => void
    }
  }
}

interface WalletInfo {
  name: string
  id: string
  iconUrl: string
  provider: any
  installed: boolean
  installUrl?: string
}

interface WalletSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectWallet: (provider: any) => void
}

export function WalletSelector({ open, onOpenChange, onSelectWallet }: WalletSelectorProps) {
  const [wallets, setWallets] = useState<WalletInfo[]>([])

  useEffect(() => {
    if (typeof window === "undefined") return

    const ethereum = window.ethereum
    
    // Arc Network compatible wallets - Always show all options
    // Based on Arc Network documentation: https://docs.arc.network/
    // Arc Network is EVM-compatible, so all EVM wallets work
    const compatibleWallets: WalletInfo[] = [
      {
        name: "MetaMask",
        id: "metamask",
        iconUrl: "https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/metamask-fox.svg",
        provider: ethereum && (ethereum.isMetaMask || (!ethereum.isRabby && !ethereum.isCoinbaseWallet && !ethereum.isTrust)) ? ethereum : null,
        installed: !!ethereum,
        installUrl: "https://metamask.io/download/",
      },
      {
        name: "Rabby",
        id: "rabby",
        iconUrl: "https://static.rabby.io/logo.png",
        provider: ethereum?.isRabby ? ethereum : null,
        installed: !!ethereum?.isRabby,
        installUrl: "https://rabby.io/",
      },
      {
        name: "Coinbase Wallet",
        id: "coinbase",
        iconUrl: "https://images.ctfassets.net/9sy2a00egiw8/5EmFq3aXv3Ri9o4fcn5Lf0/4e30b6c83b7b9a5b8e5e5e5e5e5e5e5e/coinbase-wallet-logo.svg",
        provider: ethereum?.isCoinbaseWallet ? ethereum : null,
        installed: !!ethereum?.isCoinbaseWallet,
        installUrl: "https://www.coinbase.com/wallet",
      },
      {
        name: "Trust Wallet",
        id: "trust",
        iconUrl: "https://trustwallet.com/assets/images/media/assets/TWT.png",
        provider: ethereum?.isTrust ? ethereum : null,
        installed: !!ethereum?.isTrust,
        installUrl: "https://trustwallet.com/",
      },
    ]

    setWallets(compatibleWallets)
  }, [open]) // Re-run when dialog opens to refresh wallet detection

  const handleWalletClick = async (wallet: WalletInfo) => {
    // If wallet is not installed, open install page
    if (!wallet.installed) {
      if (wallet.installUrl) {
        window.open(wallet.installUrl, "_blank")
      }
      onOpenChange(false)
      return
    }

    // If wallet is installed but no specific provider, use window.ethereum as fallback
    const provider = wallet.provider || (typeof window !== "undefined" ? window.ethereum : null)
    
    if (provider) {
      // Close dialog first, then try to connect (connection happens in wallet-gate)
      onOpenChange(false)
      // Small delay to ensure dialog closes before connection attempt
      setTimeout(() => {
        onSelectWallet(provider)
      }, 100)
    } else {
      // No provider available, open install page
      if (wallet.installUrl) {
        window.open(wallet.installUrl, "_blank")
      }
      onOpenChange(false)
    }
  }

  const handleDialogClose = (open: boolean) => {
    // When dialog is closed (by clicking outside or X button), just close it
    // Don't trigger any connection attempt
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="text-2xl font-bold text-center">Select Wallet</DialogTitle>
        <DialogDescription className="text-center">
          Choose a wallet to connect to the game
        </DialogDescription>
        <div className="space-y-2 mt-4">
          {wallets.map((wallet) => (
            <Button
              key={wallet.id}
              onClick={() => handleWalletClick(wallet)}
              variant="outline"
              className="w-full justify-start h-auto py-4 px-4 hover:bg-amber-50"
              disabled={false}
            >
              <div className="flex items-center gap-3 w-full">
                <img 
                  src={wallet.iconUrl} 
                  alt={wallet.name}
                  className="w-8 h-8 object-contain flex-shrink-0"
                  onError={(e) => {
                    // Fallback to wallet icon if image fails to load
                    const target = e.currentTarget
                    target.style.display = 'none'
                    const fallback = document.createElement('div')
                    fallback.className = 'w-8 h-8 flex items-center justify-center'
                    fallback.innerHTML = '<svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>'
                    target.parentElement?.insertBefore(fallback, target)
                  }}
                />
                <div className="flex-1 text-left">
                  <div className="font-semibold">{wallet.name}</div>
                  {!wallet.installed && (
                    <div className="text-xs text-gray-500">Click to install</div>
                  )}
                </div>
                {wallet.installed && (
                  <Wallet className="w-5 h-5 text-green-600" />
                )}
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

