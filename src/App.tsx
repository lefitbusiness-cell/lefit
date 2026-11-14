import React, { useState, useEffect } from 'react';
import { Sparkles, RotateCcw, LogOut, User } from 'lucide-react';
import { ScannedProduct, AuthUser } from './types';
import { LefitLogo } from './components/LefitLogo';
import { RoundActionButton } from './components/RoundActionButton';
import { ScannerModal } from './components/ScannerModal';
import { ProductInfoWindow } from './components/ProductInfoWindow';
import { SavedRecipesModal } from './components/SavedRecipesModal';
import { AuthMenuModal } from './components/AuthMenuModal';
import {
  deleteServerRecipe,
  fetchServerRecipes,
  fetchSessionMe,
  getAuthToken,
  resetServerRecipes,
  saveServerRecipe,
  setAuthToken,
  syncServerRecipes,
} from './services/lefitApi';

const STORAGE_KEY_AUTH = 'lefit_auth_user_v4';

const getUserStorageKey = (user: AuthUser | null) => {
  if (!user || !user.email) return 'lefit_saved_scans_guest';
  const safeEmail = encodeURIComponent(user.email.toLowerCase().trim());
  return `lefit_saved_scans_user_${safeEmail}`;
};

export default function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(() => Boolean(getAuthToken()));
  const [savedProducts, setSavedProducts] = useState<ScannedProduct[]>([]);

  // Modals & UI States
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [currentScannedProduct, setCurrentScannedProduct] = useState<ScannedProduct | null>(null);
  const [isInfoWindowOpen, setIsInfoWindowOpen] = useState(false);
  const [isSavedModalOpen, setIsSavedModalOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingRecipe, setIsSavingRecipe] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(false);

  // Sync user's recipes between localStorage partition and server account
  const loadAndSyncAccountData = async (user: AuthUser) => {
    try {
      const userKey = getUserStorageKey(user);
      const localRaw = localStorage.getItem(userKey);
      const localList: ScannedProduct[] = localRaw ? JSON.parse(localRaw) : [];

      if (Array.isArray(localList) && localList.length > 0) {
        const synced = await syncServerRecipes(localList);
        if (synced.success && synced.savedRecipes) {
          setSavedProducts(synced.savedRecipes);
          localStorage.setItem(userKey, JSON.stringify(synced.savedRecipes));
          return;
        }
      }

      const fetched = await fetchServerRecipes();
      if (fetched.success && fetched.savedRecipes) {
        setSavedProducts(fetched.savedRecipes);
        localStorage.setItem(userKey, JSON.stringify(fetched.savedRecipes));
      }
    } catch (err) {
      console.warn('Recipe sync failed:', err);
    }
  };

  // Validate active HMAC token session on startup
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      localStorage.removeItem(STORAGE_KEY_AUTH);
      setAuthUser(null);
      setIsCheckingSession(false);
      return;
    }

    (async () => {
      try {
        const me = await fetchSessionMe();
        if (!me.success || !me.user) {
          setAuthToken(null);
          localStorage.removeItem(STORAGE_KEY_AUTH);
          setAuthUser(null);
          setSavedProducts([]);
          return;
        }

        setAuthUser(me.user);
        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(me.user));
        await loadAndSyncAccountData(me.user);
      } catch {
        setAuthToken(null);
        setAuthUser(null);
      } finally {
        setIsCheckingSession(false);
      }
    })();
  }, []);

  // Persist mirror in user's localStorage partition when savedProducts updates
  useEffect(() => {
    if (!authUser) return;
    try {
      const userKey = getUserStorageKey(authUser);
      localStorage.setItem(userKey, JSON.stringify(savedProducts));
    } catch {
      // ignore storage errors
    }
  }, [savedProducts, authUser]);

  // Handle verified login success (exact password confirmed on server)
  const handleLoginSuccess = async (result: { user: AuthUser; token: string }) => {
    setAuthToken(result.token);
    setAuthUser(result.user);
    localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(result.user));
    await loadAndSyncAccountData(result.user);
  };

  // Strict immediate logout: wipe token + memory state
  const handleLogout = () => {
    setAuthToken(null);
    setAuthUser(null);
    setSavedProducts([]);
    setCurrentScannedProduct(null);
    setIsInfoWindowOpen(false);
    setIsScannerOpen(false);
    setIsSavedModalOpen(false);
    localStorage.removeItem(STORAGE_KEY_AUTH);
  };

  // Step 1 -> Step 2 (Called manually or via live Auto-Scan!)
  const handleProductDetected = (product: ScannedProduct) => {
    setSaveError(null);
    setIsScannerOpen(false);
    setCurrentScannedProduct(product);
    setIsInfoWindowOpen(true);
  };

  // Step 2 -> Step 3 (Save unlimited clean recipes to user account)
  const handleSaveProgress = async (product: ScannedProduct) => {
    setIsSavingRecipe(true);
    setSaveError(null);
    try {
      const res = await saveServerRecipe(product);
      if (!res.success) {
        setSaveError(res.error || 'Rezept konnte nicht auf dem Server gespeichert werden.');
        return;
      }
      if (res.savedRecipes) {
        setSavedProducts(res.savedRecipes);
      }
      setIsInfoWindowOpen(false);
      setJustUnlocked(true);
      setTimeout(() => setJustUnlocked(false), 3000);
    } catch {
      setSaveError('Rezept konnte nicht auf dem Server gespeichert werden.');
    } finally {
      setIsSavingRecipe(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    const res = await deleteServerRecipe(id);
    if (res.success && res.savedRecipes) {
      setSavedProducts(res.savedRecipes);
    } else {
      setSavedProducts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleReset = async () => {
    await resetServerRecipes();
    if (authUser) {
      const userKey = getUserStorageKey(authUser);
      localStorage.removeItem(userKey);
    }
    setSavedProducts([]);
  };

  const hasSavedRecipes = savedProducts.length > 0;

  return (
    <div className="min-h-screen bg-[#120305] text-[#F8F4F4] flex flex-col selection:bg-[#FF5757] selection:text-[#120305] relative overflow-hidden">
      {/* 1. SEAMLESS INTRO & STRICT PASSWORD AUTH */}
      {!isCheckingSession && !authUser && (
        <AuthMenuModal onLoginSuccess={handleLoginSuccess} startWithIntro={true} />
      )}

      {/* 2. TOP BAR */}
      <header className="w-full border-b border-[#660F0F] bg-[#1A070A] sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-5 py-3.5 flex items-center justify-between gap-2">
          <LefitLogo size="md" />

          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap justify-end">
            {authUser && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#240A0E] border border-[#660F0F] text-xs">
                <User className="w-4 h-4 text-[#FF5757]" />
                <span className="font-bold text-white hidden sm:inline">{authUser.name}</span>
                <button
                  onClick={handleLogout}
                  className="p-0.5 hover:text-[#FF5757] transition-colors cursor-pointer"
                  title="Abmelden"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {hasSavedRecipes && (
              <button
                onClick={handleReset}
                className="px-3 py-1.5 rounded-full bg-[#240A0E] hover:bg-[#330D13] text-[#E0B0B0] hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-[#660F0F] cursor-pointer"
                title="Rezepte zurücksetzen"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Reset</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 3. MAIN ACTION CENTER */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 flex flex-col items-center justify-center py-12 sm:py-20 text-center">
        <div className="flex flex-col items-center justify-center my-auto">
          <div className="flex flex-wrap items-center justify-center gap-10 sm:gap-16 transition-all duration-300">
            <RoundActionButton type="scanner" onClick={() => setIsScannerOpen(true)} />

            {hasSavedRecipes && (
              <RoundActionButton
                type="saved-recipes"
                onClick={() => setIsSavedModalOpen(true)}
                savedCount={savedProducts.length}
                isNewlyUnlocked={justUnlocked}
              />
            )}
          </div>

          {hasSavedRecipes && justUnlocked && (
            <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#240A0E] border border-[#FF5757] text-[#FF5757] text-xs sm:text-sm font-bold animate-fadeIn shadow-md">
              <Sparkles className="w-4 h-4" />
              Rezept gesichert! Klicke auf [ Gespeicherte Rezepte ].
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-[11px] text-[#A66D6D] border-t border-[#660F0F] bg-[#140507]">
        LEFIT • 100% Natürlich • Ohne künstlichen Mist
      </footer>

      {/* STEP 1: AUTO-ADVANCING UNIVERSAL CAMERA SCANNER */}
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onProductDetected={handleProductDetected}
      />

      {/* STEP 2: PRODUCT INFO & CLEAN RECIPE WINDOW */}
      <ProductInfoWindow
        isOpen={isInfoWindowOpen}
        product={currentScannedProduct}
        onSaveProgress={handleSaveProgress}
        onClose={() => setIsInfoWindowOpen(false)}
        saveError={saveError}
        isSaving={isSavingRecipe}
      />

      {/* STEP 3: SAVED RECIPES */}
      <SavedRecipesModal
        isOpen={isSavedModalOpen}
        onClose={() => setIsSavedModalOpen(false)}
        savedProducts={savedProducts}
        onDeleteProduct={handleDeleteProduct}
      />
    </div>
  );
}
