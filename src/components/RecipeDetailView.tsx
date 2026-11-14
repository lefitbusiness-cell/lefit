import React, { useState } from 'react';
import {
  ArrowLeft,
  Clock,
  Award,
  Check,
  Sparkles,
  ChefHat,
  Dumbbell,
  ShieldCheck,
  Share2,
  Printer,
  Download,
  Flame,
} from 'lucide-react';
import { ScannedProduct } from '../types';
import { LefitLogo } from './LefitLogo';

interface RecipeDetailViewProps {
  product: ScannedProduct;
  onBack: () => void;
  onClose: () => void;
}

export const RecipeDetailView: React.FC<RecipeDetailViewProps> = ({
  product,
  onBack,
  onClose: _onClose,
}) => {
  const recipe = product.cleanRecipe;
  const [checkedIngredients, setCheckedIngredients] = useState<Record<number, boolean>>({});
  const [isCopied, setIsCopied] = useState(false);
  const [actionToast, setActionToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const originalCalories =
    product.originalCalories ||
    recipe.originalCalories ||
    'ca. 550 kcal (Normal / Vorher)';

  const cleanCalories =
    product.cleanCalories ||
    recipe.cleanCalories ||
    recipe.macros.calories ||
    'ca. 185 kcal';

  const calorieSavings =
    product.calorieSavings ||
    recipe.calorieSavings ||
    '-65% Zucker & 100% natürliche Vollwert-Zutaten';

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setActionToast({ type, text });
    setTimeout(() => setActionToast(null), 3000);
  };

  const formatRecipeText = () =>
    `
LEFIT Clean Rezept: ${recipe.title}
Alternative zu: ${product.productName} (${product.brand})
100% Natürlich • Ohne künstlichen Mist

Kalorien-Vergleich:
- Vorher Normal: ${originalCalories}
- In Gesund (LEFIT): ${cleanCalories}
- Ersparnis: ${calorieSavings}

Makros: ${recipe.macros.calories} | Protein: ${recipe.macros.protein} | Carbs: ${recipe.macros.carbs} | Fett: ${recipe.macros.fat}
Zubereitungszeit: ${recipe.prepTime}

Zutaten:
${recipe.ingredients.map((ing) => `- ${ing}`).join('\n')}

Zubereitung:
${recipe.instructions.map((step, i) => `${i + 1}. ${step}`).join('\n')}

Leons Fazit:
${recipe.leonsVerdict}
    `.trim();

  const toggleIngredient = (idx: number) => {
    setCheckedIngredients((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const handleCopyRecipe = async () => {
    const text = formatRecipeText();
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        copied = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        copied = false;
      }
    }

    if (copied) {
      setIsCopied(true);
      showToast('Rezept in Zwischenablage kopiert!');
      setTimeout(() => setIsCopied(false), 2500);
    } else {
      showToast('Kopieren in diesem Browser blockiert – nutze den Download-Button.', 'error');
    }
  };

  const handleDownloadRecipe = () => {
    const text = formatRecipeText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = recipe.title.toLowerCase().replace(/[^a-z0-9äöüß]+/gi, '-').replace(/^-|-$/g, '');
    link.href = url;
    link.download = `lefit-${safeName || 'rezept'}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Rezept als Textdatei heruntergeladen!');
  };

  return (
    <div className="flex flex-col h-full bg-[#1A070A] text-slate-100">
      {/* Detail Header */}
      <div className="px-5 py-4 border-b border-[#660F0F] bg-[#140507] flex items-center justify-between sticky top-0 z-20 gap-2">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-full bg-[#240A0E] hover:bg-[#330D13] text-[#FF5757] text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-[#660F0F]"
        >
          <ArrowLeft className="w-4 h-4" /> Zurück zur Liste
        </button>

        {actionToast && (
          <span
            className={`text-xs font-bold hidden sm:inline ${
              actionToast.type === 'error' ? 'text-[#ff414c]' : 'text-emerald-400'
            }`}
          >
            {actionToast.text}
          </span>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyRecipe}
            className="p-2 rounded-full bg-[#240A0E] hover:bg-[#330D13] text-[#FF5757] border border-[#660F0F] transition-colors cursor-pointer"
            title="Rezept kopieren"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handleDownloadRecipe}
            className="p-2 rounded-full bg-[#240A0E] hover:bg-[#330D13] text-[#FF5757] border border-[#660F0F] transition-colors cursor-pointer"
            title="Als Datei speichern"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="p-2 rounded-full bg-[#240A0E] hover:bg-[#330D13] text-[#FF5757] border border-[#660F0F] transition-colors cursor-pointer"
            title="Drucken"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-5 sm:p-7 overflow-y-auto space-y-5">
        {/* Banner with LEFIT Badge */}
        <div className="relative rounded-3xl p-6 bg-[#240A0E] border-2 border-[#660F0F] shadow-lg">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#1A070A] text-[#FF5757] text-xs font-black uppercase tracking-wider border border-[#660F0F]">
              <ShieldCheck className="w-3.5 h-3.5" /> 100% Natürlich
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#1A070A] text-emerald-400 text-xs font-black uppercase tracking-wider border border-emerald-900/60">
              <Sparkles className="w-3.5 h-3.5" /> Ohne künstlichen Mist
            </span>
            <span className="text-xs text-[#E0B0B0] font-medium">
              Passend zu: <span className="text-white font-bold">{product.productName}</span>
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            {recipe.title}
          </h1>
          <p className="text-[#FFBDBD] text-sm sm:text-base mt-1 font-medium">
            {recipe.subtitle}
          </p>

          {/* Quick specs */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-5 pt-4 border-t border-[#660F0F]">
            <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
              <span className="text-[10px] sm:text-xs text-[#A66D6D] uppercase font-bold flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#FF5757]" /> Zeit
              </span>
              <span className="text-xs sm:text-sm font-bold text-white mt-0.5">{recipe.prepTime}</span>
            </div>
            <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
              <span className="text-[10px] sm:text-xs text-[#A66D6D] uppercase font-bold flex items-center gap-1">
                <Award className="w-3 h-3 text-[#FF5757]" /> Level
              </span>
              <span className="text-xs sm:text-sm font-bold text-white mt-0.5">{recipe.difficulty}</span>
            </div>
            <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
              <span className="text-[10px] sm:text-xs text-[#A66D6D] uppercase font-bold flex items-center gap-1">
                <ChefHat className="w-3 h-3 text-[#FF5757]" /> Menge
              </span>
              <span className="text-xs sm:text-sm font-bold text-white mt-0.5">{recipe.servings}</span>
            </div>
          </div>
        </div>

        {/* PROMINENT KALORIEN-VERGLEICH: Vorher Normal vs. In Gesund */}
        <div className="rounded-2xl p-5 bg-[#140507] border-2 border-[#660F0F] shadow-sm">
          <div className="text-xs font-black uppercase tracking-wider text-[#FF5757] mb-3 flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#FF5757]" />
            <span>Kalorien-Vergleich: Normal (Vorher) vs. In Gesund (LEFIT)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-[#240A0E] border border-[#660F0F]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#A66D6D]">
                  Normal (Vorher)
                </span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#1A070A] text-[#A66D6D] border border-[#660F0F] font-bold">
                  Industriell
                </span>
              </div>
              <div className="text-lg sm:text-xl font-black text-rose-300 leading-tight">
                {originalCalories}
              </div>
              <div className="text-xs text-[#A66D6D] mt-1">
                Herkömmliche Variante mit Zucker & raffinierten Fetten
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#1D080C] border-2 border-[#FF5757]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#FF5757]">
                  In Gesund (LEFIT)
                </span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#660F0F] text-white border border-[#FF5757]/60 font-black">
                  100% Natürlich
                </span>
              </div>
              <div className="text-lg sm:text-xl font-black text-white leading-tight">
                {cleanCalories}
              </div>
              <div className="text-xs text-[#FFBDBD] mt-1 font-semibold">
                Nährstoffreich, vollwertig, ohne künstlichen Mist
              </div>
            </div>
          </div>

          <div className="mt-3 p-3.5 rounded-xl bg-[#240A0E] border border-[#FF5757]/40 flex items-center gap-2.5">
            <span className="text-xs font-black uppercase tracking-wider text-[#FF5757] shrink-0">
              Vorteil & Ersparnis:
            </span>
            <span className="text-xs sm:text-sm font-bold text-white">
              {calorieSavings}
            </span>
          </div>
        </div>

        {/* Nutritional Macros Breakdown */}
        <div className="rounded-2xl p-5 bg-[#240A0E] border border-[#660F0F] shadow-sm">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="font-extrabold text-white text-sm sm:text-base uppercase tracking-wider flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-[#FF5757]" /> LEFIT Makronährstoffe
            </h3>
            <span className="text-xs font-bold text-[#FF5757] bg-[#1A070A] px-2.5 py-0.5 rounded-full border border-[#660F0F]">
              Clean Fuel
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-[#160507] border border-[#660F0F] text-center">
              <div className="text-[11px] text-[#A66D6D] font-semibold uppercase">Kalorien</div>
              <div className="text-lg font-black text-white mt-0.5">{recipe.macros.calories}</div>
            </div>
            <div className="p-3 rounded-xl bg-[#160507] border border-[#660F0F] text-center">
              <div className="text-[11px] text-emerald-400 font-semibold uppercase">Protein</div>
              <div className="text-lg font-black text-emerald-300 mt-0.5">{recipe.macros.protein}</div>
            </div>
            <div className="p-3 rounded-xl bg-[#160507] border border-[#660F0F] text-center">
              <div className="text-[11px] text-[#FF5757] font-semibold uppercase">Kohlenhydrate</div>
              <div className="text-lg font-black text-white mt-0.5">{recipe.macros.carbs}</div>
            </div>
            <div className="p-3 rounded-xl bg-[#160507] border border-[#660F0F] text-center">
              <div className="text-[11px] text-[#FF8E92] font-semibold uppercase">Gesunde Fette</div>
              <div className="text-lg font-black text-[#FFA3A6] mt-0.5">{recipe.macros.fat}</div>
            </div>
          </div>

          {recipe.comparison && (
            <div className="mt-3 p-3 rounded-xl bg-[#1A070A] border border-[#660F0F] text-xs sm:text-sm text-[#FFBDBD] flex items-center gap-2">
              <span className="font-extrabold text-[#FF5757] uppercase shrink-0">Vorteil:</span>
              <span>{recipe.comparison}</span>
            </div>
          )}
        </div>

        {/* 100% Natural Ingredients Checklist */}
        <div className="rounded-2xl p-5 bg-[#240A0E] border border-[#660F0F] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-white text-base sm:text-lg flex items-center gap-2">
              <span>🌱 100% Natürliche Zutaten</span>
            </h3>
            <span className="text-xs text-[#E0B0B0]">
              {Object.values(checkedIngredients).filter(Boolean).length} von {recipe.ingredients.length} vorrätig
            </span>
          </div>

          <div className="space-y-2.5">
            {recipe.ingredients.map((ing, idx) => {
              const isChecked = !!checkedIngredients[idx];
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleIngredient(idx)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                    isChecked
                      ? 'bg-[#140507] border-[#660F0F]/50 text-[#A66D6D] line-through'
                      : 'bg-[#1A070A] hover:bg-[#1f090c] border-[#660F0F] text-slate-200'
                  }`}
                >
                  <div
                    className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                      isChecked
                        ? 'bg-[#FF5757] border-[#FF5757] text-[#120305]'
                        : 'border-[#660F0F] bg-[#120305]'
                    }`}
                  >
                    {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <span className="text-sm sm:text-base font-medium">{ing}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step-by-Step Preparation */}
        <div className="rounded-2xl p-5 bg-[#240A0E] border border-[#660F0F] shadow-sm">
          <h3 className="font-extrabold text-white text-base sm:text-lg mb-4 flex items-center gap-2">
            <span>👨‍🍳 Schritt-für-Schritt Zubereitung</span>
          </h3>

          <div className="space-y-3.5">
            {recipe.instructions.map((step, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3.5 p-3.5 rounded-xl bg-[#1A070A] border border-[#660F0F]"
              >
                <div className="w-7 h-7 rounded-lg bg-[#660F0F] text-[#FF5757] font-black text-sm flex items-center justify-center shrink-0 border border-[#FF5757]/40">
                  {idx + 1}
                </div>
                <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-normal pt-0.5">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Leon's Personal Verdict */}
        <div className="rounded-2xl p-5 bg-[#140507] border border-[#660F0F] shadow-sm">
          <div className="flex items-center gap-3 mb-2.5">
            <LefitLogo variant="icon" size="sm" />
            <div>
              <div className="font-black text-white text-base">Leons Fazit</div>
              <div className="text-xs text-[#FF5757] font-semibold">LEFIT Gründer & Coach</div>
            </div>
          </div>
          <p className="text-sm sm:text-base text-[#FFBDBD] leading-relaxed italic bg-[#1A070A] p-3.5 rounded-xl border border-[#660F0F]">
            "{recipe.leonsVerdict}"
          </p>
        </div>
      </div>
    </div>
  );
};
