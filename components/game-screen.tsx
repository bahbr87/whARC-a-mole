"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Trophy, Clock, Zap, Info, LogOut, Pause, Play, X, Coins } from "lucide-react"
import type { GameDifficulty, GameSession } from "@/app/page"
import { GameGrid } from "@/components/game-grid"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useMetaTransactions } from "@/hooks/use-meta-transactions"
import { useGameCredits } from "@/hooks/use-game-credits"
import { CreditsPurchaseDialog } from "@/components/credits-purchase-dialog"
import { CreditsRequiredDialog } from "@/components/credits-required-dialog"
import { getDayId } from "@/utils/day"

// Global audio context for click sounds (reused for better performance)
let clickAudioContext: AudioContext | null = null

// Initialize audio context on first user interaction
const getClickAudioContext = () => {
  if (!clickAudioContext) {
    try {
      clickAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      // Resume immediately if suspended
      if (clickAudioContext.state === 'suspended') {
        clickAudioContext.resume().catch(() => {})
      }
    } catch (error) {
      return null
    }
  }
  // Ensure context is running
  if (clickAudioContext.state === 'suspended') {
    clickAudioContext.resume().catch(() => {})
  }
  return clickAudioContext
}

// Sound effect function - plays a simple click sound for button clicks
const playClickSound = () => {
  try {
    const audioContext = getClickAudioContext()
    if (!audioContext) return
    
    // Create a simple, short click sound
    const osc = audioContext.createOscillator()
    const gain = audioContext.createGain()
    
    const now = audioContext.currentTime
    
    // Short, high-pitched click
    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, now)
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.05)
    
    // Quick fade in/out for click sound
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.15, now + 0.001)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05)
    
    osc.connect(gain)
    gain.connect(audioContext.destination)
    
    // Start immediately
    osc.start(now)
    osc.stop(now + 0.05)
  } catch (error) {
    // Silently fail if audio context is not available
    console.debug("Audio not available:", error)
  }
}

// Sound effect function - plays a positive/cheerful sound for hitting the mole
const playMoleHitSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    
    // Create a cheerful, positive sound with ascending tones
    const osc1 = audioContext.createOscillator() // Main positive tone
    const osc2 = audioContext.createOscillator() // Higher harmonic
    const gain1 = audioContext.createGain()
    const gain2 = audioContext.createGain()
    
    const now = audioContext.currentTime
    
    // Main positive tone - ascending (happy sound)
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(200, now)
    osc1.frequency.linearRampToValueAtTime(300, now + 0.1) // Ascending = positive
    
    gain1.gain.setValueAtTime(0, now)
    gain1.gain.linearRampToValueAtTime(0.4, now + 0.005)
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
    
    // Higher harmonic - adds brightness to the sound
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(400, now)
    osc2.frequency.linearRampToValueAtTime(600, now + 0.08)
    
    gain2.gain.setValueAtTime(0, now)
    gain2.gain.linearRampToValueAtTime(0.25, now + 0.005)
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.12)
    
    osc1.connect(gain1)
    osc2.connect(gain2)
    gain1.connect(audioContext.destination)
    gain2.connect(audioContext.destination)
    
    osc1.start(now)
    osc2.start(now)
    osc1.stop(now + 0.15)
    osc2.stop(now + 0.12)
  } catch (error) {
    // Silently fail if audio context is not available
    console.debug("Audio not available:", error)
  }
}

