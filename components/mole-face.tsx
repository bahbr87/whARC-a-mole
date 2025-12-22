"use client"

interface MoleFaceProps {
  size?: "small" | "medium" | "large"
  className?: string
  showHole?: boolean
}

const sizeClasses = {
  small: "w-16 h-16",
  medium: "w-24 h-24",
  large: "w-32 h-32",
}

const faceSizeClasses = {
  small: "w-12 h-12",
  medium: "w-20 h-20",
  large: "w-24 h-24",
}

export function MoleFace({ size = "medium", className = "", showHole = true }: MoleFaceProps) {
  const containerSize = sizeClasses[size]
  const faceSize = faceSizeClasses[size]
  
  // Scale factors based on size
  const scaleFactor = size === "small" ? 0.75 : size === "medium" ? 1 : 1.25
  
  return (
    <div className={`relative ${showHole ? containerSize : ''} ${className}`}>
      {/* Hole - behind the mole */}
      {showHole && (
        <div className="absolute inset-0 bg-gradient-to-b from-amber-950 via-black to-black rounded-full shadow-[inset_0_8px_16px_rgba(0,0,0,0.9)]"></div>
      )}
      
      {/* Mole face coming out - always same positioning as logo */}
      <div className={`relative ${faceSize} ${showHole ? 'absolute bottom-0 left-1/2 -translate-x-1/2 z-10' : 'inline-block'}`}>
        {/* Face shape - rounded top, coming from hole */}
        <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 ${faceSize} bg-gradient-to-b from-amber-800 to-amber-900 rounded-t-full border-2 border-amber-950`}></div>
        
        {/* Nose - dark triangle */}
        <div 
          className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-amber-950 rounded-full"
          style={{ 
            width: `${4 * scaleFactor}px`, 
            height: `${3 * scaleFactor}px` 
          }}
        ></div>
        
        {/* Teeth - small white square below nose */}
        <div 
          className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white"
          style={{ 
            width: `${6 * scaleFactor}px`, 
            height: `${6 * scaleFactor}px` 
          }}
        ></div>
        
        {/* Eyes - two small circles */}
        <div 
          className="absolute bottom-14 left-1/2 -translate-x-1/2 flex gap-3"
          style={{ gap: `${12 * scaleFactor}px` }}
        >
          <div 
            className="bg-black rounded-full"
            style={{ 
              width: `${12 * scaleFactor}px`, 
              height: `${12 * scaleFactor}px` 
            }}
          ></div>
          <div 
            className="bg-black rounded-full"
            style={{ 
              width: `${12 * scaleFactor}px`, 
              height: `${12 * scaleFactor}px` 
            }}
          ></div>
        </div>
        
        {/* Whiskers - left */}
        <div 
          className="absolute bottom-10 left-2 flex flex-col gap-1"
          style={{ gap: `${4 * scaleFactor}px` }}
        >
          <div 
            className="bg-amber-950"
            style={{ 
              width: `${24 * scaleFactor}px`, 
              height: `${2 * scaleFactor}px` 
            }}
          ></div>
          <div 
            className="bg-amber-950"
            style={{ 
              width: `${24 * scaleFactor}px`, 
              height: `${2 * scaleFactor}px` 
            }}
          ></div>
        </div>
        
        {/* Whiskers - right */}
        <div 
          className="absolute bottom-10 right-2 flex flex-col gap-1"
          style={{ gap: `${4 * scaleFactor}px` }}
        >
          <div 
            className="bg-amber-950"
            style={{ 
              width: `${24 * scaleFactor}px`, 
              height: `${2 * scaleFactor}px` 
            }}
          ></div>
          <div 
            className="bg-amber-950"
            style={{ 
              width: `${24 * scaleFactor}px`, 
              height: `${2 * scaleFactor}px` 
            }}
          ></div>
        </div>
      </div>
    </div>
  )
}

