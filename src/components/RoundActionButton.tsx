import React from 'react';
import { Camera, BookOpen } from 'lucide-react';
import { LefitLogo } from './LefitLogo';

interface RoundActionButtonProps {
  type: 'scanner' | 'saved-recipes';
  onClick: () => void;
  savedCount?: number;
  isNewlyUnlocked?: boolean;
}

export const RoundActionButton: React.FC<RoundActionButtonProps> = ({
  type,
  onClick,
  savedCount = 0,
  isNewlyUnlocked = false,
}) => {
  if (type === 'scanner') {
    return (
      <div className="flex flex-col items-center group">
        <button
          onClick={onClick}
          type="button"
          aria-label="Scanner öffnen"
          className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full flex flex-col items-center justify-center p-3 text-white transition-all duration-200 transform active:scale-95 hover:scale-102 cursor-pointer overflow-hidden border-4 border-[#660F0F] shadow-xl"
          style={{
            backgroundColor: '#FF5757', // Exact matte coral red from logo
          }}
        >
          {/* Authentic LEFIT Logo Watermark in Background (Enlarged) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-28">
            <LefitLogo variant="watermark" className="w-32 h-32 sm:w-40 sm:h-40" />
          </div>

          {/* Central content in matte bordeaux / white */}
          <div className="relative z-10 flex flex-col items-center justify-center gap-2">
            <div className="p-3 rounded-full bg-[#660F0F] text-white border border-[#400808]">
              <Camera className="w-8 h-8 sm:w-9 sm:h-9 stroke-[2.5]" />
            </div>
            <span className="font-black tracking-widest text-lg sm:text-xl uppercase text-white drop-shadow-sm">
              Scanner
            </span>
          </div>
        </button>

        <span className="mt-4 text-xs sm:text-sm font-bold tracking-wide uppercase text-[#E0B0B0]">
          Produkt scannen
        </span>
      </div>
    );
  }

  // Saved recipes round button in matte deep bordeaux (Step 3 & 4)
  return (
    <div className={`flex flex-col items-center group transition-all duration-300 ${isNewlyUnlocked ? 'animate-bounce' : ''}`}>
      <button
        onClick={onClick}
        type="button"
        aria-label="Gespeicherte Rezepte ansehen"
        className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full flex flex-col items-center justify-center p-3 text-white transition-all duration-200 transform active:scale-95 hover:scale-102 cursor-pointer overflow-hidden border-4 border-[#FF5757] shadow-xl"
        style={{
          backgroundColor: '#660F0F', // Exact matte deep bordeaux from logo
        }}
      >
        {/* Badge with count */}
        {savedCount > 0 && (
          <div className="absolute top-3 right-3 z-20 min-w-7 h-7 px-2 rounded-full bg-[#FF5757] text-[#120305] text-xs font-black flex items-center justify-center border-2 border-[#660F0F]">
            {savedCount}
          </div>
        )}

        {/* Central content */}
        <div className="relative z-10 flex flex-col items-center justify-center gap-2 text-center">
          <div className="p-3 rounded-full bg-[#1A070A] text-[#FF5757] border border-[#FF5757]/40">
            <BookOpen className="w-8 h-8 sm:w-9 sm:h-9 stroke-[2.5]" />
          </div>
          <span className="font-black tracking-wide text-xs sm:text-sm uppercase text-white leading-tight">
            Gespeicherte<br />Rezepte
          </span>
        </div>
      </button>

      <span className="mt-4 text-xs sm:text-sm font-bold tracking-wide uppercase text-[#E0B0B0]">
        {savedCount} {savedCount === 1 ? 'Rezept gespeichert' : 'Rezepte gespeichert'}
      </span>
    </div>
  );
};