// Sound effect function - plays a cash register/cha-ching sound for golden mole
const playCashRegisterSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    
    // Create a "cha-ching" cash register sound with multiple tones
    const osc1 = audioContext.createOscillator() // First "cha" tone
    const osc2 = audioContext.createOscillator() // Second "ching" tone
    const osc3 = audioContext.createOscillator() // High bell-like tone
    const gain1 = audioContext.createGain()
    const gain2 = audioContext.createGain()
    const gain3 = audioContext.createGain()
    
    const now = audioContext.currentTime
    
    // First "cha" tone - lower, quick
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(400, now)
    osc1.frequency.linearRampToValueAtTime(350, now + 0.05)
    
    gain1.gain.setValueAtTime(0, now)
    gain1.gain.linearRampToValueAtTime(0.3, now + 0.01)
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.08)
    
    // Second "ching" tone - higher, bell-like
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(800, now + 0.06) // Starts after first tone
    osc2.frequency.linearRampToValueAtTime(1000, now + 0.11)
    
    gain2.gain.setValueAtTime(0, now + 0.06)
    gain2.gain.linearRampToValueAtTime(0.35, now + 0.07)
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.18)
    
    // High bell-like "ding" - adds sparkle
    osc3.type = 'sine'
    osc3.frequency.setValueAtTime(1200, now + 0.1)
    osc3.frequency.linearRampToValueAtTime(1500, now + 0.15)
    
    gain3.gain.setValueAtTime(0, now + 0.1)
    gain3.gain.linearRampToValueAtTime(0.25, now + 0.11)
    gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.22)
    
    osc1.connect(gain1)
    osc2.connect(gain2)
    osc3.connect(gain3)
    gain1.connect(audioContext.destination)
    gain2.connect(audioContext.destination)
    gain3.connect(audioContext.destination)
    
    osc1.start(now)
    osc2.start(now + 0.06)
    osc3.start(now + 0.1)
    osc1.stop(now + 0.08)
    osc2.stop(now + 0.18)
    osc3.stop(now + 0.22)
  } catch (error) {
    // Silently fail if audio context is not available
    console.debug("Audio not available:", error)
  }
}

// Sound effect function - plays a negative/error sound for hitting the cow
const playCowErrorSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    
    // Create a descending "wrong" sound
    const osc1 = audioContext.createOscillator() // Low descending tone
    const osc2 = audioContext.createOscillator() // High descending tone
    const gain1 = audioContext.createGain()
    const gain2 = audioContext.createGain()
    
    const now = audioContext.currentTime
    
    // Low descending tone (negative sound) - reduced volume
    osc1.type = 'sawtooth'
    osc1.frequency.setValueAtTime(200, now)
    osc1.frequency.exponentialRampToValueAtTime(100, now + 0.2)
    
    // Reduced volume: 0.2 -> 0.12 (lower than success sound which is 0.4)
    gain1.gain.setValueAtTime(0, now)
    gain1.gain.linearRampToValueAtTime(0.12, now + 0.01)
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.25)
    
    // High descending tone (error indication) - reduced volume
    osc2.type = 'square'
    osc2.frequency.setValueAtTime(400, now)
    osc2.frequency.exponentialRampToValueAtTime(200, now + 0.15)
    
    // Reduced volume: 0.15 -> 0.1 (lower than success sound which is 0.25)
    gain2.gain.setValueAtTime(0, now)
    gain2.gain.linearRampToValueAtTime(0.1, now + 0.01)
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.2)
    
    osc1.connect(gain1)
    osc2.connect(gain2)
    gain1.connect(audioContext.destination)
    gain2.connect(audioContext.destination)
    
    osc1.start(now)
    osc2.start(now)
    osc1.stop(now + 0.25)
    osc2.stop(now + 0.2)
  } catch (error) {
    // Silently fail if audio context is not available
    console.debug("Audio not available:", error)
  }
}

interface GameScreenProps {
  walletAddress: string
  username: string
  difficulty: GameDifficulty
  onDifficultyChange: (difficulty: GameDifficulty) => void
  onGameComplete: (data: GameSession) => void
  onViewRanking: (day?: number) => void
  onDisconnect: () => void
}

const GAME_DURATION = 30 // seconds
const DIFFICULTY_HOLES = {
  easy: 3,
  medium: 6,
  hard: 9,
}

const getPointsForDifficulty = (difficulty: GameDifficulty) => {
  switch (difficulty) {
    case "easy":
      return { mole: 5, cow: -1, golden: 10 }
    case "medium":
      return { mole: 10, cow: -2, golden: 20 }
    case "hard":
      return { mole: 15, cow: -3, golden: 30 }
  }
}

