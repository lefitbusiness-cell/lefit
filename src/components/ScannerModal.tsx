import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, X, Upload, Zap, AlertCircle, Search, Sparkles } from 'lucide-react';
import { ScannedProduct } from '../types';
import { LefitLogo } from './LefitLogo';

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

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isScanning, setIsScanning] = useState(false);
  const [analyzingText, setAnalyzingText] = useState('LEFIT KI erkennt Packung & Essen...');
  const [searchHint, setSearchHint] = useState('');

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }
    setScanError(null);
    startCamera();
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

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
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.9);
  };

  const processScan = async (payload: { imageBase64?: string; sampleId?: string; productNameHint?: string }) => {
    setIsScanning(true);
    setScanError(null);
    setAnalyzingText(
      payload.productNameHint
        ? `Erkenne "${payload.productNameHint}"...`
        : 'LEFIT KI analysiert Packung & Essen...'
    );

    try {
      const response = await fetch('/api/scan-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (result.success && result.data) {
        const item: ScannedProduct = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          timestamp: Date.now(),
          productName: result.data.productName,
          brand: result.data.brand,
          category: result.data.category,
          healthCheck: result.data.healthCheck,
          portionTip: result.data.portionTip,
          shortSummary: result.data.shortSummary,
          cleanRecipe: result.data.cleanRecipe,
          thumbnail: payload.imageBase64,
        };
        stopCamera();
        onProductDetected(item);
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

  const handleCaptureClick = () => {
    const frame = captureFrame();
    if (frame) {
      processScan({ imageBase64: frame });
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
  };

  const handleCustomSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchHint.trim()) return;
    processScan({ productNameHint: searchHint.trim() });
  };

  const quickFoods = [
    'Pizza Margherita',
    'Pringles',
    'Cheeseburger',
    'Kinder Bueno',
    'Oreo',
    'Döner Kebab',
    'Doritos',
    'Haribo',
    'Coca-Cola',
    'Spaghetti',
    'Sushi',
    'Apfel',
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#120305]/95 backdrop-blur-md animate-fadeIn select-none">
      <canvas ref={canvasRef} className="hidden" />

      <div className="relative w-full max-w-lg bg-[#1A070A] rounded-[2rem] sm:rounded-[2.5rem] border-2 border-[#660F0F] shadow-2xl overflow-hidden flex flex-col max-h-[96vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#660F0F] bg-[#140507]">
          <div className="flex items-center gap-2.5">
            <LefitLogo variant="icon" size="sm" />
            <span className="font-black text-white text-sm sm:text-base tracking-wider uppercase">
              LEFIT <span className="text-[#FF5757]">Universal Scanner</span>
            </span>
          </div>

          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-full text-[#E0B0B0] hover:text-white hover:bg-white/10 transition-colors"
            title="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Window (Clean, Matte, Non-glowing) */}
        <div className="relative flex-1 min-h-[260px] sm:min-h-[360px] bg-black flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center max-w-sm flex flex-col items-center">
              <AlertCircle className="w-10 h-10 text-[#FF5757] mb-2.5" />
              <p className="text-slate-300 text-xs mb-3">{cameraError}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-[#240A0E] hover:bg-[#330D13] text-[#FF5757] text-xs font-bold flex items-center gap-2 border border-[#660F0F]"
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

              {/* Viewfinder Target Area */}
              <div className="absolute inset-5 sm:inset-10 rounded-2xl border border-white/20 pointer-events-none">
                {/* Matte Corner Brackets in exact #FF5757 coral */}
                <div className="absolute -top-1 -left-1 w-7 h-7 border-t-4 border-l-4 border-[#FF5757] rounded-tl-xl" />
                <div className="absolute -top-1 -right-1 w-7 h-7 border-t-4 border-r-4 border-[#FF5757] rounded-tr-xl" />
                <div className="absolute -bottom-1 -left-1 w-7 h-7 border-b-4 border-l-4 border-[#FF5757] rounded-bl-xl" />
                <div className="absolute -bottom-1 -right-1 w-7 h-7 border-b-4 border-r-4 border-[#FF5757] rounded-br-xl" />

                {/* Matte Laser Scanning Guide */}
                <div className="absolute left-2 right-2 h-0.5 bg-[#FF5757] opacity-90 animate-matte-laser" />

                {/* Center Target Marker */}
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                  <div className="w-6 h-0.5 bg-white" />
                  <div className="h-6 w-0.5 bg-white -ml-3" />
                </div>
              </div>

              {/* Camera flip button */}
              <button
                onClick={handleFlipCamera}
                className="absolute top-3 right-3 p-2.5 rounded-full bg-[#1A070A]/85 hover:bg-[#1A070A] text-white border border-[#660F0F] transition-all active:scale-95 shadow-md"
                title="Kamera wechseln"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Scanning Overlay */}
          {isScanning && (
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
            <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#FF5757]" />
              <span>{scanError}</span>
            </div>
          )}

          {/* Primary Buttons: Snap / Upload */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleCaptureClick}
              disabled={isScanning}
              className="flex-1 py-3.5 px-4 rounded-xl bg-[#FF5757] hover:bg-[#E84E50] text-[#120305] font-black text-sm sm:text-base tracking-wider uppercase flex items-center justify-center gap-2 transition-all duration-200 transform active:scale-98 disabled:opacity-50 cursor-pointer shadow-md"
            >
              <Camera className="w-5 h-5 stroke-[2.5]" />
              Packung / Essen scannen
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
              className="p-3.5 rounded-xl bg-[#240A0E] hover:bg-[#330D13] text-[#FF5757] border border-[#660F0F] transition-all cursor-pointer"
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

          {/* Quick Universal Food Chips */}
          <div className="pt-2 border-t border-[#660F0F]/60">
            <div className="text-[10px] sm:text-[11px] font-bold text-[#A66D6D] uppercase flex items-center gap-1 mb-2">
              <Zap className="w-3 h-3 text-[#FF5757]" /> Beliebige Produkte & Speisen der Welt:
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
              {quickFoods.map((food) => (
                <button
                  key={food}
                  onClick={() => processScan({ productNameHint: food })}
                  disabled={isScanning}
                  className="px-2.5 py-1 rounded-lg bg-[#240A0E] hover:bg-[#FF5757] hover:text-[#120305] border border-[#660F0F] text-xs font-semibold text-[#FFBDBD] transition-all cursor-pointer"
                >
                  {food}
                </button>
              ))}
            </div>

            {/* Custom search bar for ANY food on earth */}
            <form onSubmit={handleCustomSearch} className="mt-2.5 flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-[#FF5757] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchHint}
                  onChange={(e) => setSearchHint(e.target.value)}
                  placeholder="Beliebiges Produkt / Essen eingeben (z. B. Pizza, Pringles, Döner, Cola...)"
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-[#120305] border border-[#660F0F] text-white text-xs placeholder:text-[#A66D6D] focus:outline-none focus:border-[#FF5757]"
                />
              </div>
              <button
                type="submit"
                disabled={isScanning || !searchHint.trim()}
                className="px-3.5 py-2 rounded-lg bg-[#240A0E] hover:bg-[#FF5757] text-[#FF5757] hover:text-[#120305] border border-[#660F0F] text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
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
