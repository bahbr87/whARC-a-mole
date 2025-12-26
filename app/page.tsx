"use client"

import { useState, useCallback, useEffect } from "react"
import { BrowserProvider, Contract } from "ethers"
import { WalletGate } from "@/components/wallet-gate"
import { GameScreen } from "@/components/game-screen"
import { ResultsScreen } from "@/components/results-screen"
import  RankingScreen from "@/components/ranking-screen"
import { DailyResultsScreen } from "@/components/daily-results-screen"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { WalletProvider, useWallet } from "@/contexts/wallet-context"
import { getRankings, saveRanking } from "@/lib/api"
import { getDayId } from "@/utils/day"
import { useDailyResultsPopup } from "@/hooks/use-daily-results-popup"

export type GameDifficulty = "easy" | "medium" | "hard"
export type GameState = "wallet" | "game" | "results" | "ranking" | "daily-results"

export interface GameSession {
  score: number
  goldenMolesHit: number
  errors: number
}

export interface RankingEntry {
  player: string
  score: number
  goldenMoles: number
  errors: number
  timestamp: number
  day?: number // Optional day field
}

function WharcAMoleContent() {
  const { sendUSDC, address: walletAddress } = useWallet()
  const [walletConnected, setWalletConnected] = useState(false)
  const [address, setAddress] = useState("")
  const [username, setUsername] = useState("")
  const [gameState, setGameState] = useState<GameState>("wallet")
  const [difficulty, setDifficulty] = useState<GameDifficulty>("easy")
  const [sessionData, setSessionData] = useState<GameSession>({
    score: 0,
    goldenMolesHit: 0,
    errors: 0,
  })
  // Load rankings from API on mount
  const [rankings, setRankings] = useState<RankingEntry[]>([])
  const [rankingsLoaded, setRankingsLoaded] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  
  // ✅ Use the new hook for daily results popup
  const { showPopup, handleClose, yesterdayDayId } = useDailyResultsPopup()

  // Load ALL rankings from API on mount (historical persistence)
  useEffect(() => {
    const loadRankings = async () => {
      if (rankingsLoaded) return
      
      try {
        // Load ALL rankings (no date filter - historical persistence)
        const loadedRankings = await getRankings()
        setRankings(loadedRankings)
        setRankingsLoaded(true)
      } catch (error) {
        console.error("Error loading rankings:", error)
        setRankingsLoaded(true) // Set to true even on error to prevent infinite retries
      }
    }

    loadRankings()
  }, [rankingsLoaded])

  useEffect(() => {
    // Suppress CORS warnings from v0 preview environment
    const originalError = console.error
    const originalWarn = console.warn

    console.error = (...args) => {
      const message = String(args[0] || "")
      if (
        message.includes("origins don't match") ||
        message.includes("v0.app") ||
        message.includes("vusercontent.net")
      ) {
        return
      }
      originalError.apply(console, args)
    }

    console.warn = (...args) => {
      const message = String(args[0] || "")
      if (
        message.includes("origins don't match") ||
        message.includes("v0.app") ||
        message.includes("vusercontent.net")
      ) {
        return
      }
      originalWarn.apply(console, args)
    }

    return () => {
      console.error = originalError
      console.warn = originalWarn
    }
  }, [])

  const handleWalletConnect = useCallback((playerUsername: string, walletAddr: string) => {
    setWalletConnected(true)
    setAddress(walletAddr)
    setUsername(playerUsername)
    setGameState("game")
    
    // Save username to localStorage (also saved in WalletGate, but keeping here for consistency)
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`wharcamole_username_${walletAddr.toLowerCase()}`, playerUsername)
      } catch (error) {
        console.error("Error saving username:", error)
      }
    }
  }, [])

  const handleGameComplete = useCallback(
    async (data: GameSession) => {
      console.log("🎮 handleGameComplete called with data:", data)
      console.log("   Score:", data.score)
      console.log("   Golden moles:", data.goldenMolesHit)
      console.log("   Errors:", data.errors)
      console.log("   Current address:", address)
      
      // Always set session data FIRST
      setSessionData(data)
      console.log("✅ Session data set")
      
      // Always show results screen IMMEDIATELY (before async operations)
      console.log("📊 Setting gameState to 'results'")
      setGameState("results")
      console.log("✅ GameState set to results")
      
      // Only save to API if address is available (async, doesn't block UI)
      if (address) {
        try {
          const timestamp = Date.now()
          const day = getDayId(new Date(timestamp))
          
          const newEntry: RankingEntry = {
            player: address, // Use wallet address instead of username
            score: data.score,
            goldenMoles: data.goldenMolesHit,
            errors: data.errors,
            timestamp,
            day, // Include day in the entry
          }
          
          // Save match to Supabase (for daily ranking) via API
          try {
            await fetch("/api/saveMatch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ player: address, points: data.score })
            })
          } catch (err) {
            console.error("Erro ao salvar pontos:", err)
          }
          
          // Save to API
          const saved = await saveRanking(newEntry)
          if (saved) {
            setRankings((prev) => [...prev, newEntry])
          } else {
            // Fallback: save locally if API fails
            setRankings((prev) => [...prev, newEntry])
            console.warn("Failed to save ranking to API, saved locally only")
          }
        } catch (error) {
          console.error("Error saving ranking:", error)
        }
      } else {
        console.warn("⚠️  No address available, skipping ranking save")
      }
    },
    [address],
  )

  const handlePlayAgain = useCallback(() => {
    setGameState("game")
  }, [])

  const handleViewRanking = useCallback(() => {
    setGameState("ranking")
  }, [])

  const handleBackToGame = useCallback(() => {
    setGameState("game")
  }, [])

  const handleDisconnect = useCallback(() => {
    setWalletConnected(false)
    setAddress("")
    setUsername("")
    setGameState("wallet")
  }, [])

  const handleClaimPrize = useCallback(async (date: Date, _rank?: number, providedDay?: number) => {
    // ✅ PROIBIDO recalcular day - usar providedDay se disponível
    // Note: rank parameter is kept for compatibility but not used
    // The new contract uses claim(day) which finds the user's rank automatically
    if (typeof window === "undefined" || !window.ethereum) {
      alert("Wallet não conectada")
      return
    }

    try {
      const provider = new BrowserProvider(window.ethereum)

      // 🔒 FORÇA sincronização com a wallet ativa
      try {
        await provider.send("eth_requestAccounts", [])
      } catch (err: any) {
        // Check if user rejected the request (code 4001)
        if (err?.code === 4001 || err?.message?.includes("rejected") || err?.message?.includes("denied") || err?.message?.includes("User rejected")) {
          alert("Transação rejeitada pelo usuário")
          return
        }
        throw err
      }

      // 🔒 SEMPRE pega o signer ATIVO
      const signer = await provider.getSigner()
      const signerAddressRaw = await signer.getAddress()
      const signerAddress = signerAddressRaw.toLowerCase()

      const PRIZE_POOL_ADDRESS =
        process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS!

      const PRIZE_POOL_ABI = [
        "function claim(uint256 day) external",
        "function getWinner(uint256 day, uint256 rank) view returns (address)",
        "function winners(uint256 day, uint256 rank) view returns (address)",
        "function claimed(uint256 day, address user) view returns (bool)",
        "function canClaim(uint256 day, address user) view returns (bool)",
        "function totalPlayers(uint256 day) view returns (uint256)",
      ]

      // ✅ USAR providedDay se disponível (NUNCA recalcular)
      const day = providedDay !== undefined ? providedDay : getDayId(date)
      console.log("🔍 [CLAIM] Day usage:")
      console.log("   - date:", date.toISOString())
      console.log("   - providedDay:", providedDay)
      console.log("   - day used (providedDay || getDayId):", day)
      console.log("   - day type:", typeof day)
      console.log("   - signerAddress:", signerAddress)
      console.log("🔍 [CLAIM] DAY USED FOR CLAIM:", day)

      const readContract = new Contract(
        PRIZE_POOL_ADDRESS,
        PRIZE_POOL_ABI,
        provider
      )

      const writeContract = new Contract(
        PRIZE_POOL_ADDRESS,
        PRIZE_POOL_ABI,
        signer
      )

      // Verificar se pode fazer claim usando canClaim
      let canClaimResult = false
      try {
        console.log("🔍 [CLAIM] Checking canClaim:")
        console.log("   - day sent to canClaim:", day)
        console.log("   - day type:", typeof day)
        console.log("   - signerAddress sent to canClaim:", signerAddress)
        canClaimResult = await readContract.canClaim(day, signerAddress)
        console.log("🔍 [CLAIM] canClaim result:")
        console.log("   - canClaim(day=" + day + ", user=" + signerAddress + "):", canClaimResult)
        console.log("   - canClaim type:", typeof canClaimResult)
      } catch (error: any) {
        console.error("🔍 [CLAIM] canClaim ERROR:", error.message)
        console.warn("canClaim não disponível, verificando manualmente:", error.message)
      }

      // Se canClaim retornar false, verificar por que
      if (!canClaimResult) {
        // Verificar se já foi claimado
        let alreadyClaimed = false
        try {
          console.log("🔍 [CLAIM] Checking claimed status:")
          console.log("   - day sent to claimed:", day)
          console.log("   - signerAddress sent to claimed:", signerAddress)
          alreadyClaimed = await readContract.claimed(day, signerAddress)
          console.log("🔍 [CLAIM] claimed result:")
          console.log("   - claimed(day=" + day + ", user=" + signerAddress + "):", alreadyClaimed)
        } catch (error: any) {
          console.error("🔍 [CLAIM] claimed() ERROR:", error.message)
          console.warn("claimed check failed:", error.message)
        }

        if (alreadyClaimed) {
          console.log("🔍 [CLAIM] User already claimed, aborting")
          alert("Prize already claimed")
          return
        }

        // Verificar se é vencedor em algum rank
        let isWinner = false
        let winnerRank = 0
        console.log("🔍 [CLAIM] Checking if user is winner for any rank:")
        for (let r = 1; r <= 3; r++) {
          try {
            const winner = await readContract.getWinner(day, r)
            console.log(`   - getWinner(day=${day}, rank=${r}):`, winner)
            const isUserWinner = winner && winner.toLowerCase() === signerAddress
            console.log(`   - isUserWinner at rank ${r}:`, isUserWinner)
            if (isUserWinner) {
              isWinner = true
              winnerRank = r
              console.log(`   - ✅ User is winner at rank ${r}`)
              break
            }
          } catch (error: any) {
            console.error(`🔍 [CLAIM] getWinner(day=${day}, rank=${r}) ERROR:`, error.message)
            console.warn(`Could not get winner for rank ${r}:`, error)
          }
        }
        
        console.log("🔍 [CLAIM] Winner check summary:")
        console.log("   - isWinner:", isWinner)
        console.log("   - winnerRank:", winnerRank)

        if (!isWinner) {
          alert(`You are not registered as a winner for this day.\n\nDate: ${date.toISOString().split('T')[0]}\n\nPlease verify that you are actually among the top 3 players in the daily ranking.`)
          return
        }
      }

      console.log("CLAIM DEBUG", {
        day,
        dateString: date.toISOString().split('T')[0],
        signerAddress,
        canClaim: canClaimResult,
      })
      console.log("DAY USED FOR CLAIM:", day)

      // 🚀 EXECUTA CLAIM - O contrato valida tudo:
      // - Se o usuário é vencedor (winners[day][rank] == msg.sender para algum rank 1-3)
      // - Se já foi claimado (!claimed[day][msg.sender])
      // - Se o dia foi finalizado (totalPlayers[day] > 0)
      // - Calcula o prêmio baseado no rank e número de jogadores (getPrizeForRank)
      // - Transfere USDC automaticamente
      const tx = await writeContract.claim(day)
      await tx.wait()

      alert(
        `Prize claimed successfully!\n\nTX: ${tx.hash}\nhttps://testnet.arcscan.app/tx/${tx.hash}`
      )
    } catch (err: any) {
      console.error("CLAIM ERROR", err)
      // Check if user rejected the transaction (code 4001)
      if (err?.code === 4001 || err?.message?.includes("rejected") || err?.message?.includes("denied") || err?.message?.includes("User rejected")) {
        alert("Transaction rejected by user")
        return
      }
      alert(err?.shortMessage || err?.message || "Error claiming prize")
    }
  }, [])

  const handleViewDailyResults = useCallback((date: Date) => {
    setSelectedDate(date)
    setGameState("daily-results")
  }, [])

  // Reload rankings periodically (historical persistence - no deletion)
  // Rankings are stored by timestamp, so we can filter by date when needed
  useEffect(() => {
    const reloadRankings = async () => {
      try {
        const allRankings = await getRankings()
        setRankings(allRankings)
      } catch (error) {
        console.error("Error reloading rankings:", error)
      }
    }

    const interval = setInterval(() => {
      reloadRankings()
    }, 60000) // Reload every minute
    reloadRankings() // Reload immediately

    return () => clearInterval(interval)
  }, [])

  // Debug: Monitor gameState changes
  useEffect(() => {
    console.log("🔄 gameState changed to:", gameState)
    if (gameState === "results") {
      console.log("📊 Results screen should be visible now")
      console.log("   Session data:", sessionData)
    }
  }, [gameState, sessionData])

  if (!walletConnected || gameState === "wallet") {
    return <WalletGate onConnect={handleWalletConnect} />
  }

  // Debug: Log current state for rendering
  console.log("🎨 Rendering - gameState:", gameState, "sessionData:", sessionData)

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-400 to-sky-300">
      {gameState === "game" && (
        <GameScreen
          walletAddress={address}
          username={username}
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
          onGameComplete={handleGameComplete}
          onViewRanking={handleViewRanking}
          onDisconnect={handleDisconnect}
        />
      )}

      {gameState === "results" && (
        <ResultsScreen sessionData={sessionData} onPlayAgain={handlePlayAgain} onViewRanking={handleViewRanking} />
      )}

      {gameState === "ranking" && (
        <RankingScreen 
          currentPlayer={address}
          onBack={handleBackToGame}
          playerRankings={rankings}
          onViewDailyResults={handleViewDailyResults}
          selectedDate={selectedDate.toISOString().split('T')[0]}
        />
      )}

      {gameState === "daily-results" && (
        <DailyResultsScreen
          date={selectedDate}
          rankings={rankings}
          currentPlayer={address}
          onBack={handleBackToGame}
          onClaimPrize={handleClaimPrize}
        />
      )}

      {/* Results Popup at end of day */}
      <Dialog open={showPopup} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md border-4 border-amber-900 bg-gradient-to-b from-amber-50 to-amber-100">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-amber-900 text-center">
              Daily Results Available!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-center text-amber-900">
              The daily rankings have been calculated. View the results to see if you won a prize!
            </p>
            <Button
              onClick={() => {
                if (yesterdayDayId !== null) {
                  // Convert yesterdayDayId back to Date
                  const yesterdayDate = new Date(yesterdayDayId * 86400000)
                  setSelectedDate(yesterdayDate)
                  handleClose()
                  setGameState("daily-results")
                } else {
                  setSelectedDate(new Date())
                  handleClose()
                  setGameState("daily-results")
                }
              }}
              className="w-full bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white font-bold text-lg py-6"
            >
              Show Results
            </Button>
            <Button
              onClick={handleClose}
              variant="outline"
              className="w-full border-2 border-amber-600 text-amber-900 hover:bg-amber-50"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function WharcAMole() {
  return (
    <WalletProvider>
      <WharcAMoleContent />
    </WalletProvider>
  )
}
