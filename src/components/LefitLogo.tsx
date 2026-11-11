import React from 'react';

const LOGO_SRC = '/assets/aistudio/width_1600_bf2ec95e.png';

interface LefitLogoProps {
  variant?: 'full' | 'icon' | 'watermark' | 'pulsing';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const LefitLogo: React.FC<LefitLogoProps> = ({
  variant = 'full',
  className = '',
  size = 'md',
}) => {
  // Enhanced, larger sizing scale across the app
  const sizeMap = {
    sm: { img: 'w-10 h-10', text: 'text-xl', sub: 'text-[10px]' },
    md: { img: 'w-14 h-14 sm:w-16 sm:h-16', text: 'text-2xl sm:text-3xl', sub: 'text-xs' },
    lg: { img: 'w-24 h-24 sm:w-28 sm:h-28', text: 'text-3xl sm:text-4xl', sub: 'text-sm' },
    xl: { img: 'w-36 h-36 sm:w-44 sm:h-44', text: 'text-5xl sm:text-6xl', sub: 'text-base' },
  };

  const currentSize = sizeMap[size];

  if (variant === 'watermark') {
    return (
      <div className={`pointer-events-none select-none opacity-25 ${className}`}>
        <img
          src={LOGO_SRC}
          alt="LEFIT Logo"
          className="w-full h-full object-contain filter grayscale-0 scale-125"
        />
      </div>
    );
  }

  if (variant === 'icon') {
    return (
      <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
        <img
          src={LOGO_SRC}
          alt="LEFIT Emblem"
          className={`${currentSize.img} rounded-2xl object-contain border-2 border-[#660F0F] bg-[#1A070A] p-1 shadow-md`}
        />
      </div>
    );
  }

  // Matte pulsing for the 15-second wait (prominently larger)
  if (variant === 'pulsing') {
    return (
      <div className={`relative flex flex-col items-center justify-center ${className}`}>
        <div className="relative rounded-[2rem] p-4 sm:p-5 bg-[#1A070A] border-2 border-[#660F0F] shadow-xl animate-matte-pulse flex flex-col items-center">
          <img
            src={LOGO_SRC}
            alt="LEFIT Original Logo"
            className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl object-contain"
          />
          <div className="mt-2.5 font-black tracking-widest text-[#FF5757] text-2xl uppercase">
            LEFIT
          </div>
          <div className="text-xs uppercase font-bold tracking-wider text-[#E0B0B0]">
            100% Natürlich
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-3.5 select-none ${className}`}>
      <div className="relative p-1.5 rounded-2xl bg-[#1A070A] border-2 border-[#660F0F] shadow-sm shrink-0">
        <img
          src={LOGO_SRC}
          alt="LEFIT"
          className={`${currentSize.img} rounded-xl object-contain`}
        />
      </div>
      <div className="flex flex-col">
        <span className={`font-black tracking-tight text-white leading-none ${currentSize.text} flex items-center gap-1`}>
          LE<span className="text-[#FF5757]">FIT</span>
        </span>
        <span className={`font-bold uppercase tracking-wider text-[#FF5757] mt-1 ${currentSize.sub}`}>
          Clean Food
        </span>
      </div>
    </div>
  );
};
