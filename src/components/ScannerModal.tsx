import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  X,
  Upload,
  Zap,
  AlertCircle,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { ScannedProduct } from '../types';
import { LefitLogo } from './LefitLogo';
import { scanProductRequest } from '../services/lefitApi';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductDetected: (product: ScannedProduct) => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  onProductDetected,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Refs for clean async auto-scan lifecycle management
  const autoScanBusyRef = useRef(false);
  const completedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isScanning, setIsScanning] = useState(false);
  const [autoDetectedBanner, setAutoDetectedBanner] = useState<string | null>(null);
  const [analyzingText, setAnalyzingText] = useState('LEFIT KI erkennt Packung & Essen...');
  const [searchHint, setSearchHint] = useState('');

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      stopCamera();

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError(
        'Kamera im Browser nicht aktivierbar. Du kannst ein Foto hochladen oder unten ein beliebiges Essen/Produkt eingeben.'
      );
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    if (!isOpen) {
      completedRef.current = false;
      autoScanBusyRef.current = false;
      setAutoDetectedBanner(null);
      stopCamera();
      return;
    }
    completedRef.current = false;
    autoScanBusyRef.current = false;
    setScanError(null);
    setAutoDetectedBanner(null);
    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode, startCamera, stopCamera]);

  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const captureFrameWithActivity = (): { dataUrl: string; hasSceneContent: boolean } | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    if (video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) return null;

    const canvas = canvasRef.current;
    const width = video.videoWidth;
    const height = video.videoHeight;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, width, height);

    let hasSceneContent = true;
    try {
      const sample = ctx.getImageData(
        Math.floor(width * 0.25),
        Math.floor(height * 0.25),
        Math.min(64, Math.floor(width * 0.5)),
        Math.min(64, Math.floor(height * 0.5))
      ).data;
      let sum = 0;
      let sumSq = 0;
      const count = sample.length / 4;
      for (let i = 0; i < sample.length; i += 4) {
        const lum = sample[i] * 0.299 + sample[i + 1] * 0.587 + sample[i + 2] * 0.114;
        sum += lum;
        sumSq += lum * lum;
      }
      const mean = sum / count;
      const variance = sumSq / count - mean * mean;
      if (mean < 12 || variance < 18) {
        hasSceneContent = false;
      }
    } catch {
      hasSceneContent = true;
    }

    return {
      dataUrl: canvas.toDataURL('image/jpeg', 0.88),
      hasSceneContent,
    };
  };

  const buildScannedItem = (data: any, imageBase64?: string): ScannedProduct => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    productName: data.productName,
    brand: data.brand,
    category: data.category,
    originalCalories: data.originalCalories || data.cleanRecipe?.originalCalories,
    cleanCalories: data.cleanCalories || data.cleanRecipe?.cleanCalories,
    calorieSavings: data.calorieSavings || data.cleanRecipe?.calorieSavings,
    healthCheck: data.healthCheck,
    portionTip: data.portionTip,
    shortSummary: data.shortSummary,
    cleanRecipe: data.cleanRecipe,
    thumbnail: imageBase64,
  });

  const advanceWithProduct = useCallback(
    (item: ScannedProduct, briefDelayMs = 0) => {
      if (completedRef.current) return;
      completedRef.current = true;
      if (briefDelayMs > 0) {
        setAutoDetectedBanner(`${item.productName} erkannt – weiter...`);
        setTimeout(() => {
          stopCamera();
          onProductDetected(item);
        }, briefDelayMs);
      } else {
        stopCamera();
        onProductDetected(item);
      }
    },
    [onProductDetected, stopCamera]
  );

  const processScan = async (payload: { imageBase64?: string; sampleId?: string; productNameHint?: string }) => {
    if (completedRef.current) return;
    setIsScanning(true);
    setScanError(null);
    setAnalyzingText(
      payload.productNameHint
        ? `Erkenne "${payload.productNameHint}"...`
        : 'LEFIT KI analysiert Packung & Essen...'
    );

    try {
      const result = await scanProductRequest({ ...payload, autoScan: false });

      if (result.success && result.data) {
        const item = buildScannedItem(result.data, payload.imageBase64);
        advanceWithProduct(item, 0);
      } else {
        throw new Error(result.error || 'Produkt konnte nicht erkannt werden.');
      }
    } catch (err: any) {
      console.error('Scan error:', err);
      setScanError(
        err?.message || 'Produkt konnte nicht erkannt werden. Bitte halte die Packung ruhiger oder tippe den Namen ein.'
      );
    } finally {
      setIsScanning(false);
    }
  };

  // LIVE AUTO-SCANNER
  useEffect(() => {
    if (!isOpen || !stream || cameraError) return;

    const interval = setInterval(async () => {
      if (completedRef.current || isScanning || autoScanBusyRef.current) return;

      const captured = captureFrameWithActivity();
      if (!captured || !captured.hasSceneContent) return;

      autoScanBusyRef.current = true;
      try {
        const result = await scanProductRequest({
          imageBase64: captured.dataUrl,
          autoScan: true,
        });

        if (result.success && result.recognized && result.data) {
          const item = buildScannedItem(result.data, captured.dataUrl);
          advanceWithProduct(item, 320);
        }
      } catch {
        // Silent retry on next auto-scan tick
      } finally {
        autoScanBusyRef.current = false;
      }
    }, 2200);

    return () => clearInterval(interval);
  }, [isOpen, stream, cameraError, isScanning, advanceWithProduct]);

  const handleCaptureClick = () => {
    const captured = captureFrameWithActivity();
    if (captured) {
      processScan({
        imageBase64: captured.dataUrl,
        productNameHint: searchHint.trim() || undefined,
      });
    } else {
      setScanError('Kein Bild erfasst. Bitte erlaube den Kamerazugriff oder lade ein Foto hoch.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      processScan({ imageBase64: base64, productNameHint: file.name.replace(/\.[^/.]+$/, '') });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCustomSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchHint.trim()) return;
    processScan({ productNameHint: searchHint.trim() });
  };

  const [activeCategory, setActiveCategory] = useState<'Beliebt' | 'Süßes' | 'Herzhaft' | 'Snacks'>('Beliebt');

  const foodCategories = {
    Beliebt: [
      'Pizza Margherita',
      'Cheeseburger',
      'Kinder Bueno',
      'Pringles Sour Cream',
      'Döner Kebab',
      'Spaghetti Carbonara',
      'Snickers',
      'Coca-Cola',
    ],
    Süßes: [
      'Kinder Bueno',
      'Duplo',
      'Hanuta',
      'Kinder Riegel',
      'Nutella',
      'Twix',
      'Bounty',
      'Mars Riegel',
      'Oreo Kekse',
      'Milka Schokolade',
      'Haribo Goldbären',
    ],
    Herzhaft: [
      'Pizza Margherita',
      'Pizza Salami',
      'Cheeseburger',
      'Döner Kebab',
      'Spaghetti Bolognese',
      'Lasagne',
      'Currywurst mit Pommes',
      'Sushi Lachs Bowl',
      'Rotes Thai-Curry',
      'Burrito',
    ],
    Snacks: [
      'Pringles Sour Cream',
      'Paprika Kartoffelchips',
      'Doritos Nacho Cheese',
      'Coca-Cola',
      'Red Bull',
      'Protein Pancakes',
      'Nicecream Eiscreme',
      'Bio-Apfel mit Zimt',
    ],
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#120305]/95 backdrop-blur-md animate-fadeIn select-none">
      <canvas ref={canvasRef} className="hidden" />

      <div className="relative w-full max-w-lg bg-[#1A070A] rounded-[2rem] sm:rounded-[2.5rem] border-2 border-[#660F0F] shadow-2xl overflow-hidden flex flex-col max-h-[96vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#660F0F] bg-[#140507]">
          <div className="flex items-center gap-2.5">
            <LefitLogo variant="icon" size="sm" />
            <div>
              <span className="font-black text-white text-sm sm:text-base tracking-wider uppercase block leading-none">
                LEFIT <span className="text-[#FF5757]">Universal Scanner</span>
              </span>
              <span className="text-[10px] font-bold text-[#E0B0B0] mt-1 block">
                Automatische Live-Erkennung
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-full text-[#E0B0B0] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Window */}
        <div className="relative flex-1 min-h-[240px] sm:min-h-[340px] bg-black flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center max-w-sm flex flex-col items-center">
              <AlertCircle className="w-10 h-10 text-[#FF5757] mb-2.5" />
              <p className="text-slate-300 text-xs mb-3">{cameraError}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 rounded-full bg-[#240A0E] hover:bg-[#330D13] text-[#FF5757] text-xs font-bold flex items-center gap-2 border border-[#660F0F] cursor-pointer"
              >
                <Upload className="w-4 h-4" /> Foto von Gerät wählen
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover"
              />

              {/* Auto-Scan status overlay */}
              {!autoDetectedBanner && (
                <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-[#100304]/85 border border-[#FF5757]/60 text-[10px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#FF5757] animate-pulse" />
                  <span>Auto-Erkennung aktiv</span>
                </div>
              )}

              {/* Viewfinder Target Area */}
              <div className="absolute inset-5 sm:inset-10 rounded-2xl border border-white/20 pointer-events-none">
                <div className="absolute -top-1 -left-1 w-7 h-7 border-t-4 border-l-4 border-[#FF5757] rounded-tl-xl" />
                <div className="absolute -top-1 -right-1 w-7 h-7 border-t-4 border-r-4 border-[#FF5757] rounded-tr-xl" />
                <div className="absolute -bottom-1 -left-1 w-7 h-7 border-b-4 border-l-4 border-[#FF5757] rounded-bl-xl" />
                <div className="absolute -bottom-1 -right-1 w-7 h-7 border-b-4 border-r-4 border-[#FF5757] rounded-br-xl" />

                <div className="absolute left-2 right-2 h-0.5 bg-[#FF5757] opacity-90 animate-matte-laser" />

                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                  <div className="w-6 h-0.5 bg-white" />
                  <div className="h-6 w-0.5 bg-white -ml-3" />
                </div>
              </div>

              <button
                onClick={handleFlipCamera}
                className="absolute top-3 right-3 p-2.5 rounded-full bg-[#1A070A]/85 hover:bg-[#1A070A] text-white border border-[#660F0F] transition-all active:scale-95 shadow-md cursor-pointer"
                title="Kamera wechseln"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Auto-recognized lock-on confirmation */}
          {autoDetectedBanner && (
            <div className="absolute inset-0 bg-[#100304]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 z-25 animate-fadeIn">
              <div className="w-14 h-14 rounded-full bg-[#FF5757]/20 border-2 border-[#FF5757] flex items-center justify-center mb-3">
                <CheckCircle2 className="w-8 h-8 text-[#FF5757]" />
              </div>
              <div className="text-white font-black text-base sm:text-lg tracking-wider uppercase text-center">
                {autoDetectedBanner}
              </div>
            </div>
          )}

          {/* Manual Scanning Overlay */}
          {isScanning && !autoDetectedBanner && (
            <div className="absolute inset-0 bg-[#120305]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 z-20">
              <div className="w-12 h-12 rounded-full border-4 border-[#660F0F] border-t-[#FF5757] animate-spin mb-3.5" />
              <div className="text-white font-black text-base sm:text-lg tracking-wider uppercase text-center max-w-xs">
                {analyzingText}
              </div>
              <div className="text-xs text-[#E0B0B0] mt-1.5 font-medium">
                Prüfe Zutaten & berechne natürliches Rezept...
              </div>
            </div>
          )}
        </div>

        {/* Action Controls & Universal Food Recognition */}
        <div className="p-4 sm:p-5 bg-[#140507] border-t border-[#660F0F] flex flex-col gap-3">
          {scanError && (
            <div className="p-3 rounded-2xl bg-[#2B060B] border border-[#FF5757]/60 text-white text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#FF5757] mt-0.5" />
              <span className="leading-snug">{scanError}</span>
            </div>
          )}

          {/* Primary Buttons: Round CTA + Upload */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleCaptureClick}
              disabled={isScanning}
              className="flex-1 py-3.5 px-5 rounded-full bg-[#FF5757] hover:bg-[#E84E50] text-[#120305] font-black text-sm sm:text-base tracking-wider uppercase flex items-center justify-center gap-2 transition-all duration-200 transform active:scale-98 disabled:opacity-50 cursor-pointer shadow-md"
            >
              <Camera className="w-5 h-5 stroke-[2.5]" />
              Packung / Essen scannen
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
              className="p-3.5 rounded-full bg-[#240A0E] hover:bg-[#330D13] text-[#FF5757] border border-[#660F0F] transition-all cursor-pointer disabled:opacity-50"
              title="Foto hochladen"
            >
              <Upload className="w-5 h-5" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
          </div>

          {/* Quick Universal Food Chips with Categories */}
          <div className="pt-2 border-t border-[#660F0F]/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] sm:text-[11px] font-bold text-[#A66D6D] uppercase flex items-center gap-1">
                <Zap className="w-3 h-3 text-[#FF5757]" /> Schnellauswahl:
              </span>
              <div className="flex items-center gap-1">
                {(['Beliebt', 'Süßes', 'Herzhaft', 'Snacks'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold transition-all cursor-pointer ${
                      activeCategory === cat
                        ? 'bg-[#FF5757] text-[#120305]'
                        : 'bg-[#1A070A] text-[#A66D6D] hover:text-white border border-[#660F0F]/60'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
              {foodCategories[activeCategory].map((food) => (
                <button
                  key={food}
                  onClick={() => processScan({ productNameHint: food })}
                  disabled={isScanning}
                  className="px-3 py-1 rounded-full bg-[#240A0E] hover:bg-[#FF5757] hover:text-[#120305] border border-[#660F0F] text-xs font-semibold text-[#FFBDBD] transition-all cursor-pointer disabled:opacity-40"
                >
                  {food}
                </button>
              ))}
            </div>

            {/* Custom search bar for ANY food or product on earth */}
            <form onSubmit={handleCustomSearch} className="mt-2.5 flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-[#FF5757] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchHint}
                  onChange={(e) => setSearchHint(e.target.value)}
                  placeholder="Beliebiges Produkt / Essen eingeben (z. B. Snickers, Döner...)"
                  className="w-full pl-9 pr-3 py-2 rounded-full bg-[#120305] border border-[#660F0F] text-white text-xs placeholder:text-[#A66D6D] focus:outline-none focus:border-[#FF5757]"
                />
              </div>
              <button
                type="submit"
                disabled={isScanning || !searchHint.trim()}
                className="px-4 py-2 rounded-full bg-[#240A0E] hover:bg-[#FF5757] text-[#FF5757] hover:text-[#120305] border border-[#660F0F] text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
              >
                Erkennen
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
