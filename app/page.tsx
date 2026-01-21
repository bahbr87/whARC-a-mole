"use client"

// ============================================================================
// MAINTENANCE MODE — Disable to restore game
// ============================================================================
// Set GAME_DISABLED to true to show maintenance screen and block all game functionality.
// Set GAME_DISABLED to false to restore normal game operation.
// ============================================================================
const GAME_DISABLED = true
// ============================================================================

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

import { saveRanking } from "@/lib/api"

import { getDayId } from "@/utils/day"

import { useDailyResultsPopup } from "@/hooks/use-daily-results-popup"



export type GameDifficulty = "easy" | "medium" | "hard"

export type GameState = "wallet" | "game" | "results" | "ranking" | "daily-results"



export interface GameSession {

  score: number

  goldenMolesHit: number

  errors: number

  gameDuration?: number // Game duration in seconds

  completed?: boolean // Whether the game was completed to the end

  events?: Array<{ holeId: number, animalType: "mole" | "cow" | "golden", timestamp: number }> // Events for backend score calculation

}



export interface RankingEntry {

  player: string

  score: number

  goldenMoles: number

  errors: number

  timestamp: number

  day?: number // Optional day field

}



// ============================================================================
// Maintenance Screen Component
// ============================================================================
// Simple maintenance screen shown when GAME_DISABLED === true
// ============================================================================
function MaintenanceScreen() {
  const handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-amber-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg border-4 border-amber-900 shadow-2xl p-8 text-center">
        <h1 className="text-3xl font-bold text-amber-900 mb-6">
          Game temporarily disabled for maintenance.
        </h1>
        <p className="text-lg text-amber-800 mb-8">
          Please try again later.
        </p>
        <Button
          onClick={handleReload}
          className="w-full bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white font-bold text-lg py-6"
        >
          Reload page
        </Button>
      </div>
    </div>
  )
}
// ============================================================================



function WharcAMoleContent() {
  // ============================================================================
  // MAINTENANCE MODE CHECK
  // ============================================================================
  // If game is disabled, show only maintenance screen and skip all game logic
  // ============================================================================
  if (GAME_DISABLED) {
    return <MaintenanceScreen />
  }
  // ============================================================================

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



  // ⚠️ NOTE: Rankings are now loaded per-day via RankingScreen component

  // This useEffect is kept for backward compatibility but no longer loads rankings

  useEffect(() => {

    if (!rankingsLoaded) {

      setRankings([])

      setRankingsLoaded(true)

    }

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

            const response = await fetch("/api/saveMatch", {

              method: "POST",

              headers: { "Content-Type": "application/json" },

              body: JSON.stringify({ 

                player: address, 

                events: data.events || [], // Events for backend score calculation

                game_duration: data.gameDuration || 30, // Game duration in seconds

                completed: data.completed !== false, // Default to true if not specified

                difficulty: difficulty // Difficulty level for point calculation

              })

            })

            const result = await response.json()

            if (!response.ok) {

              // Show user-friendly error message if validation failed

              if (result.code === 'MAX_MATCHES_REACHED') {

                alert(`Maximum 9 matches per day reached. Please try again tomorrow.`)

              } else if (result.code === 'MAX_GOLDEN_MOLES_EXCEEDED') {

                alert(`Maximum 9 golden moles per day exceeded. This appears to be fraudulent.`)

              } else if (result.code === 'MAX_POINTS_EXCEEDED') {

                alert(`Maximum points per day exceeded. This appears to be fraudulent.`)

              } else if (result.code === 'GAME_NOT_COMPLETED') {

                alert(`Match not completed. Only matches played to the end count for points.`)

              } else if (result.code === 'GAME_DURATION_TOO_SHORT') {

                alert(`Match duration too short. Minimum duration is 30 seconds.`)

              } else {

                console.error("Erro ao salvar pontos:", result.error || result)

              }

            }

          } catch (err) {

            console.error("Erro ao salvar pontos:", err)

          }

          

          // Save to API

          const saved = await saveRanking(newEntry)

          if (!saved) {

            console.warn("Failed to save ranking to API")

          }

          // Note: Rankings are now loaded per-day via RankingScreen, no need to update local state

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

    // Reset selectedDate to today when entering ranking

    setSelectedDate(new Date())

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



  // ⚠️ NOTE: Rankings are now loaded per-day via RankingScreen component

  // Periodic reload removed - rankings are fetched on-demand by day



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

          currentPlayer={address || walletAddress || ""}

          onBack={handleBackToGame}

          playerRankings={[]}

          onViewDailyResults={handleViewDailyResults}

          selectedDate={selectedDate.toISOString().split('T')[0]}

        />

      )}



      {gameState === "daily-results" && (

        <DailyResultsScreen

          date={selectedDate}

          rankings={[]}

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



      {/* Footer with social media icons - only on main game screen */}

      {gameState === "game" && (

        <footer className="fixed bottom-4 right-4 z-50 flex gap-4 items-center">

          <a

            href="https://x.com/wharcamole"

            target="_blank"

            rel="noopener noreferrer"

            className="w-10 h-10 rounded-full bg-white/95 hover:bg-white border-4 border-amber-900 flex items-center justify-center transition-all hover:scale-110 shadow-lg"

            aria-label="Follow us on X (Twitter)"

          >

            <svg

              className="w-5 h-5 text-amber-900"

              fill="currentColor"

              viewBox="0 0 24 24"

              xmlns="http://www.w3.org/2000/svg"

            >

              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />

            </svg>

          </a>

          <a

            href="https://github.com/bahbr87/whARC-a-mole"

            target="_blank"

            rel="noopener noreferrer"

            className="w-10 h-10 rounded-full bg-white/95 hover:bg-white border-4 border-amber-900 flex items-center justify-center transition-all hover:scale-110 shadow-lg"

            aria-label="View on GitHub"

          >

            <svg

              className="w-5 h-5 text-amber-900"

              fill="currentColor"

              viewBox="0 0 24 24"

              xmlns="http://www.w3.org/2000/svg"

            >

              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />

            </svg>

          </a>

        </footer>

      )}

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
