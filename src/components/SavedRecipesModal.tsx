import React, { useState } from 'react';
import { X, BookOpen, ChevronRight, Trash2, Calendar, Sparkles } from 'lucide-react';
import { ScannedProduct } from '../types';
import { RecipeDetailView } from './RecipeDetailView';
import { LefitLogo } from './LefitLogo';

interface SavedRecipesModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedProducts: ScannedProduct[];
  onDeleteProduct: (id: string) => void;
}

export const SavedRecipesModal: React.FC<SavedRecipesModalProps> = ({
  isOpen,
  onClose,
  savedProducts,
  onDeleteProduct,
}) => {
  // Step 4: selectedProduct tracks the 2nd click inside the menu
  const [selectedProduct, setSelectedProduct] = useState<ScannedProduct | null>(null);

  if (!isOpen) return null;

  // If user clicked on a product (2nd click), show the full recipe detail page
  if (selectedProduct) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#120305]/95 backdrop-blur-md overflow-hidden animate-fadeIn">
        <div className="relative w-full max-w-3xl h-[92vh] bg-[#1A070A] rounded-[2rem] border-2 border-[#660F0F] shadow-2xl overflow-hidden flex flex-col">
          <RecipeDetailView
            product={selectedProduct}
            onBack={() => setSelectedProduct(null)}
            onClose={onClose}
          />
        </div>
      </div>
    );
  }

  // 1st Click view: List of scanned products in matte palette
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#120305]/95 backdrop-blur-md overflow-hidden animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#1A070A] rounded-[2rem] border-2 border-[#660F0F] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#660F0F] bg-[#140507] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#660F0F] text-[#FF5757] border border-[#FF5757]/40">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Gespeicherte Rezepte
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#FF5757] text-[#120305] font-black">
                  {savedProducts.length}
                </span>
              </h2>
              <p className="text-xs text-[#E0B0B0] mt-0.5">
                Klicke auf ein Produkt, um das vollständige LEFIT-Rezept einzusehen
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#E0B0B0] hover:text-white hover:bg-white/10 transition-colors"
            title="Schließen"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* List of scanned products */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-3.5">
          {savedProducts.length === 0 ? (
            <div className="text-center py-12 px-4 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-[#140507] border border-[#660F0F] flex items-center justify-center mb-3 text-[#A66D6D]">
                <BookOpen className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-white text-base">Noch keine Rezepte gespeichert</h3>
              <p className="text-[#E0B0B0] text-xs sm:text-sm mt-1 max-w-xs">
                Scanne oben mit dem [ Scanner ] ein beliebiges Produkt oder Essen und speichere deinen Fortschritt!
              </p>
            </div>
          ) : (
            savedProducts.map((item) => {
              const formattedDate = new Date(item.timestamp).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={item.id}
                  className="group relative rounded-2xl p-4 sm:p-5 bg-[#240A0E] hover:bg-[#300D13] border border-[#660F0F] hover:border-[#FF5757] transition-all duration-200 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer"
                  onClick={() => setSelectedProduct(item)}
                >
                  <div className="flex items-start gap-4 flex-1">
                    {/* Emblem thumbnail with user's authentic logo */}
                    <div className="w-12 h-12 rounded-xl bg-[#1A070A] border border-[#660F0F] flex items-center justify-center shrink-0">
                      <LefitLogo variant="icon" size="sm" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF5757]">
                          {item.brand}
                        </span>
                        <span className="text-[#660F0F]">•</span>
                        <span className="text-[10px] text-[#A66D6D] flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {formattedDate}
                        </span>
                      </div>

                      <h3 className="text-base sm:text-lg font-black text-white group-hover:text-[#FF5757] transition-colors truncate">
                        {item.productName}
                      </h3>

                      <p className="text-xs text-[#E0B0B0] font-medium truncate mt-0.5">
                        Clean Recipe: <span className="text-white font-semibold">{item.cleanRecipe.title}</span>
                      </p>

                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#660F0F] text-[#FFBDBD] font-bold border border-[#660F0F]">
                          100% Natürlich
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#160507] text-[#FF5757] font-bold border border-[#660F0F]">
                          {item.cleanRecipe.macros.calories}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 self-end sm:self-center w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-[#660F0F]/40 pt-2 sm:pt-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteProduct(item.id);
                      }}
                      className="p-2 rounded-xl text-[#A66D6D] hover:text-[#FF5757] hover:bg-[#1A070A] transition-colors"
                      title="Entfernen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedProduct(item)}
                      className="px-4 py-2.5 rounded-xl bg-[#FF5757] group-hover:bg-[#E84E50] text-[#120305] text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                      <span>Rezept öffnen</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        {savedProducts.length > 0 && (
          <div className="px-6 py-3.5 bg-[#140507] border-t border-[#660F0F] text-center">
            <span className="text-xs text-[#E0B0B0] flex items-center justify-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-[#FF5757]" /> 100% natürliche Zutaten • Ohne künstlichen Mist.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
