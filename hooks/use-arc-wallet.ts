"use client"

import { useState, useCallback, useEffect } from "react"
import { BrowserProvider, Contract, parseUnits } from "ethers"
import { ARC_NETWORK, USDC_CONTRACT_ADDRESS, ERC20_ABI } from "@/lib/arc-config"

interface UseArcWalletReturn {
  address: string | null
  isConnected: boolean
  connect: (customProvider?: any) => Promise<void>
  disconnect: () => Promise<void>
  changeWallet: () => Promise<void>
  sendUSDC: (to: string, amount: number) => Promise<string>
  provider: BrowserProvider | null
}

export function useArcWallet(): UseArcWalletReturn {
  const [address, setAddress] = useState<string | null>(null)
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const switchToArcNetwork = useCallback(async () => {
    if (!window.ethereum) throw new Error("No wallet found")

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${ARC_NETWORK.chainId.toString(16)}` }],
      })
    } catch (switchError: any) {
      // User rejected network switch - return silently (handled by caller)
      if (switchError.code === 4001) {
        throw switchError // Re-throw to be handled by caller
      }
      
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: `0x${ARC_NETWORK.chainId.toString(16)}`,
                chainName: ARC_NETWORK.name,
                nativeCurrency: {
                  name: ARC_NETWORK.currency,
                  symbol: ARC_NETWORK.currency,
                  decimals: 6, // USDC has 6 decimals
                },
                rpcUrls: ARC_NETWORK.rpcUrls.default.http,
                blockExplorerUrls: [ARC_NETWORK.blockExplorers.default.url],
              },
            ],
          })
        } catch (addError: any) {
          // User rejected adding network - re-throw to be handled by caller
          if (addError.code === 4001) {
            throw addError // Re-throw to be handled by caller
          }
          console.error("Error adding Arc network:", addError)
          throw addError
        }
      } else {
        throw switchError
      }
    }
  }, [])

  // DISABLED: Auto-connect on page load
  // Users must manually connect wallet on the initial screen to avoid showing stale addresses
  // useEffect(() => {
  //   const checkConnection = async () => {
  //     if (typeof window === "undefined" || !window.ethereum) {
  //       return
  //     }

  //     try {
  //       const accounts = await window.ethereum.request({ method: "eth_accounts" })
  //       if (accounts.length > 0) {
  //         const provider = new BrowserProvider(window.ethereum)
  //         const signer = await provider.getSigner()
  //         const address = await signer.getAddress()
  //         setAddress(address)
  //         setProvider(provider)
  //         setIsConnected(true)
  //       }
  //     } catch (error) {
  //       // Silently fail - user will need to connect manually
  //       console.log("No existing wallet connection")
  //     }
  //   }

  //   checkConnection()
  // }, [])

  const disconnect = useCallback(async () => {
    setAddress(null)
    setProvider(null)
    setIsConnected(false)
    
    // Try to revoke permissions to ensure popup appears next time
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        await window.ethereum.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        })
      } catch (error) {
        // Some wallets don't support revokePermissions, that's okay
        console.log("Could not revoke permissions:", error)
      }
      
      // Remove event listeners
      window.ethereum.removeListener("accountsChanged", () => {})
      window.ethereum.removeListener("chainChanged", () => {})
    }
  }, [])

  const changeWallet = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("Please install a Web3 wallet like MetaMask or Arc Wallet")
    }

    try {
      // Disconnect first (this will revoke permissions)
      await disconnect()
      
      // Wait a bit for disconnect to complete
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Request permissions explicitly - this should show the popup
      let accounts: string[] = []
      try {
        const permissions = await window.ethereum.request({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }],
        })
        // Get accounts from the permissions result or request them
        accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        })
      } catch (permError: any) {
        // If wallet_requestPermissions fails, fall back to eth_requestAccounts
        if (permError.code === 4001) {
          // User rejected the request - return silently
          return // Silent return - user cancelled, no error thrown
        }
        try {
          accounts = await window.ethereum.request({
            method: "eth_requestAccounts",
          })
        } catch (requestError: any) {
          if (requestError.code === 4001) {
            // User rejected the request - return silently
            return // Silent return - user cancelled, no error thrown
          }
          throw requestError
        }
      }

      if (accounts.length === 0) {
        throw new Error("No accounts found")
      }

      const provider = new BrowserProvider(window.ethereum)
      const network = await provider.getNetwork()

      // Switch to Arc network if not already connected
      if (Number(network.chainId) !== ARC_NETWORK.chainId) {
        try {
          await switchToArcNetwork()
          // Re-fetch provider after network switch
          const newProvider = new BrowserProvider(window.ethereum)
          setProvider(newProvider)
        } catch (switchErr: any) {
          // If user rejected network switch, return silently
          if (switchErr.code === 4001) {
            return // Silent return - user cancelled network switch
          }
          throw switchErr
        }
      } else {
        setProvider(provider)
      }

      const signer = await provider.getSigner()
      const address = await signer.getAddress()
      setAddress(address)
      setIsConnected(true)

      // Listen for account changes
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          setAddress(null)
          setProvider(null)
          setIsConnected(false)
        } else {
          setAddress(accounts[0])
        }
      }

      const handleChainChanged = () => {
        window.location.reload()
      }

      window.ethereum.on("accountsChanged", handleAccountsChanged)
      window.ethereum.on("chainChanged", handleChainChanged)
    } catch (error) {
      console.error("Error changing wallet:", error)
      throw error
    }
  }, [disconnect, switchToArcNetwork])

  const connect = useCallback(async (customProvider?: any) => {
    const ethereumProvider = customProvider || (typeof window !== "undefined" ? window.ethereum : null)
    
    if (!ethereumProvider) {
      throw new Error("Please install a Web3 wallet like MetaMask or Arc Wallet")
    }

    try {
      // Request account access - this should show the popup
      let accounts: string[] = []
      try {
        accounts = await ethereumProvider.request({
          method: "eth_requestAccounts",
        })
      } catch (error: any) {
        // If user rejected (code 4001), return silently without throwing
        if (error.code === 4001) {
          return // Silent return - user cancelled, no error thrown
        }
        throw error
      }

      if (accounts.length === 0) {
        throw new Error("No accounts found")
      }

      const provider = new BrowserProvider(ethereumProvider)
      const network = await provider.getNetwork()

      // Switch to Arc network if not already connected
      if (Number(network.chainId) !== ARC_NETWORK.chainId) {
        // Use the custom provider or window.ethereum for network switching
        const providerForSwitch = customProvider || (typeof window !== "undefined" ? window.ethereum : null)
        if (providerForSwitch) {
          try {
            await providerForSwitch.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: `0x${ARC_NETWORK.chainId.toString(16)}` }],
            })
          } catch (switchError: any) {
            if (switchError.code === 4902) {
              await providerForSwitch.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: `0x${ARC_NETWORK.chainId.toString(16)}`,
                    chainName: ARC_NETWORK.name,
                    nativeCurrency: {
                      name: ARC_NETWORK.currency,
                      symbol: ARC_NETWORK.currency,
                      decimals: 18,
                    },
                    rpcUrls: ARC_NETWORK.rpcUrls.default.http,
                    blockExplorerUrls: [ARC_NETWORK.blockExplorers.default.url],
                  },
                ],
              })
            } else if (switchError.code === 4001) {
              // User rejected network switch - return silently
              return // Silent return - user cancelled network switch
            } else {
              throw switchError
            }
          }
        }
        // Re-fetch provider after network switch
        const newProvider = new BrowserProvider(ethereumProvider)
        setProvider(newProvider)
      } else {
        setProvider(provider)
      }

      const signer = await provider.getSigner()
      const address = await signer.getAddress()
      setAddress(address)
      setIsConnected(true)

      // Listen for account changes
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          setAddress(null)
          setProvider(null)
          setIsConnected(false)
        } else {
          setAddress(accounts[0])
        }
      }

      const handleChainChanged = () => {
        window.location.reload()
      }

      ethereumProvider.on("accountsChanged", handleAccountsChanged)
      ethereumProvider.on("chainChanged", handleChainChanged)
    } catch (error: any) {
      // If user rejected (code 4001), return silently without throwing
      if (error.code === 4001) {
        return // Silent return - user cancelled, no error thrown
      }
      
      // Log error details for debugging
      const errorMessage = error?.message || error?.toString() || "Unknown error"
      const errorCode = error?.code || "NO_CODE"
      console.error("Error connecting wallet:", {
        message: errorMessage,
        code: errorCode,
        error: error
      })
      
      // Throw a more descriptive error
      throw new Error(errorMessage || "Failed to connect wallet")
    }
  }, [switchToArcNetwork])

  const sendUSDC = useCallback(
    async (to: string, amount: number): Promise<string> => {
      // Check if we have an address (either from state or from window.ethereum)
      let currentAddress = address
      let currentProvider = provider

      // If provider or address is missing, try to get from window.ethereum
      if (!currentProvider || !currentAddress) {
        if (typeof window === "undefined" || !window.ethereum) {
          throw new Error("Wallet not connected. Please connect your wallet first.")
        }

        try {
          // Get current accounts
          const accounts = await window.ethereum.request({ method: "eth_accounts" })
          if (accounts.length === 0) {
            throw new Error("Wallet not connected. Please connect your wallet first.")
          }

          currentAddress = accounts[0]
          currentProvider = new BrowserProvider(window.ethereum)
        } catch (error: any) {
          throw new Error("Wallet not connected. Please connect your wallet first.")
        }
      }

      if (USDC_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
        throw new Error("USDC contract address not configured")
      }

      try {
        const signer = await currentProvider.getSigner()
        const contract = new Contract(USDC_CONTRACT_ADDRESS, ERC20_ABI, signer)

        // USDC has 6 decimals
        const amountInWei = parseUnits(amount.toString(), 6)

        const tx = await contract.transfer(to, amountInWei)
        await tx.wait()

        return tx.hash
      } catch (error) {
        console.error("Error sending USDC:", error)
        throw error
      }
    },
    [provider, address],
  )

  return {
    address,
    isConnected,
    connect,
    disconnect,
    changeWallet,
    sendUSDC,
    provider,
  }
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>
      on: (event: string, callback: (args: any) => void) => void
      removeListener: (event: string, callback: (args: any) => void) => void
    }
  }
}

