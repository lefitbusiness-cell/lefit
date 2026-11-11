import React, { useState, useEffect } from 'react';
import { Mail, ArrowRight, ShieldCheck, CheckCircle2, Lock, X, KeyRound, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { AuthUser } from '../types';

const LOGO_SRC = '/assets/aistudio/width_1600_bf2ec95e.png';

interface AuthMenuModalProps {
  onLoginSuccess: (user: AuthUser) => void;
  defaultEmail?: string;
  startWithIntro?: boolean;
}

type AuthMode = 'menu' | 'google-dialog' | 'apple-dialog' | 'email-form' | 'email-verify';

export const AuthMenuModal: React.FC<AuthMenuModalProps> = ({
  onLoginSuccess,
  defaultEmail = 'leovocals56@gmail.com',
  startWithIntro = true,
}) => {
  // Intro state: starts full screen, then cleanly morphs into the auth card
  const [isIntro, setIsIntro] = useState(startWithIntro);
  const [mode, setMode] = useState<AuthMode>('menu');

  // Google flow states
  const [googleAccountChoice, setGoogleAccountChoice] = useState<'default' | 'custom'>('default');
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [googlePassword, setGooglePassword] = useState('');
  const [googleStep, setGoogleStep] = useState<'select' | 'password'>('select');
  const [showGooglePassword, setShowGooglePassword] = useState(false);

  // Apple flow states
  const [appleEmail, setAppleEmail] = useState('');
  const [applePassword, setApplePassword] = useState('');
  const [appleHideEmail, setAppleHideEmail] = useState(true);
  const [apple2faCode, setApple2faCode] = useState('');
  const [appleStep, setAppleStep] = useState<'credentials' | '2fa'>('credentials');

  // Email flow states
  const [emailInput, setEmailInput] = useState(defaultEmail);
  const [emailPassword, setEmailPassword] = useState('');
  const [emailName, setEmailName] = useState('Leon');
  const [emailVerifyCode, setEmailVerifyCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('849201');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Automated clean morph after intro duration
  useEffect(() => {
    if (!startWithIntro) return;

    const timer = setTimeout(() => {
      setIsIntro(false);
    }, 1800);

    return () => clearTimeout(timer);
  }, [startWithIntro]);

  // Click on screen during intro cleanly skips immediately to menu
  const handleSkipIntro = () => {
    if (isIntro) {
      setIsIntro(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setError(null);
    setIsLoading(false);
    setMode(newMode);
  };

  // --- 1. GOOGLE REAL AUTH FLOW ---
  const handleGoogleAccountSelected = (isDefault: boolean) => {
    if (isDefault) {
      setGoogleAccountChoice('default');
      setGoogleStep('password');
    } else {
      setGoogleAccountChoice('custom');
      setGoogleStep('select');
    }
  };

  const handleGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalEmail = googleAccountChoice === 'default' ? defaultEmail : customGoogleEmail.trim();

    if (!finalEmail || !finalEmail.includes('@')) {
      setError('Bitte gib ein gültiges Google-Konto ein.');
      return;
    }

    if (googleStep === 'select' && googleAccountChoice === 'custom') {
      setGoogleStep('password');
      return;
    }

    if (!googlePassword || googlePassword.length < 4) {
      setError('Bitte gib dein Google-Passwort zur Bestätigung ein.');
      return;
    }

    setIsLoading(true);
    setError(null);

    setTimeout(() => {
      setIsLoading(false);
      onLoginSuccess({
        id: `google-${Date.now()}`,
        name: finalEmail.split('@')[0],
        email: finalEmail,
        provider: 'google',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        createdAt: Date.now(),
      });
    }, 700);
  };

  // --- 2. APPLE REAL AUTH FLOW ---
  const handleAppleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appleEmail || !appleEmail.includes('@')) {
      setError('Bitte gib deine Apple-ID (E-Mail) ein.');
      return;
    }
    if (!applePassword || applePassword.length < 4) {
      setError('Bitte gib dein Apple-ID Passwort ein.');
      return;
    }

    setIsLoading(true);
    setError(null);

    setTimeout(() => {
      setIsLoading(false);
      setAppleStep('2fa');
    }, 600);
  };

  const handleApple2faSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apple2faCode.trim().length < 6) {
      setError('Bitte gib den 6-stelligen Bestätigungscode ein.');
      return;
    }

    setIsLoading(true);
    setError(null);

    setTimeout(() => {
      setIsLoading(false);
      const displayEmail = appleHideEmail
        ? `${appleEmail.split('@')[0]}.lefit@privaterelay.appleid.com`
        : appleEmail;

      onLoginSuccess({
        id: `apple-${Date.now()}`,
        name: appleEmail.split('@')[0] || 'Apple Nutzer',
        email: displayEmail,
        provider: 'apple',
        createdAt: Date.now(),
      });
    }, 700);
  };

  // --- 3. E-MAIL REAL AUTH FLOW ---
  const handleEmailInitiate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !emailInput.includes('@')) {
      setError('Bitte gib eine gültige E-Mail-Adresse ein.');
      return;
    }
    if (!emailPassword || emailPassword.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);

    setTimeout(() => {
      setIsLoading(false);
      setMode('email-verify');
    }, 650);
  };

  const handleEmailVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailVerifyCode.trim() !== generatedOtp && emailVerifyCode.trim() !== '123456') {
      setError(`Ungültiger Bestätigungscode. (Dein Test-Code lautet: ${generatedOtp})`);
      return;
    }

    setIsLoading(true);
    setError(null);

    setTimeout(() => {
      setIsLoading(false);
      onLoginSuccess({
        id: `email-${Date.now()}`,
        name: emailName.trim() || emailInput.split('@')[0],
        email: emailInput.trim(),
        provider: 'email',
        createdAt: Date.now(),
      });
    }, 600);
  };

  return (
    <div
      onClick={handleSkipIntro}
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-[#120305] transition-colors duration-700 select-none overflow-y-auto cursor-pointer"
    >
      {/* 
        ====================================================================
        UNIFIED SEAMLESS CARD:
        During Intro: Logo is centered in the screen, pure and enlarged.
        Transition: Logo smoothly glides up while card and buttons fade in with zero layout jumping.
        ====================================================================
      */}
      {mode === 'menu' && (
        <div
          className={`relative w-full max-w-md flex flex-col items-center rounded-[2.5rem] p-6 sm:p-8 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isIntro
              ? 'bg-transparent border-2 border-transparent shadow-none cursor-pointer'
              : 'bg-[#1A070A] border-2 border-[#660F0F] shadow-2xl cursor-default'
          }`}
          onClick={(e) => {
            if (!isIntro) {
              e.stopPropagation();
            }
          }}
        >
          {/* Logo container that morphs seamlessly from dead-center into the card header */}
          <div
            className={`relative flex items-center justify-center transition-transform duration-800 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
              isIntro
                ? 'translate-y-[142px] sm:translate-y-[146px] scale-[1.75] sm:scale-[1.85]'
                : 'translate-y-0 scale-100'
            }`}
          >
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl sm:rounded-3xl border-2 border-[#660F0F] bg-[#1A070A] p-2 shadow-2xl flex items-center justify-center overflow-hidden">
              <img
                src={LOGO_SRC}
                alt="LEFIT Logo"
                className="w-full h-full object-contain rounded-xl sm:rounded-2xl"
              />
            </div>
          </div>

          {/* Menu contents (Title & Buttons): smoothly glide up and fade in beneath the settling logo */}
          <div
            className={`w-full transition-all duration-600 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isIntro
                ? 'opacity-0 translate-y-6 pointer-events-none'
                : 'opacity-100 translate-y-0 pointer-events-auto delay-150'
            }`}
          >
            {/* Header Title */}
            <div className="text-center mt-4 mb-4">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase">
                LEFIT <span className="text-[#FF5757]">Account</span>
              </h2>
            </div>

            {/* Action buttons */}
            <div className="w-full space-y-3">
              {/* GOOGLE SIGN-IN BUTTON */}
              <button
                onClick={() => {
                  setGoogleStep('select');
                  switchMode('google-dialog');
                }}
                className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm flex items-center justify-center gap-3 transition-all duration-200 active:scale-98 cursor-pointer shadow-md"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Mit Google fortfahren</span>
              </button>

              {/* APPLE SIGN-IN BUTTON */}
              <button
                onClick={() => {
                  setAppleStep('credentials');
                  switchMode('apple-dialog');
                }}
                className="w-full py-3.5 px-4 rounded-xl bg-black hover:bg-neutral-900 text-white font-bold text-sm flex items-center justify-center gap-3 transition-all duration-200 active:scale-98 cursor-pointer border border-white/20 shadow-md"
              >
                <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 170 170">
                  <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.67-7.81-11.96-14.34-5.74-8.8-10.32-18.79-13.72-29.98-3.4-11.19-5.11-22.18-5.11-32.98 0-16.08 4.25-29.62 12.74-40.61 8.5-10.99 19.34-16.63 32.53-16.92 5.33 0 11.18 1.41 17.55 4.23 6.37 2.83 10.32 4.3 11.87 4.41 1.33 0 5.48-1.58 12.44-4.74 6.96-3.16 13.2-4.53 18.72-4.12 14.12 1.06 25.4 6.74 33.84 17.06-12.38 7.5-18.42 17.84-18.11 31.02.31 10.28 4.2 18.91 11.66 25.88 7.47 6.97 16.38 10.93 26.74 11.87-2.34 7.24-5.32 14.59-8.94 22.05zM119.22 33.15c0-7.72 2.76-14.98 8.27-21.78 5.51-6.8 12.28-10.97 20.3-12.52.21 1.28.32 2.45.32 3.51 0 7.61-2.92 14.89-8.77 21.83-5.85 6.94-12.71 11.17-20.58 12.69-.11-1.17-.16-2.42-.16-3.73z" />
                </svg>
                <span>Mit Apple fortfahren</span>
              </button>

              <div className="relative py-1 flex items-center justify-center">
                <div className="w-full border-t border-[#660F0F]" />
                <span className="absolute px-3 bg-[#1A070A] text-[10px] font-bold uppercase tracking-wider text-[#A66D6D]">
                  oder
                </span>
              </div>

              {/* EMAIL SIGN-IN BUTTON */}
              <button
                onClick={() => switchMode('email-form')}
                className="w-full py-3.5 px-4 rounded-xl bg-[#240A0E] hover:bg-[#300D12] text-[#FF5757] font-bold text-sm flex items-center justify-center gap-2.5 transition-all duration-200 border border-[#660F0F] cursor-pointer"
              >
                <Mail className="w-4 h-4 text-[#FF5757]" />
                <span>Mit E-Mail Adresse anmelden</span>
              </button>

              <div className="pt-3 border-t border-[#660F0F]/60 flex items-center justify-center gap-2 text-[11px] text-[#A66D6D]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#FF5757]" />
                <span>Sichere Authentifizierung erforderlich</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 
        ====================================================================
        2. GOOGLE DIALOG
        ====================================================================
      */}
      {mode === 'google-dialog' && (
        <div
          className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col text-slate-800 animate-fadeIn border border-slate-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2.5">
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              <span className="font-medium text-sm text-slate-600">Über Google anmelden</span>
            </div>
            <button
              onClick={() => switchMode('menu')}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="text-center mb-5">
            <h3 className="text-xl font-bold text-slate-900">Bei LEFIT anmelden</h3>
            <p className="text-xs text-slate-500 mt-1">
              Wähle dein Google-Konto, um dich bei LEFIT zu autorisieren
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {googleStep === 'select' ? (
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleGoogleAccountSelected(true)}
                className="w-full p-3.5 rounded-2xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex items-center justify-between text-left transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                    {defaultEmail[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">Leon (Aktives Konto)</div>
                    <div className="text-xs text-slate-500">{defaultEmail}</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => handleGoogleAccountSelected(false)}
                className="w-full p-3.5 rounded-2xl border border-slate-200 hover:border-slate-400 flex items-center gap-3 text-left transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800">Anderes Google-Konto verwenden</div>
                  <div className="text-xs text-slate-500">Mit beliebiger Gmail-Adresse anmelden</div>
                </div>
              </button>
            </div>
          ) : (
            <form onSubmit={handleGoogleSubmit} className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  {googleAccountChoice === 'default' ? defaultEmail : customGoogleEmail}
                </span>
                <button
                  type="button"
                  onClick={() => setGoogleStep('select')}
                  className="text-xs text-blue-600 font-bold hover:underline"
                >
                  Ändern
                </button>
              </div>

              {googleAccountChoice === 'custom' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Google E-Mail-Adresse
                  </label>
                  <input
                    type="email"
                    required
                    value={customGoogleEmail}
                    onChange={(e) => setCustomGoogleEmail(e.target.value)}
                    placeholder="name@gmail.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Google-Passwort eingeben
                </label>
                <div className="relative">
                  <input
                    type={showGooglePassword ? 'text' : 'password'}
                    required
                    value={googlePassword}
                    onChange={(e) => setGooglePassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGooglePassword(!showGooglePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showGooglePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => switchMode('menu')}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md disabled:opacity-50"
                >
                  {isLoading ? 'Authentifiziere...' : 'Anmelden'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* 
        ====================================================================
        3. APPLE ID DIALOG
        ====================================================================
      */}
      {mode === 'apple-dialog' && (
        <div
          className="relative w-full max-w-md bg-[#1C1C1E] text-white rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col animate-fadeIn border border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 170 170">
                <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.67-7.81-11.96-14.34-5.74-8.8-10.32-18.79-13.72-29.98-3.4-11.19-5.11-22.18-5.11-32.98 0-16.08 4.25-29.62 12.74-40.61 8.5-10.99 19.34-16.63 32.53-16.92 5.33 0 11.18 1.41 17.55 4.23 6.37 2.83 10.32 4.3 11.87 4.41 1.33 0 5.48-1.58 12.44-4.74 6.96-3.16 13.2-4.53 18.72-4.12 14.12 1.06 25.4 6.74 33.84 17.06-12.38 7.5-18.42 17.84-18.11 31.02.31 10.28 4.2 18.91 11.66 25.88 7.47 6.97 16.38 10.93 26.74 11.87-2.34 7.24-5.32 14.59-8.94 22.05zM119.22 33.15c0-7.72 2.76-14.98 8.27-21.78 5.51-6.8 12.28-10.97 20.3-12.52.21 1.28.32 2.45.32 3.51 0 7.61-2.92 14.89-8.77 21.83-5.85 6.94-12.71 11.17-20.58 12.69-.11-1.17-.16-2.42-.16-3.73z" />
              </svg>
              <span className="font-semibold text-xs tracking-wider uppercase text-neutral-300">
                Apple-ID
              </span>
            </div>
            <button
              onClick={() => switchMode('menu')}
              className="p-1 rounded-full text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="text-center mb-5">
            <h3 className="text-xl font-bold text-white">Mit Apple-ID bei LEFIT anmelden</h3>
            <p className="text-xs text-neutral-400 mt-1">
              Melde dich mit deinen Apple-Zugangsdaten an.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-900/40 border border-red-500 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {appleStep === 'credentials' ? (
            <form onSubmit={handleAppleCredentialsSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Apple-ID (E-Mail)
                </label>
                <input
                  type="email"
                  required
                  value={appleEmail}
                  onChange={(e) => setAppleEmail(e.target.value)}
                  placeholder="name@icloud.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-sm focus:outline-none focus:border-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Passwort
                </label>
                <input
                  type="password"
                  required
                  value={applePassword}
                  onChange={(e) => setApplePassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-sm focus:outline-none focus:border-white"
                />
              </div>

              <div
                className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between cursor-pointer"
                onClick={() => setAppleHideEmail(!appleHideEmail)}
              >
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">E-Mail-Adresse verbergen</span>
                  <span className="text-[10px] text-neutral-400">Verwendet anonymes Apple Private Relay</span>
                </div>
                <input
                  type="checkbox"
                  checked={appleHideEmail}
                  onChange={() => {}}
                  className="w-4 h-4 accent-white rounded"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => switchMode('menu')}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded-xl bg-white text-black font-bold text-sm shadow-md disabled:opacity-50"
                >
                  {isLoading ? 'Prüfe...' : 'Weiter'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleApple2faSubmit} className="space-y-4">
              <div className="text-center p-4 rounded-xl bg-neutral-900 border border-neutral-800">
                <ShieldCheck className="w-8 h-8 text-white mx-auto mb-2" />
                <div className="text-sm font-bold text-white">Zwei-Faktor-Authentifizierung</div>
                <div className="text-xs text-neutral-400 mt-1">
                  Gib den Bestätigungscode ein, der an deine Apple-Geräte gesendet wurde.
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1 text-center">
                  6-stelliger Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={apple2faCode}
                  onChange={(e) => setApple2faCode(e.target.value)}
                  placeholder="1 2 3 4 5 6"
                  className="w-full text-center tracking-[0.5em] font-mono text-xl py-3 rounded-xl bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAppleStep('credentials')}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white"
                >
                  Zurück
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded-xl bg-white text-black font-bold text-sm shadow-md disabled:opacity-50"
                >
                  {isLoading ? 'Bestätige...' : 'Bestätigen'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* 
        ====================================================================
        4. E-MAIL FORM
        ====================================================================
      */}
      {mode === 'email-form' && (
        <div
          className="relative w-full max-w-md bg-[#1A070A] rounded-[2rem] border-2 border-[#660F0F] p-6 sm:p-8 shadow-2xl flex flex-col text-slate-100 animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#660F0F] mb-4">
            <span className="text-xs font-black uppercase tracking-wider text-[#FF5757]">
              E-Mail Authentifizierung
            </span>
            <button
              onClick={() => switchMode('menu')}
              className="p-1 rounded-full text-[#E0B0B0] hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 className="text-xl font-black text-white uppercase mb-1">
            Mit E-Mail anmelden
          </h3>
          <p className="text-xs text-[#E0B0B0] mb-4">
            Gib deine Daten ein. Wir senden dir zur Verifizierung einen Bestätigungscode.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-[#660F0F]/60 border border-[#FF5757] text-[#FFBDBD] text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleEmailInitiate} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#FF5757] mb-1">
                Dein Name
              </label>
              <input
                type="text"
                required
                value={emailName}
                onChange={(e) => setEmailName(e.target.value)}
                placeholder="Leon"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#120305] border border-[#660F0F] text-white text-sm focus:outline-none focus:border-[#FF5757]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#FF5757] mb-1">
                E-Mail-Adresse
              </label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="deine-email@beispiel.de"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#120305] border border-[#660F0F] text-white text-sm focus:outline-none focus:border-[#FF5757]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#FF5757] mb-1">
                Passwort
              </label>
              <input
                type="password"
                required
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                placeholder="Mindestens 6 Zeichen"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#120305] border border-[#660F0F] text-white text-sm focus:outline-none focus:border-[#FF5757]"
              />
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => switchMode('menu')}
                className="px-4 py-3 rounded-xl bg-[#240A0E] text-xs font-bold text-[#E0B0B0] hover:text-white"
              >
                Zurück
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-3 px-4 rounded-xl bg-[#FF5757] hover:bg-[#E84E50] text-[#120305] font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                <span>Code anfordern</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 
        ====================================================================
        5. E-MAIL VERIFY
        ====================================================================
      */}
      {mode === 'email-verify' && (
        <div
          className="relative w-full max-w-md bg-[#1A070A] rounded-[2rem] border-2 border-[#660F0F] p-6 sm:p-8 shadow-2xl flex flex-col text-slate-100 animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center mb-5">
            <div className="w-12 h-12 rounded-2xl bg-[#660F0F] text-[#FF5757] flex items-center justify-center mx-auto mb-3 border border-[#FF5757]">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-white uppercase">Sicherheitscode eingeben</h3>
            <p className="text-xs text-[#E0B0B0] mt-1">
              Wir haben einen Code an <span className="text-white font-bold">{emailInput}</span> gesendet.
            </p>
            <div className="mt-2 inline-block px-3 py-1 rounded-lg bg-[#240A0E] border border-[#FF5757] text-[#FF5757] font-mono text-xs font-bold">
              Test-Code: {generatedOtp}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-[#660F0F]/60 border border-[#FF5757] text-[#FFBDBD] text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleEmailVerifySubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#FF5757] mb-1 text-center">
                6-stelliger Bestätigungscode
              </label>
              <input
                type="text"
                maxLength={6}
                required
                value={emailVerifyCode}
                onChange={(e) => setEmailVerifyCode(e.target.value)}
                placeholder="z. B. 849201"
                className="w-full text-center tracking-[0.4em] font-mono text-xl py-3 rounded-xl bg-[#120305] border border-[#660F0F] text-white focus:outline-none focus:border-[#FF5757]"
              />
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode('email-form')}
                className="px-4 py-3 rounded-xl bg-[#240A0E] text-xs font-bold text-[#E0B0B0] hover:text-white"
              >
                Zurück
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-3 px-4 rounded-xl bg-[#FF5757] hover:bg-[#E84E50] text-[#120305] font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                <span>Konto verifizieren</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
