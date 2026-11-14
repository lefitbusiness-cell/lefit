import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Flame,
  ChefHat,
  Clock,
  Award,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  AlertCircle,
} from 'lucide-react';
import { ScannedProduct } from '../types';
import { LefitLogo } from './LefitLogo';

interface ProductInfoWindowProps {
  product: ScannedProduct | null;
  isOpen: boolean;
  onSaveProgress: (product: ScannedProduct) => void | Promise<void>;
  onClose?: () => void;
  saveError?: string | null;
  isSaving?: boolean;
}

export const ProductInfoWindow: React.FC<ProductInfoWindowProps> = ({
  product,
  isOpen,
  onSaveProgress,
  onClose,
  saveError = null,
  isSaving = false,
}) => {
  const [showFullIngredients, setShowFullIngredients] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  if (!isOpen || !product) return null;

  const recipe = product.cleanRecipe;

  // Single short, complete text combining health check and portion recommendation
  const combinedSummary = product.shortSummary
    ? product.shortSummary
    : `${product.healthCheck} Portionsempfehlung: ${product.portionTip}`;

  // Calorie comparison metrics
  const originalCalories =
    product.originalCalories ||
    recipe?.originalCalories ||
    'ca. 550 kcal (Normal / Vorher)';

  const cleanCalories =
    product.cleanCalories ||
    recipe?.cleanCalories ||
    recipe?.macros?.calories ||
    'ca. 185 kcal';

  const calorieSavings =
    product.calorieSavings ||
    recipe?.calorieSavings ||
    '-65% Zucker & 100% natürliche Fette statt Palmöl';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#120305]/95 backdrop-blur-md overflow-y-auto animate-fadeIn select-none">
      <div className="relative w-full max-w-xl my-auto bg-[#1A070A] rounded-[2.5rem] border-2 border-[#660F0F] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Product / Food Header: Exact product / food written cleanly on top */}
        <div className="relative px-6 pt-5 pb-4 border-b border-[#660F0F] bg-[#140507]">
          <div className="flex items-center justify-between mb-1.5">
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
                  className="p-1 rounded-full text-[#E0B0B0] hover:text-white hover:bg-white/10 transition-colors ml-1 cursor-pointer"
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
          <p className="text-xs sm:text-sm text-[#E0B0B0] mt-0.5 font-medium">{product.category}</p>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {/* Centered matte LEFIT Emblem */}
          <div className="flex justify-center">
            <LefitLogo variant="icon" size="md" />
          </div>

          {/* 1. Unified Short Summary in pure WHITE text with portion tip */}
          <div className="rounded-2xl p-4 sm:p-5 bg-[#240A0E] border border-[#660F0F] shadow-md">
            <div className="text-[11px] font-black uppercase tracking-wider text-[#FF5757] mb-2 flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Leons Einschätzung & Portionsempfehlung</span>
            </div>
            {/* Pure crisp WHITE text as requested */}
            <p className="text-white text-sm sm:text-base font-medium leading-relaxed">
              "{combinedSummary}"
            </p>
          </div>

          {/* 2. PROMINENT KALORIEN-VERGLEICH: Vorher Normal vs. In Gesund */}
          <div className="rounded-2xl p-4 sm:p-5 bg-[#140507] border-2 border-[#660F0F] shadow-md">
            <div className="text-[11px] font-black uppercase tracking-wider text-[#FF5757] mb-3 flex items-center gap-2">
              <Flame className="w-4 h-4 text-[#FF5757]" />
              <span>Kalorien-Vergleich: Vorher normal vs. In Gesund</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Vorher Normal (Commercial / Fast Food) */}
              <div className="p-3.5 rounded-xl bg-[#240A0E] border border-[#660F0F]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#A66D6D]">
                    Normal (Vorher)
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#1A070A] text-[#A66D6D] border border-[#660F0F] font-bold">
                    Original
                  </span>
                </div>
                <div className="text-base sm:text-lg font-black text-rose-300 leading-tight">
                  {originalCalories}
                </div>
                <div className="text-[10px] text-[#A66D6D] mt-1">
                  Voll Industriezucker & Palmöl
                </div>
              </div>

              {/* In Gesund (LEFIT Clean Remake) */}
              <div className="p-3.5 rounded-xl bg-[#1D080C] border-2 border-[#FF5757]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#FF5757]">
                    In Gesund (LEFIT)
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#660F0F] text-white border border-[#FF5757]/60 font-black">
                    100% Natürlich
                  </span>
                </div>
                <div className="text-base sm:text-lg font-black text-white leading-tight">
                  {cleanCalories}
                </div>
                <div className="text-[10px] text-[#FFBDBD] mt-1 font-semibold">
                  Volle Mikronährstoffe, kein Palmöl
                </div>
              </div>
            </div>

            {/* Direct Savings Callout */}
            <div className="mt-3 p-3 rounded-xl bg-[#240A0E] border border-[#FF5757]/40 flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#FF5757] shrink-0">
                Ersparnis:
              </span>
              <span className="text-xs sm:text-sm font-bold text-white">
                {calorieSavings}
              </span>
            </div>
          </div>

          {/* 3. DAS PASSENDE REZEPT IN GESUND (Direkt angezeigt!) */}
          {recipe && (
            <div className="rounded-2xl p-4 sm:p-5 bg-[#240A0E] border border-[#660F0F] shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#FF5757] flex items-center gap-1.5">
                  <ChefHat className="w-3.5 h-3.5" />
                  Passendes Rezept in Gesund
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1A070A] text-emerald-400 font-bold border border-emerald-900/40">
                  100% Natürlich
                </span>
              </div>

              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                {recipe.title}
              </h3>
              <p className="text-xs text-[#FFBDBD] mt-0.5 font-medium">
                {recipe.subtitle}
              </p>

              {/* Recipe Meta Badges */}
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-2.5 border-t border-[#660F0F]/60">
                <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-[#1A070A] text-white font-bold border border-[#660F0F]">
                  <Clock className="w-3 h-3 text-[#FF5757]" /> {recipe.prepTime}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-[#1A070A] text-white font-bold border border-[#660F0F]">
                  <Award className="w-3 h-3 text-[#FF5757]" /> {recipe.difficulty}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-[#1A070A] text-emerald-300 font-bold border border-[#660F0F]">
                  <Dumbbell className="w-3 h-3 text-emerald-400" /> {recipe.macros.protein} Protein
                </span>
              </div>

              {/* Natural Ingredients Preview */}
              <div className="mt-3 pt-3 border-t border-[#660F0F]/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#A66D6D]">
                    🌱 Natürliche Zutaten ({recipe.ingredients.length})
                  </span>
                  {recipe.ingredients.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setShowFullIngredients(!showFullIngredients)}
                      className="text-[11px] text-[#FF5757] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {showFullIngredients ? (
                        <>Weniger <ChevronUp className="w-3 h-3" /></>
                      ) : (
                        <>Alle Zutaten <ChevronDown className="w-3 h-3" /></>
                      )}
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {(showFullIngredients ? recipe.ingredients : recipe.ingredients.slice(0, 3)).map(
                    (ing, idx) => (
                      <div
                        key={idx}
                        className="text-xs text-white/90 bg-[#1A070A] px-2.5 py-1.5 rounded-lg border border-[#660F0F]/50 flex items-center gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF5757] shrink-0" />
                        <span>{ing}</span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Step-by-Step Instructions Accordion */}
              {recipe.instructions && recipe.instructions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[#660F0F]/60">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#A66D6D]">
                      👨‍🍳 Zubereitung ({recipe.instructions.length} Schritte)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowInstructions(!showInstructions)}
                      className="text-[11px] text-[#FF5757] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {showInstructions ? (
                        <>Ausblenden <ChevronUp className="w-3 h-3" /></>
                      ) : (
                        <>Schritte ansehen <ChevronDown className="w-3 h-3" /></>
                      )}
                    </button>
                  </div>

                  {showInstructions && (
                    <div className="space-y-2 mt-2">
                      {recipe.instructions.map((step, idx) => (
                        <div
                          key={idx}
                          className="text-xs text-white/90 bg-[#1A070A] p-2.5 rounded-lg border border-[#660F0F]/50 flex items-start gap-2"
                        >
                          <span className="w-5 h-5 rounded-md bg-[#660F0F] text-[#FF5757] font-bold flex items-center justify-center shrink-0 text-[10px]">
                            {idx + 1}
                          </span>
                          <span className="leading-relaxed pt-0.5">{step}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bordeaux Button [ Fortschritt speichern ]: IMMEDIATELY AVAILABLE (NO waiting time!) */}
        <div className="p-5 sm:p-6 bg-[#140507] border-t border-[#660F0F] space-y-3">
          {saveError && (
            <div className="p-3 rounded-2xl bg-[#2B060B] border border-[#FF5757]/70 text-white text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#FF5757] mt-0.5" />
              <span>{saveError}</span>
            </div>
          )}

          <button
            onClick={() => onSaveProgress(product)}
            disabled={isSaving}
            type="button"
            className="w-full py-4 px-6 rounded-full text-white font-black text-base sm:text-lg tracking-wider uppercase transition-all duration-200 transform active:scale-98 flex items-center justify-center gap-2.5 cursor-pointer border-2 border-[#FF5757] shadow-xl hover:brightness-110 disabled:opacity-60"
            style={{
              backgroundColor: '#660F0F',
            }}
          >
            <Sparkles className="w-5 h-5 text-[#FF5757]" />
            <span>{isSaving ? 'Speichere...' : 'Fortschritt speichern'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
