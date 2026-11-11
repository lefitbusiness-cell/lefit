import React from 'react';
import { Sparkles, X, CheckCircle2 } from 'lucide-react';
import { ScannedProduct } from '../types';
import { LefitLogo } from './LefitLogo';

interface ProductInfoWindowProps {
  product: ScannedProduct | null;
  isOpen: boolean;
  onSaveProgress: (product: ScannedProduct) => void;
  onClose?: () => void;
}

export const ProductInfoWindow: React.FC<ProductInfoWindowProps> = ({
  product,
  isOpen,
  onSaveProgress,
  onClose,
}) => {
  if (!isOpen || !product) return null;

  // Single short, complete text combining health check and portion recommendation
  const combinedSummary = product.shortSummary
    ? product.shortSummary
    : `${product.healthCheck} Portionsempfehlung: ${product.portionTip}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#120305]/95 backdrop-blur-md overflow-y-auto animate-fadeIn select-none">
      <div className="relative w-full max-w-lg my-auto bg-[#1A070A] rounded-[2.5rem] border-2 border-[#660F0F] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Product / Food Header: Exact product / food written cleanly on top */}
        <div className="relative px-6 pt-6 pb-4 border-b border-[#660F0F] bg-[#140507]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-[#FF5757] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#FF5757]" />
              Erkanntes Produkt / Essen
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#240A0E] border border-[#660F0F] text-[#FFBDBD] font-bold">
                {product.brand}
              </span>
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-1 rounded-full text-[#E0B0B0] hover:text-white hover:bg-white/10 transition-colors ml-1"
                  title="Schließen"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Exact product / food name written prominently on top */}
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
            {product.productName}
          </h2>
          <p className="text-xs sm:text-sm text-[#E0B0B0] mt-1 font-medium">{product.category}</p>
        </div>

        {/* Content Body: Exactly ONE short text in WHITE, with health verdict and portion recommendation inside */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {/* Centered matte LEFIT Emblem */}
          <div className="flex justify-center pt-1">
            <LefitLogo variant="icon" size="lg" />
          </div>

          {/* Unified Short Summary in WHITE text */}
          <div className="rounded-2xl p-5 bg-[#240A0E] border border-[#660F0F] shadow-md">
            <div className="text-[11px] font-black uppercase tracking-wider text-[#FF5757] mb-2 flex items-center gap-2">
              <span>Leons Einschätzung & Portionsempfehlung</span>
            </div>
            {/* The text in pure crisp WHITE as requested */}
            <p className="text-white text-base sm:text-lg font-medium leading-relaxed">
              "{combinedSummary}"
            </p>
          </div>
        </div>

        {/* Bordeaux Button [ Fortschritt speichern ]: IMMEDIATELY AVAILABLE (NO waiting time!) */}
        <div className="p-5 sm:p-6 bg-[#140507] border-t border-[#660F0F]">
          <button
            onClick={() => onSaveProgress(product)}
            type="button"
            className="w-full py-4 px-6 rounded-2xl text-white font-black text-base sm:text-lg tracking-wider uppercase transition-all duration-200 transform active:scale-98 flex items-center justify-center gap-2.5 cursor-pointer border-2 border-[#FF5757] shadow-xl hover:brightness-110"
            style={{
              backgroundColor: '#660F0F',
            }}
          >
            <Sparkles className="w-5 h-5 text-[#FF5757]" />
            <span>Fortschritt speichern</span>
          </button>
        </div>
      </div>
    </div>
  );
};
