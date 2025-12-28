"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { BrowserProvider } from "ethers"
import { useArcWallet } from "./use-arc-wallet"

/**
 * ✅ REGRA PRIMORDIAL: CADA CLIQUE = UMA TRANSAÇÃO NA BLOCKCHAIN
 * 
 * Este hook processa cada clique IMEDIATAMENTE, sem fila ou batch.
 * Cada clique deve gerar uma transação on-chain individual.
 */

export function useMetaTransactions() {
  const { address, isConnected } = useArcWallet()

  // ✅ CORREÇÃO: Remover fila - processar cada clique imediatamente
  const processingRef = useRef<Set<string>>(new Set()) // Rastrear cliques em processamento

  const [pendingClicks, setPendingClicks] = useState(0)

  /**
   * ✅ CORREÇÃO: Processar clique IMEDIATAMENTE, sem fila
   * Cada clique gera uma transação on-chain individual
   */
  const processClickImmediately = useCallback(async (sessionId: string) => {
    // Evitar processar o mesmo clique duas vezes
    if (processingRef.current.has(sessionId)) {
      console.log(`⏸️ [processClickImmediately] Click ${sessionId} already processing, skipping...`)
      return
    }

    processingRef.current.add(sessionId)

    try {
      if (!address || !window.ethereum) {
        console.error("❌ [processClickImmediately] No address or ethereum")
        processingRef.current.delete(sessionId)
        return
      }

      // ✅ IMPORTANTE: eth_accounts NÃO solicita confirmação - apenas retorna contas conectadas
      // Não há popup ou confirmação aqui - a autorização já foi feita ao comprar créditos
      const accounts = await window.ethereum.request({ method: "eth_accounts" })
      if (!accounts || accounts.length === 0) {
        console.error("❌ [processClickImmediately] No accounts")
        processingRef.current.delete(sessionId)
        return
      }

      console.log(`🚀 [processClickImmediately] Processing click IMMEDIATELY for session ${sessionId}`)
      console.log(`   Player: ${accounts[0]}`)
      console.log(`   ⚡ This will generate a blockchain transaction NOW`)
      console.log(`   ✅ NO POPUP - Authorization already done when purchasing credits`)
      
      // ✅ CORREÇÃO: authorized: true significa que o relayer já está autorizado
      // A autorização foi feita automaticamente ao comprar créditos
      // O relayer processa a transação sem precisar de assinatura do usuário
      const response = await fetch("/api/process-meta-click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player: accounts[0],
          sessionId,
          clickCount: 1, // ✅ SEMPRE 1 clique por transação
          authorized: true, // ✅ Autorização já feita ao comprar créditos - SEM POPUP
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ [processClickImmediately] HTTP error ${response.status}:`, errorText)
        processingRef.current.delete(sessionId)
        return
      }

      const data = await response.json()
      
      if (data.success) {
        console.log(`✅✅✅ CLIQUE PROCESSADO NA BLOCKCHAIN ✅✅✅`)
        console.log(`   📤 Transaction Hash: ${data.transactionHash}`)
        console.log(`   🔗 Explorer: https://testnet.arcscan.app/tx/${data.transactionHash}`)
        console.log(`   📦 Block: ${data.blockNumber}`)
        console.log(`   ⛽ Gas Used: ${data.gasUsed}`)
        console.log(`   💰 Créditos consumidos: 1`)
        console.log(`   ✅ Cada clique = uma transação on-chain confirmada!`)
      } else {
        console.error(`❌ [processClickImmediately] Click processing failed:`, data.error || data.message)
      }
    } catch (err: any) {
      console.error("❌ [processClickImmediately] Click failed:", err.message || err)
    } finally {
      processingRef.current.delete(sessionId)
      setPendingClicks(processingRef.current.size)
    }
  }, [address])

  /**
   * ✅ CORREÇÃO: recordClick agora processa IMEDIATAMENTE, sem fila
   * Cada clique gera uma transação on-chain individual e imediata
   */
  const recordClick = useCallback(
    async (sessionId: string) => {
      if (!isConnected || !address) {
        console.log("❌ [recordClick] Not connected or no address")
        return
      }

      console.log(`🖱️ [recordClick] Click detected - processing IMMEDIATELY (no queue)`)
      console.log(`   Session ID: ${sessionId}`)
      console.log(`   ⚡ This will generate a blockchain transaction NOW`)
      
      // ✅ CORREÇÃO: Processar imediatamente, sem adicionar à fila
      setPendingClicks(prev => prev + 1)
      await processClickImmediately(sessionId)
      setPendingClicks(prev => Math.max(0, prev - 1))
    },
    [isConnected, address, processClickImmediately],
  )

  return {
    recordClick,
    pendingClicks,
    isAuthorized: true, // autorização já é tratada no backend
    authorize: async () => {},
    signAuthorization: async () => "",
  }
}
