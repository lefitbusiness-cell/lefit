import React, { useState, useEffect } from 'react';
import { Sparkles, RotateCcw, LogOut, User } from 'lucide-react';
import { ScannedProduct, AuthUser } from './types';
import { LefitLogo } from './components/LefitLogo';
import { RoundActionButton } from './components/RoundActionButton';
import { ScannerModal } from './components/ScannerModal';
import { ProductInfoWindow } from './components/ProductInfoWindow';
import { SavedRecipesModal } from './components/SavedRecipesModal';
import { AuthMenuModal } from './components/AuthMenuModal';

const STORAGE_KEY_PRODUCTS = 'lefit_saved_scans_v3';
const STORAGE_KEY_AUTH = 'lefit_auth_user_v3';

export default function App() {
  // Authenticated user state
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_AUTH);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Saved products array (persisted in localStorage)
  const [savedProducts, setSavedProducts] = useState<ScannedProduct[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PRODUCTS);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Scanner & Info Modals
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [currentScannedProduct, setCurrentScannedProduct] = useState<ScannedProduct | null>(null);
  const [isInfoWindowOpen, setIsInfoWindowOpen] = useState(false);
  const [isSavedModalOpen, setIsSavedModalOpen] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(false);

  // Sync savedProducts
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(savedProducts));
    } catch (e) {
      console.warn('Failed to save products:', e);
    }
  }, [savedProducts]);

  // Sync authUser
  const handleLoginSuccess = (user: AuthUser) => {
    setAuthUser(user);
    try {
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(user));
    } catch (e) {
      console.warn('Failed to save auth:', e);
    }
  };

  const handleLogout = () => {
    setAuthUser(null);
    localStorage.removeItem(STORAGE_KEY_AUTH);
  };

  // Step 1 -> Step 2
  const handleProductDetected = (product: ScannedProduct) => {
    setIsScannerOpen(false);
    setCurrentScannedProduct(product);
    setIsInfoWindowOpen(true);
  };

  // Step 2 -> Step 3
  const handleSaveProgress = (product: ScannedProduct) => {
    setIsInfoWindowOpen(false);
    setSavedProducts((prev) => {
      const existing = prev.filter((p) => p.productName.toLowerCase() !== product.productName.toLowerCase());
      return [product, ...existing];
    });
    setJustUnlocked(true);
    setTimeout(() => setJustUnlocked(false), 3000);
  };

  const handleDeleteProduct = (id: string) => {
    setSavedProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleReset = () => {
    setSavedProducts([]);
    localStorage.removeItem(STORAGE_KEY_PRODUCTS);
  };

  const hasSavedRecipes = savedProducts.length > 0;

  return (
    <div className="min-h-screen bg-[#120305] text-[#F8F4F4] flex flex-col selection:bg-[#FF5757] selection:text-[#120305] relative overflow-hidden">
      {/* 1. SEAMLESS INTRO & AUTHENTICATION (Smooth uninterrupted morph) */}
      {!authUser && (
        <AuthMenuModal
          onLoginSuccess={handleLoginSuccess}
          startWithIntro={true}
        />
      )}

      {/* 3. MAIN SCANNER SCREEN (Exact Matte Colors, No Neon Glow) */}
      <header className="w-full border-b border-[#660F0F] bg-[#1A070A] sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <LefitLogo size="md" />

          {/* User profile & actions in matte finish */}
          <div className="flex items-center gap-3">
            {authUser && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#240A0E] border border-[#660F0F] text-xs">
                {authUser.avatar ? (
                  <img
                    src={authUser.avatar}
                    alt={authUser.name}
                    className="w-5 h-5 rounded-full object-cover border border-[#FF5757]"
                  />
                ) : (
                  <User className="w-4 h-4 text-[#FF5757]" />
                )}
                <span className="font-bold text-white hidden sm:inline">{authUser.name}</span>
                <button
                  onClick={handleLogout}
                  className="p-1 hover:text-[#FF5757] transition-colors ml-1"
                  title="Abmelden"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {hasSavedRecipes && (
              <button
                onClick={handleReset}
                className="px-2.5 py-1.5 rounded-xl bg-[#240A0E] hover:bg-[#330D13] text-[#E0B0B0] hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-[#660F0F]"
                title="Scanner zurücksetzen"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Action Center: Pure matte focus on the round [ Scanner ] */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 flex flex-col items-center justify-center py-12 sm:py-20 text-center">
        <div className="flex flex-col items-center justify-center my-auto">
          {/* Circular Action Buttons: initially ONLY [ Scanner ], unlocks [ Gespeicherte Rezepte ] after save */}
          <div className="flex flex-wrap items-center justify-center gap-10 sm:gap-16 transition-all duration-300">
            <RoundActionButton
              type="scanner"
              onClick={() => setIsScannerOpen(true)}
            />

            {hasSavedRecipes && (
              <RoundActionButton
                type="saved-recipes"
                onClick={() => setIsSavedModalOpen(true)}
                savedCount={savedProducts.length}
                isNewlyUnlocked={justUnlocked}
              />
            )}
          </div>

          {/* Clean helper indicator */}
          {hasSavedRecipes && justUnlocked && (
            <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#240A0E] border border-[#FF5757] text-[#FF5757] text-xs sm:text-sm font-bold animate-fadeIn shadow-md">
              <Sparkles className="w-4 h-4" />
              Rezept gesichert! Klicke auf [ Gespeicherte Rezepte ].
            </div>
          )}
        </div>
      </main>

      {/* Minimal matte footer */}
      <footer className="w-full py-4 text-center text-[11px] text-[#A66D6D] border-t border-[#660F0F] bg-[#140507]">
        LEFIT • 100% Natürlich • Ohne künstlichen Mist
      </footer>

      {/* STEP 1: MATTE CAMERA SCANNER */}
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onProductDetected={handleProductDetected}
      />

      {/* STEP 2: PRODUCT INFO WINDOW (15s MATTE LOGO PULSE, LOCKED RECIPE, BORDEAUX BUTTON) */}
      <ProductInfoWindow
        isOpen={isInfoWindowOpen}
        product={currentScannedProduct}
        onSaveProgress={handleSaveProgress}
        onClose={() => setIsInfoWindowOpen(false)}
      />

      {/* STEP 4: SAVED RECIPES (LIST -> 2ND CLICK OPENS FULL RECIPE) */}
      <SavedRecipesModal
        isOpen={isSavedModalOpen}
        onClose={() => setIsSavedModalOpen(false)}
        savedProducts={savedProducts}
        onDeleteProduct={handleDeleteProduct}
      />
    </div>
  );
}