export function GameScreen({
  walletAddress,
  username,
  difficulty,
  onDifficultyChange,
  onGameComplete,
  onViewRanking,
  onDisconnect,
}: GameScreenProps) {
  const [gameActive, setGameActive] = useState(false)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [currentHole, setCurrentHole] = useState<number | null>(null)
  const [animalType, setAnimalType] = useState<"mole" | "cow" | "golden">("mole")
  const [previousHole, setPreviousHole] = useState<number | null>(null)
  const [goldenMolesHit, setGoldenMolesHit] = useState(0)
  const [errors, setErrors] = useState(0)
  const [hitHole, setHitHole] = useState<number | null>(null) // Track which hole was just hit
  const goldenMoleAppearedRef = useRef(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [showPauseDialog, setShowPauseDialog] = useState(false)
  const isPausedRef = useRef(false)

  const timeLeftRef = useRef(GAME_DURATION)
  const gameActiveRef = useRef(false)
  const scoreRef = useRef(0)
  const errorsRef = useRef(0)
  const hitsRef = useRef(0) // Track number of successful hits on moles (normal + golden)
  const cowsHitRef = useRef(0) // Track number of cows hit
  const molesAppearedRef = useRef(0) // Track total moles (normal + golden) that appeared
  const goldenMoleScheduledRef = useRef(false)
  const nextAnimalShouldBeGoldenRef = useRef(false)
  const gameStartTimeRef = useRef<number | null>(null) // Track when game started (for duration validation)
  const gameCompletedRef = useRef(false) // Track if game was completed to the end
  const gameEventsRef = useRef<Array<{ holeId: number, animalType: "mole" | "cow" | "golden", timestamp: number }>>([]) // Track game events for backend calculation

  const holeCount = DIFFICULTY_HOLES[difficulty]
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const animalTimerRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const nextAnimalTimerRef = useRef<NodeJS.Timeout | undefined>(undefined) // Track nested setTimeout

  // Meta-transactions and credits hooks
  const [showCreditsDialog, setShowCreditsDialog] = useState(false)
  const [showCreditsRequiredDialog, setShowCreditsRequiredDialog] = useState(false)
  const [gameSessionId, setGameSessionId] = useState<string>("")
  // ✅ CORREÇÃO: Passar walletAddress para useMetaTransactions para garantir sincronização
  const { recordClick, isAuthorized, authorize, pendingClicks } = useMetaTransactions(walletAddress)
  
  // ✅ CORREÇÃO: Ref para rastrear se há transações pendentes
  const pendingTransactionsRef = useRef<Set<string>>(new Set())
  const { credits, refreshCredits, getCreditsBalance, decrementCreditsOptimistic } = useGameCredits(walletAddress)
  
  // ✅ CORREÇÃO: Refresh credits ONLY when walletAddress changes (no polling, no refresh contínuo)
  useEffect(() => {
    console.log("🎮 GameScreen useEffect triggered - walletAddress:", walletAddress, "current credits:", credits)
    if (walletAddress && walletAddress.trim() !== "") {
      console.log("🔄 Refreshing credits once on mount/wallet change")
      refreshCredits()
        .then(() => {
          console.log("✅ Credits refreshed on mount - new credits value should be visible")
        })
        .catch((error) => {
          console.error("❌ Error refreshing credits on mount:", error)
        })
    } else {
      console.log("⚠️ No walletAddress, skipping credits refresh")
    }
  }, [walletAddress]) // ✅ Removido refreshCredits das dependências para evitar refresh contínuo

  const getAnimalSpeed = useCallback(() => {
    // Increase speed progressively every 10 seconds
    // Game duration is 60 seconds, so we have 6 speed levels
    const elapsed = GAME_DURATION - timeLeftRef.current
    if (elapsed >= 50) {
      return 400 // Fastest (50-60s)
    } else if (elapsed >= 40) {
      return 500 // Very fast (40-50s)
    } else if (elapsed >= 30) {
      return 600 // Fast (30-40s)
    } else if (elapsed >= 20) {
      return 700 // Medium-fast (20-30s)
    } else if (elapsed >= 10) {
      return 800 // Medium (10-20s)
    } else {
      return 1000 // Slowest (0-10s)
    }
  }, [])

  const selectRandomHole = useCallback(() => {
    const availableHoles = Array.from({ length: holeCount }, (_, i) => i).filter((h) => h !== previousHole)
    return availableHoles[Math.floor(Math.random() * availableHoles.length)]
  }, [holeCount, previousHole])

  const showNextAnimal = useCallback(() => {
    if (!gameActiveRef.current || isPausedRef.current) return

    const newHole = selectRandomHole()
    setPreviousHole(newHole)
    setCurrentHole(newHole)

    let type: "mole" | "cow" | "golden" = "mole"

    if (nextAnimalShouldBeGoldenRef.current && !goldenMoleAppearedRef.current) {
      type = "golden"
      goldenMoleAppearedRef.current = true
      nextAnimalShouldBeGoldenRef.current = false
      molesAppearedRef.current += 1 // Count golden mole as a mole
      console.log("[v0] Golden mole appeared at", timeLeftRef.current, "seconds remaining")
    } else {
      type = Math.random() < 0.75 ? "mole" : "cow"
      if (type === "mole") {
        molesAppearedRef.current += 1 // Count normal mole
      }
    }

    setAnimalType(type)

    // Get speed based on elapsed time (increases every 10 seconds)
    // This is how long the animal stays visible before disappearing
    // ALWAYS respect the speed rules, regardless of how the previous animal disappeared
    const visibilityDuration = getAnimalSpeed()

    animalTimerRef.current = setTimeout(() => {
      // Double check if still not paused before continuing
      if (!isPausedRef.current && gameActiveRef.current) {
        setCurrentHole(null)
        nextAnimalTimerRef.current = setTimeout(() => {
          // Triple check before showing next animal
          if (!isPausedRef.current && gameActiveRef.current) {
            showNextAnimal() // Always use normal speed rules
          }
        }, 200)
      }
    }, visibilityDuration)
  }, [selectRandomHole, getAnimalSpeed])

  const startGame = useCallback(() => {
    setShowTutorial(true)
  }, [])

  const handleStartGameAfterTutorial = useCallback(async () => {
    // Force refresh credits multiple times to ensure we have latest balance
    await refreshCredits()
    await new Promise(resolve => setTimeout(resolve, 1000))
    await refreshCredits()
    
    // Get current credits balance directly from contract
    let currentCredits = 0
    try {
      currentCredits = await getCreditsBalance()
    } catch (error) {
      // Fallback to state value
      currentCredits = credits
    }
    
    // Use the maximum of contract balance and state value (more accurate)
    const finalCredits = Math.max(currentCredits, credits)
    
    // Check if user has credits - ALWAYS check this first
    // User must have credits to play - no exceptions
    if (finalCredits < 1) {
      // Close tutorial and show credits required dialog
      setShowTutorial(false)
      // Small delay to ensure tutorial closes
      setTimeout(() => {
        setShowCreditsRequiredDialog(true)
      }, 300)
      return
    }
    
    // User has credits, proceed with game

    // Check if user is authorized (optional, but recommended)
    // Only try to authorize if wallet is actually connected and we have an address
    // Skip authorization if address is not available - it's optional anyway
    // IMPORTANT: Skip authorization on game start to avoid wallet popup
    // Authorization can happen later if needed, but it's not required to play
    // Users can sign each click individually if not authorized
    console.log("🎮 Skipping authorization on game start - authorization is optional")

    // Generate session ID
    const sessionId = `${walletAddress}-${Date.now()}`
    setGameSessionId(sessionId)

    setShowTutorial(false)
    setGameActive(true)
    gameActiveRef.current = true
    setScore(0)
    scoreRef.current = 0
    setTimeLeft(GAME_DURATION)
    timeLeftRef.current = GAME_DURATION
    setCurrentHole(null)
    setErrors(0)
    errorsRef.current = 0
    setGoldenMolesHit(0)
    goldenMoleAppearedRef.current = false
    goldenMoleScheduledRef.current = false
    nextAnimalShouldBeGoldenRef.current = false
    hitsRef.current = 0
    cowsHitRef.current = 0
    molesAppearedRef.current = 0
    setPreviousHole(null)
    setIsPaused(false)
    isPausedRef.current = false
    setShowPauseDialog(false)
    gameStartTimeRef.current = Date.now() // Track game start time
    gameCompletedRef.current = false // Reset completion flag
    gameEventsRef.current = [] // Reset game events

    setTimeout(() => {
      showNextAnimal()
    }, 500)
  }, [showNextAnimal, credits, walletAddress, refreshCredits, getCreditsBalance])

  const handleHoleClick = useCallback(
    (holeIndex: number) => {
      if (!gameActiveRef.current || currentHole !== holeIndex || isPausedRef.current) return

      // IMMEDIATE visual and audio feedback (synchronous, no delays)
      // Play different sound based on animal type
      if (animalType === "cow") {
        playCowErrorSound() // Negative sound for hitting the wrong animal
      } else if (animalType === "mole") {
        playMoleHitSound() // Positive, cheerful sound for hitting the mole
      } else {
        playCashRegisterSound() // Cash register "cha-ching" sound for hitting golden mole
      }
      setHitHole(holeIndex)
      setTimeout(() => setHitHole(null), 150) // Hide after 150ms (reduced for faster gameplay)

      // Clear timers immediately
      if (animalTimerRef.current) {
        clearTimeout(animalTimerRef.current)
        animalTimerRef.current = undefined
      }
      if (nextAnimalTimerRef.current) {
        clearTimeout(nextAnimalTimerRef.current)
        nextAnimalTimerRef.current = undefined
      }

      // Calculate points immediately
      const points = getPointsForDifficulty(difficulty)
      let pointsChange = 0

      if (animalType === "golden") {
        pointsChange = points.golden
        setGoldenMolesHit((prev) => prev + 1)
        hitsRef.current += 1
      } else if (animalType === "mole") {
        pointsChange = points.mole
        hitsRef.current += 1
      } else if (animalType === "cow") {
        pointsChange = points.cow
        errorsRef.current += 1
        cowsHitRef.current += 1
        setErrors(errorsRef.current)
      }

      // Record event for backend calculation
      gameEventsRef.current.push({
        holeId: holeIndex,
        animalType: animalType,
        timestamp: Date.now()
      })
      console.log(`🔍 [INVESTIGATION-CLICK] Evento adicionado: animalType=${animalType}, holeId=${holeIndex}, totalEvents=${gameEventsRef.current.length}, timestamp=${Date.now()}`)

      // Update score and hide animal immediately
      scoreRef.current = Math.max(0, scoreRef.current + pointsChange)
      setScore(scoreRef.current)
      setCurrentHole(null)

      // Show next animal after the normal speed-based delay
      // This ensures the speed rules are ALWAYS respected, regardless of how the previous animal disappeared
      if (gameActiveRef.current && !isPausedRef.current) {
        const nextAnimalDelay = getAnimalSpeed()
        nextAnimalTimerRef.current = setTimeout(() => {
          if (gameActiveRef.current && !isPausedRef.current) {
            showNextAnimal()
          }
        }, nextAnimalDelay)
      }

      // 🚀 CRITICAL: Each click MUST generate a blockchain transaction
      // This is the core requirement - every click = one transaction on-chain
      
      // ✅ CORREÇÃO: Decrementar créditos otimisticamente imediatamente (1 crédito por clique)
      decrementCreditsOptimistic(1)
      console.log("⚡ [handleHoleClick] Credits decremented optimistically")
      
      console.log("🖱️  CLICK DETECTED - Processing on-chain transaction...")
      recordClick(gameSessionId)
        .then((success) => {
          // ✅ CORREÇÃO: Só mostrar sucesso se realmente foi processado
          // O recordClick já tem logs detalhados, então não precisamos duplicar
          if (!success) {
            console.warn("⚠️ Click detected but NOT processed (wallet not connected or error)")
            // Se falhou, reconciliar com o contrato para restaurar o estado correto
            setTimeout(() => {
              refreshCredits().catch(err => console.error("Error reconciling credits:", err))
            }, 2000)
          } else {
            // Se sucesso, reconciliar após delay para garantir sincronização
            setTimeout(() => {
              refreshCredits().catch(err => console.error("Error reconciling credits:", err))
            }, 3000)
          }
        })
        .catch((error) => {
          // Log error but don't break the game
          // The error details are already logged in recordClick
          console.error("❌ Click transaction failed (game continues):", error.message || error)
          // Em caso de erro, reconciliar com o contrato para restaurar o estado correto
          setTimeout(() => {
            refreshCredits().catch(err => console.error("Error reconciling credits after error:", err))
          }, 2000)
        })
    },
    [currentHole, animalType, showNextAnimal, difficulty, recordClick, gameSessionId, getAnimalSpeed, decrementCreditsOptimistic, refreshCredits],
  )

  useEffect(() => {
    if (!gameActive || isPausedRef.current) return

    const timerInterval = setInterval(() => {
      if (isPausedRef.current) return
      
      timeLeftRef.current -= 1
      setTimeLeft(timeLeftRef.current)

      if (timeLeftRef.current === 7 && !goldenMoleScheduledRef.current) {
        goldenMoleScheduledRef.current = true
        nextAnimalShouldBeGoldenRef.current = true
        console.log("[v0] Golden mole scheduled for next spawn")
      }

      if (timeLeftRef.current <= 0) {
        console.log("⏰ Game timer reached 0 - Finalizing game...")
        console.log("   Final score:", scoreRef.current)
        console.log("   Golden moles hit:", goldenMolesHit)
        console.log("   Errors:", errorsRef.current)
        
        gameActiveRef.current = false
        setGameActive(false)
        gameCompletedRef.current = true // Mark game as completed to the end

        if (animalTimerRef.current) clearTimeout(animalTimerRef.current)
        if (nextAnimalTimerRef.current) clearTimeout(nextAnimalTimerRef.current)

        console.log("📤 Calling onGameComplete...")
        console.log(`🔍 [INVESTIGATION-FINAL] ANTES de chamar onGameComplete:`)
        console.log(`🔍 [INVESTIGATION-FINAL]   gameEventsRef.current.length = ${gameEventsRef.current.length}`)
        console.log(`🔍 [INVESTIGATION-FINAL]   scoreRef.current = ${scoreRef.current}`)
        console.log(`🔍 [INVESTIGATION-FINAL]   Primeiros 5 eventos:`, gameEventsRef.current.slice(0, 5))
        console.log(`🔍 [INVESTIGATION-FINAL]   Últimos 5 eventos:`, gameEventsRef.current.slice(-5))
        const eventsSnapshot = [...gameEventsRef.current] // Criar snapshot para garantir que não será modificado
        console.log(`🔍 [INVESTIGATION-FINAL]   Snapshot criado com ${eventsSnapshot.length} eventos`)
        onGameComplete({
          score: scoreRef.current,
          goldenMolesHit,
          errors: errorsRef.current,
          gameDuration: gameStartTimeRef.current ? Math.floor((Date.now() - gameStartTimeRef.current) / 1000) : GAME_DURATION,
          completed: true,
          events: eventsSnapshot,
        })
        console.log("✅ onGameComplete called")
        
        // ✅ CORREÇÃO: Atualizar créditos após o jogo terminar
        // Os créditos foram consumidos durante o jogo via meta-transactions
        // Precisamos atualizar o saldo exibido
        // ✅ CORREÇÃO: Aguardar mais tempo para garantir que todas as transações foram processadas
        console.log("🔄 Refreshing credits after game completion...")
        console.log(`   Pending clicks in queue: ${pendingClicks}`)
        
        // Aguardar até que a fila esteja vazia + delay adicional
        const checkAndRefresh = async () => {
          let attempts = 0
          const maxAttempts = 20 // 20 tentativas = 10 segundos
          
          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 500))
            attempts++
            
            // Verificar se ainda há cliques pendentes
            if (pendingClicks === 0 && attempts > 5) {
              console.log(`✅ Queue is empty after ${attempts * 0.5}s, refreshing credits...`)
              break
            }
          }
          
          // Aguardar mais 3 segundos para garantir que todas as transações foram confirmadas
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          try {
            console.log("🔄 Reading credits from contract...")
            await refreshCredits()
            const newBalance = await getCreditsBalance()
            console.log("✅ Credits refreshed after game. New balance:", newBalance)
          } catch (error) {
            console.error("❌ Error refreshing credits after game:", error)
          }
        }
        
        checkAndRefresh()
      }
    }, 1000)

    return () => {
      clearInterval(timerInterval)
    }
  }, [gameActive, goldenMolesHit, onGameComplete, isPaused])


  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (animalTimerRef.current) clearTimeout(animalTimerRef.current)
      if (nextAnimalTimerRef.current) clearTimeout(nextAnimalTimerRef.current)
    }
  }, [])

  return (
    <div className="min-h-screen p-4 flex flex-col" style={{ overflow: 'hidden' }}>
      <Card className="mb-4 p-4 bg-white/95 backdrop-blur border-4 border-amber-900">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl md:text-3xl font-bold text-amber-900">whARC-a-mole</h1>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-amber-700 font-mono">
                {walletAddress} {username && `(${username})`}
              </span>
              <Button
                onClick={onDisconnect}
                variant="outline"
                size="sm"
                className="border-2 border-amber-600 text-amber-900 hover:bg-amber-50 bg-transparent"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={async () => {
                  playClickSound()
                  // ✅ CORREÇÃO: Sempre abre o diálogo quando clicar no botão
                  setShowCreditsDialog(true)
                }}
                variant="outline"
                className="flex items-center gap-2 px-4 py-2 border-2 border-amber-600 text-amber-900 hover:bg-amber-50 bg-white"
              >
                <Coins className="w-5 h-5" />
                <span className="font-bold">Insert Credits</span>
                <span className="ml-1 text-sm font-mono">
                  ({typeof credits === 'number' && !isNaN(credits) ? credits.toLocaleString() : 0})
                </span>
                {pendingClicks > 0 && (
                  <span className="ml-1 text-xs text-amber-600">({pendingClicks} pending)</span>
                )}
              </Button>
            </div>
            {gameActive && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-amber-900">{score}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <span
                    className={`text-2xl font-bold ${timeLeft <= 10 ? "text-red-600 animate-pulse" : "text-amber-900"}`}
                  >
                    {timeLeft}s
                  </span>
                </div>
              </>
            )}

            {gameActive && !isPaused && (
              <Button
                onClick={() => {
                  playClickSound()
                  setIsPaused(true)
                  isPausedRef.current = true
                  setShowPauseDialog(true)
                  // Clear any active animal timers
                  if (animalTimerRef.current) {
                    clearTimeout(animalTimerRef.current)
                    animalTimerRef.current = undefined
                  }
                  if (nextAnimalTimerRef.current) {
                    clearTimeout(nextAnimalTimerRef.current)
                    nextAnimalTimerRef.current = undefined
                  }
                  // Hide current animal
                  setCurrentHole(null)
                }}
                variant="outline"
                size="sm"
                className="border-2 border-amber-600 text-amber-900 hover:bg-amber-50 bg-transparent"
              >
                Pause Game
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Dialog open={showTutorial} onOpenChange={setShowTutorial}>
        <DialogContent className="sm:max-w-md border-4 border-amber-900 bg-gradient-to-b from-amber-50 to-amber-100">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-amber-900 flex items-center gap-2">
              <Info className="w-6 h-6" />
              Game Objective
            </DialogTitle>
            <div className="space-y-4 text-base text-amber-900 pt-4">
              {(() => {
                const points = getPointsForDifficulty(difficulty)
                return (
                  <>
                    <div className="flex items-center gap-3 p-3 bg-green-100 rounded-lg border-2 border-green-400">
                      <span className="text-4xl">🐹</span>
                      <div>
                        <p className="font-bold text-green-900">Hit the moles</p>
                        <p className="text-sm text-green-800">+{points.mole} points</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-red-100 rounded-lg border-2 border-red-400">
                      <span className="text-4xl">🐮</span>
                      <div>
                        <p className="font-bold text-red-900">Avoid the cows</p>
                        <p className="text-sm text-red-800">{points.cow} point{points.cow !== -1 ? "s" : ""}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-yellow-100 rounded-lg border-2 border-yellow-400">
                      <span className="text-4xl">✨</span>
                      <div>
                        <p className="font-bold text-yellow-900">Golden Mole</p>
                        <p className="text-sm text-yellow-800">+{points.golden} points</p>
                      </div>
                    </div>
                  </>
                )
              })()}

              <p className="text-center font-semibold text-amber-900 pt-2">You have 30 seconds. Good luck!</p>
            </div>
          </DialogHeader>
          <Button
            onClick={() => {
              playClickSound()
              handleStartGameAfterTutorial()
            }}
            className="w-full bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white font-bold text-lg py-6"
          >
            <Zap className="mr-2 h-5 w-5" />
            Start Game!
          </Button>
        </DialogContent>
      </Dialog>

      {/* Pause Dialog */}
      <Dialog open={showPauseDialog} onOpenChange={(open) => {
        if (!open && isPausedRef.current) {
          // Prevent closing without choosing an option
          return
        }
        setShowPauseDialog(open)
      }}>
        <DialogContent className="sm:max-w-md border-4 border-amber-900 bg-gradient-to-b from-amber-50 to-amber-100">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-amber-900 text-center">
              Game Paused
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-center text-amber-900">
              What would you like to do?
            </p>
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => {
                  playClickSound()
                  setShowPauseDialog(false)
                  setIsPaused(false)
                  isPausedRef.current = false
                  // Resume the game - show next animal immediately
                  if (gameActiveRef.current) {
                    showNextAnimal()
                  }
                }}
                className="w-full bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white font-bold text-lg py-6"
              >
                <Play className="w-5 h-5 mr-2" />
                Continue Game
              </Button>
              <Button
                onClick={() => {
                  playClickSound()
                  // End the game
                  setIsPaused(false)
                  isPausedRef.current = false
                  setShowPauseDialog(false)
                  gameActiveRef.current = false
                  setGameActive(false)
                  gameCompletedRef.current = false // Mark as not completed (quit mid-game)
                  
                  if (animalTimerRef.current) clearTimeout(animalTimerRef.current)
                  if (nextAnimalTimerRef.current) clearTimeout(nextAnimalTimerRef.current)
                  
                  // Complete game with current stats (but mark as not completed)
                  console.log(`🔍 [INVESTIGATION-QUIT] ANTES de chamar onGameComplete (quit):`)
                  console.log(`🔍 [INVESTIGATION-QUIT]   gameEventsRef.current.length = ${gameEventsRef.current.length}`)
                  console.log(`🔍 [INVESTIGATION-QUIT]   scoreRef.current = ${scoreRef.current}`)
                  const eventsSnapshotQuit = [...gameEventsRef.current] // Criar snapshot para garantir que não será modificado
                  console.log(`🔍 [INVESTIGATION-QUIT]   Snapshot criado com ${eventsSnapshotQuit.length} eventos`)
                  onGameComplete({
                    score: scoreRef.current,
                    goldenMolesHit,
                    errors: errorsRef.current,
                    gameDuration: gameStartTimeRef.current ? Math.floor((Date.now() - gameStartTimeRef.current) / 1000) : 0,
                    completed: false, // Game was quit, not completed to the end
                    events: eventsSnapshotQuit,
                  })
                  
                  // ✅ CORREÇÃO: Atualizar créditos após o jogo terminar
                  console.log("🔄 Refreshing credits after game completion (paused)...")
                  setTimeout(async () => {
                    try {
                      await refreshCredits()
                      const newBalance = await getCreditsBalance()
                      console.log("✅ Credits refreshed after game. New balance:", newBalance)
                    } catch (error) {
                      console.error("❌ Error refreshing credits after game:", error)
                    }
                  }, 2000) // Delay de 2s para garantir que a transação foi processada
                }}
                variant="outline"
                className="w-full border-2 border-red-600 text-red-900 hover:bg-red-50 font-bold text-lg py-6"
              >
                <X className="w-5 h-5 mr-2" />
                Quit Game
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="flex-1 p-6 bg-gradient-to-b from-amber-100 to-green-200 border-4 border-amber-900" style={{ overflow: 'hidden' }}>
        {!gameActive ? (
          <div className="h-full flex flex-col items-center justify-center gap-6">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold text-amber-900">Select Difficulty</h2>
              <p className="text-amber-800">Choose your challenge level</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
              {(["easy", "medium", "hard"] as GameDifficulty[]).map((diff) => (
                <Button
                  key={diff}
                  onClick={() => {
                    playClickSound()
                    onDifficultyChange(diff)
                  }}
                  variant={difficulty === diff ? "default" : "outline"}
                  size="lg"
                  className={`h-24 text-lg font-bold ${
                    difficulty === diff
                      ? "bg-amber-600 hover:bg-amber-700 text-white"
                      : "bg-white hover:bg-amber-50 text-amber-900 border-2 border-amber-300"
                  }`}
                >
                  <span className="capitalize">{diff}</span>
                </Button>
              ))}
            </div>

            <Button
              onClick={() => {
                playClickSound()
                startGame()
              }}
              disabled={credits < 1}
              size="lg"
              className="bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white font-bold text-xl py-8 px-12 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap className="mr-2 h-6 w-6" />
              {credits < 1 ? "Purchase Credits to Play" : "Start Game"}
            </Button>

            <Button
              onClick={() => {
                playClickSound()
                const today = getDayId()
                onViewRanking(today) // envia o dia correto para o ranking
              }}
              variant="outline"
              className="border-2 border-amber-600 text-amber-900 hover:bg-amber-50 bg-transparent"
            >
              <Trophy className="mr-2 h-4 w-4" />
              View Rankings
            </Button>
          </div>
        ) : (
          <GameGrid
            holeCount={holeCount}
            currentHole={currentHole}
            animalType={animalType}
            onHoleClick={handleHoleClick}
            difficulty={difficulty}
            hitHole={hitHole}
          />
        )}
      </Card>

      {/* Credits Purchase Dialog */}
      <CreditsPurchaseDialog
        open={showCreditsDialog}
        onOpenChange={setShowCreditsDialog}
        walletAddress={walletAddress}
      />

      {/* Credits Required Dialog */}
      <CreditsRequiredDialog
        open={showCreditsRequiredDialog}
        onOpenChange={setShowCreditsRequiredDialog}
        onPurchaseCredits={() => setShowCreditsDialog(true)}
      />
    </div>
  )
}
