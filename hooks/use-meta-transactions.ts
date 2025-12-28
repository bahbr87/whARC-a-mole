"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { BrowserProvider } from "ethers"

/**
 * ✅ REGRA PRIMORDIAL: CADA CLIQUE = UMA TRANSAÇÃO NA BLOCKCHAIN
 * 
 * Este hook processa cada clique IMEDIATAMENTE, sem fila ou batch.
 * Cada clique deve gerar uma transação on-chain individual.
 * 
 * ✅ CORREÇÃO: Agora aceita walletAddress como parâmetro para garantir sincronização
 */

export function useMetaTransactions(walletAddress?: string) {
  // ✅ CORREÇÃO: Usar walletAddress passado como parâmetro (fonte da verdade)
  // walletAddress vem do GameScreen e é a fonte confiável de conexão
  const address = walletAddress && walletAddress.trim() !== "" ? walletAddress : null
  const isConnected = !!address && typeof window !== "undefined" && !!window.ethereum
  
  // ✅ CORREÇÃO: Log para debug
  useEffect(() => {
    console.log(`🔍 [useMetaTransactions] walletAddress: ${walletAddress}, address: ${address}, isConnected: ${isConnected}`)
  }, [walletAddress, address, isConnected])

  // ✅ CORREÇÃO: Remover fila - processar cada clique imediatamente
  const processingRef = useRef<Set<string>>(new Set()) // Rastrear cliques em processamento

  const [pendingClicks, setPendingClicks] = useState(0)

  /**
   * ✅ CORREÇÃO: Processar clique IMEDIATAMENTE, sem fila
   * Cada clique gera uma transação on-chain individual
   * Retorna true se processado com sucesso, false caso contrário
   */
  const processClickImmediately = useCallback(async (sessionId: string): Promise<boolean> => {
    // Evitar processar o mesmo clique duas vezes
    if (processingRef.current.has(sessionId)) {
      console.log(`⏸️ [processClickImmediately] Click ${sessionId} already processing, skipping...`)
      return false
    }

    processingRef.current.add(sessionId)

    try {
      // ✅ CORREÇÃO: Usar address diretamente (vem de walletAddress, fonte da verdade)
      // Não depender de eth_accounts que pode falhar ou retornar vazio
      if (!address || address.trim() === "" || !window.ethereum) {
        console.error("❌ [processClickImmediately] No address or ethereum")
        console.error("   address:", address)
        console.error("   window.ethereum:", !!window.ethereum)
        processingRef.current.delete(sessionId)
        return false
      }

      // ✅ CORREÇÃO: Usar address diretamente, sem chamar eth_accounts
      // walletAddress já foi validado no GameScreen e é a fonte confiável
      const playerAddress = address.toLowerCase() // Normalizar para lowercase
      
      console.log(`🚀 [processClickImmediately] Processing click IMMEDIATELY for session ${sessionId}`)
      console.log(`   Player: ${playerAddress}`)
      console.log(`   ⚡ This will generate a blockchain transaction NOW`)
      console.log(`   ✅ NO POPUP - Authorization already done when purchasing credits`)
      
      // ✅ CORREÇÃO: authorized: true significa que o relayer já está autorizado
      // A autorização foi feita automaticamente ao comprar créditos
      // O relayer processa a transação sem precisar de assinatura do usuário
      const response = await fetch("/api/process-meta-click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player: playerAddress, // ✅ Usar address diretamente, sem depender de eth_accounts
          sessionId,
          clickCount: 1, // ✅ SEMPRE 1 clique por transação
          authorized: true, // ✅ Autorização já feita ao comprar créditos - SEM POPUP
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ [processClickImmediately] HTTP error ${response.status}:`, errorText)
        processingRef.current.delete(sessionId)
        return false
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
        processingRef.current.delete(sessionId)
        return true // ✅ Retorna true para indicar sucesso
      } else {
        console.error(`❌ [processClickImmediately] Click processing failed:`, data.error || data.message)
        processingRef.current.delete(sessionId)
        return false
      }
    } catch (err: any) {
      console.error("❌ [processClickImmediately] Click failed:", err.message || err)
      processingRef.current.delete(sessionId)
      return false
    } finally {
      setPendingClicks(processingRef.current.size)
    }
  }, [address])

  /**
   * ✅ CORREÇÃO: recordClick agora processa IMEDIATAMENTE, sem fila
   * Cada clique gera uma transação on-chain individual e imediata
   * Retorna true se processado com sucesso, false caso contrário
   */
  const recordClick = useCallback(
    async (sessionId: string): Promise<boolean> => {
      if (!isConnected || !address) {
        console.error("❌ [recordClick] Not connected or no address - click NOT processed")
        console.error("   isConnected:", isConnected)
        console.error("   address:", address)
        return false // ✅ Retorna false para indicar que NÃO foi processado
      }

      console.log(`🖱️ [recordClick] Click detected - processing IMMEDIATELY (no queue)`)
      console.log(`   Session ID: ${sessionId}`)
      console.log(`   ⚡ This will generate a blockchain transaction NOW`)
      
      // ✅ CORREÇÃO: Processar imediatamente, sem adicionar à fila
      setPendingClicks(prev => prev + 1)
      const success = await processClickImmediately(sessionId)
      setPendingClicks(prev => Math.max(0, prev - 1))
      return success // ✅ Retorna o resultado do processamento
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
