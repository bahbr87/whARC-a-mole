"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { GameDifficulty } from "@/app/page"
import { MoleFace } from "@/components/mole-face"

interface GameGridProps {
  holeCount: number
  currentHole: number | null
  animalType: "mole" | "cow" | "golden"
  onHoleClick: (index: number) => void
  difficulty: GameDifficulty
  hitHole: number | null
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

export function GameGrid({ holeCount, currentHole, animalType, onHoleClick, difficulty, hitHole }: GameGridProps) {
  const points = getPointsForDifficulty(difficulty)
  const gridCols = "grid-cols-3"

  // Adjust gap and size based on difficulty - smaller gap and size for hard mode
  const gapClass = difficulty === "hard" ? "gap-1 md:gap-2" : "gap-8 md:gap-12"
  const holeSize = difficulty === "hard" ? "min-w-[140px] min-h-[140px] md:min-w-[160px] md:min-h-[160px]" : "min-w-[120px] min-h-[120px] md:min-w-[160px] md:min-h-[160px]"
  
  return (
    <div className="h-full flex items-center justify-center p-2 md:p-4 cursor-hammer">
      <div className={cn("grid w-full max-w-5xl", gridCols, gapClass)} style={{ paddingTop: difficulty === "hard" ? '1rem' : '3rem' }}>
        {Array.from({ length: holeCount }).map((_, index) => {
          const isActive = currentHole === index
          const row = Math.floor(index / 3)

          return (
            <div 
              key={index} 
              className="relative flex flex-col items-center"
              style={{ 
                paddingTop: row === 0 ? '0' : (difficulty === "hard" ? '1rem' : '2.5rem'),
                paddingBottom: row === Math.floor((holeCount - 1) / 3) ? '0' : '0'
              }}
            >
              {/* Point indicator overlay - above the button */}
              {isActive && (
                <div 
                  className="absolute bg-white/90 px-4 py-2 rounded-full shadow-lg font-bold text-lg z-10 whitespace-nowrap mb-2"
                  style={{ 
                    position: 'absolute',
                    top: row === 0 ? '-3rem' : '-3rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    pointerEvents: 'none'
                  }}
                >
                  {animalType === "golden" && <span className="text-yellow-600">+{points.golden}</span>}
                  {animalType === "mole" && <span className="text-green-600">+{points.mole}</span>}
                  {animalType === "cow" && <span className="text-red-600">{points.cow}</span>}
                </div>
              )}
              
              <Button
                onClick={() => onHoleClick(index)}
                disabled={!isActive}
                className={cn(
                  "aspect-square relative border-4 transition-colors duration-200",
                  holeSize,
                  "bg-gradient-to-b from-amber-900 via-amber-950 to-black shadow-inner",
                  isActive ? "border-amber-600" : "border-amber-800 opacity-80",
                  isActive && "cursor-hammer"
                )}
                style={{ borderRadius: '50%', overflow: 'visible' }}
              >
                {/* Hit indicator - circle around the hole when animal is hit */}
                {hitHole === index && (
                  <div 
                    className="absolute inset-0 z-20 pointer-events-none animate-hit-circle"
                    style={{ 
                      borderRadius: '50%',
                      border: '4px solid',
                      borderColor: '#fbbf24', // amber-400
                      boxShadow: '0 0 20px rgba(251, 191, 36, 0.8), 0 0 40px rgba(251, 191, 36, 0.4)',
                      transform: 'scale(1.1)',
                    }}
                  />
                )}
                
                {/* Hole background - darker for depth */}
                <div className="absolute inset-0 bg-black shadow-[inset_0_8px_16px_rgba(0,0,0,0.8)]" style={{ borderRadius: '50%' }} />

                {/* Animal with pop-up animation */}
                {isActive && (
                  <div className="absolute inset-0 flex items-end justify-center pb-4 animate-pop-up" style={{ overflow: 'hidden', borderRadius: '50%' }}>
                    {animalType === "mole" && (
                      <div className="scale-125 md:scale-150">
                        <MoleFace size="medium" showHole={false} />
                      </div>
                    )}
                    {animalType === "golden" && (
                      <div className="scale-125 md:scale-150 drop-shadow-[0_0_12px_rgba(234,179,8,0.9)]">
                        <MoleFace size="medium" showHole={false} className="brightness-125 saturate-150" />
                      </div>
                    )}
                    {animalType === "cow" && (
                      <div className="text-8xl md:text-9xl drop-shadow-2xl">🐮</div>
                    )}
                  </div>
                )}
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
