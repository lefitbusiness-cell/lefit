import React, { useState, useEffect } from 'react';
import {
  Mail,
  ArrowRight,
  ShieldCheck,
  X,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';
import { AuthUser } from '../types';
import {
  checkAccountExists,
  loginAccount,
  setAuthToken,
} from '../services/lefitApi';

const LOGO_SRC = '/assets/aistudio/width_1600_bf2ec95e.png';

// Official Apple Brand Logo Vector
const AppleIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5 fill-current shrink-0' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
  </svg>
);

interface AuthMenuModalProps {
  onLoginSuccess: (result: { user: AuthUser; token: string }) => void;
  defaultEmail?: string;
  startWithIntro?: boolean;
}

type AuthMode = 'menu' | 'google-dialog' | 'apple-dialog' | 'email-form';

export const AuthMenuModal: React.FC<AuthMenuModalProps> = ({
  onLoginSuccess,
  defaultEmail = 'leovocals56@gmail.com',
  startWithIntro = true,
}) => {
  const [isIntro, setIsIntro] = useState(startWithIntro);
  const [mode, setMode] = useState<AuthMode>('menu');

  // Shared server account lookup state
  const [accountCheckStatus, setAccountCheckStatus] = useState<{
    checkedEmail: string;
    exists: boolean;
  } | null>(null);

  // Google flow states
  const [googleAccountChoice, setGoogleAccountChoice] = useState<'default' | 'custom'>('default');
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [googlePassword, setGooglePassword] = useState('');
  const [googleConfirmPassword, setGoogleConfirmPassword] = useState('');
  const [googleStep, setGoogleStep] = useState<'select' | 'password'>('select');
  const [showGooglePassword, setShowGooglePassword] = useState(false);

  // Apple flow states
  const [appleEmail, setAppleEmail] = useState('');
  const [applePassword, setApplePassword] = useState('');
  const [appleConfirmPassword, setAppleConfirmPassword] = useState('');
  const [appleHideEmail, setAppleHideEmail] = useState(true);
  const [showApplePassword, setShowApplePassword] = useState(false);

  // Email flow states
  const [emailInput, setEmailInput] = useState(defaultEmail);
  const [emailPassword, setEmailPassword] = useState('');
  const [emailConfirmPassword, setEmailConfirmPassword] = useState('');
  const [emailName, setEmailName] = useState('Leon');
  const [showEmailPassword, setShowEmailPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!startWithIntro) return;
    const timer = setTimeout(() => {
      setIsIntro(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, [startWithIntro]);

  // Check if active typed email exists on server so UI accurately asks for existing password OR confirmation for new account
  const activeEmailToCheck =
    mode === 'google-dialog'
      ? googleAccountChoice === 'default'
        ? defaultEmail
        : customGoogleEmail.trim()
      : mode === 'apple-dialog'
      ? appleHideEmail && appleEmail.includes('@')
        ? `${appleEmail.split('@')[0].trim()}.lefit@privaterelay.appleid.com`
        : appleEmail.trim()
      : mode === 'email-form'
      ? emailInput.trim()
      : '';

  useEffect(() => {
    if (!activeEmailToCheck || !activeEmailToCheck.includes('@')) {
      setAccountCheckStatus(null);
      return;
    }
    const normalized = activeEmailToCheck.toLowerCase();
    const timer = setTimeout(async () => {
      try {
        const res = await checkAccountExists(normalized);
        setAccountCheckStatus({ checkedEmail: normalized, exists: Boolean(res.exists) });
      } catch {
        setAccountCheckStatus(null);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [activeEmailToCheck, mode]);

  const isExistingCheckedAccount =
    accountCheckStatus !== null &&
    accountCheckStatus.checkedEmail === activeEmailToCheck.toLowerCase() &&
    accountCheckStatus.exists;

  const isConfirmedNewAccount =
    accountCheckStatus !== null &&
    accountCheckStatus.checkedEmail === activeEmailToCheck.toLowerCase() &&
    !accountCheckStatus.exists;

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

  // --- 1. GOOGLE REAL PASSWORD FLOW ---
  const handleGoogleAccountSelected = (isDefault: boolean) => {
    setError(null);
    setGooglePassword('');
    setGoogleConfirmPassword('');
    setGoogleAccountChoice(isDefault ? 'default' : 'custom');
    setGoogleStep('password');
  };

  const handleGooglePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalEmail = googleAccountChoice === 'default' ? defaultEmail : customGoogleEmail.trim();

    if (!finalEmail || !finalEmail.includes('@')) {
      setError('Bitte gib ein gültiges Google-Konto ein.');
      return;
    }
    if (!googlePassword || googlePassword.length < 4) {
      setError('Bitte gib das Passwort (mindestens 4 Zeichen) ein.');
      return;
    }
    if (isConfirmedNewAccount && googleConfirmPassword !== googlePassword) {
      setError('Die beiden Passwörter stimmen nicht überein.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await loginAccount({
        email: finalEmail,
        password: googlePassword,
        confirmPassword: isConfirmedNewAccount ? googleConfirmPassword : undefined,
        name: finalEmail.split('@')[0],
        provider: 'google',
      });

      if (!res.success || !res.token || !res.user) {
        setError(res.error || 'Anmeldung fehlgeschlagen. Bitte überprüfe dein Passwort.');
        return;
      }

      setAuthToken(res.token);
      onLoginSuccess({ user: res.user, token: res.token });
    } catch {
      setError('Server nicht erreichbar. Bitte versuche es erneut.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- 2. APPLE REAL PASSWORD FLOW ---
  const handleAppleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appleEmail || !appleEmail.includes('@')) {
      setError('Bitte gib deine Apple-ID (E-Mail) ein.');
      return;
    }
    if (!applePassword || applePassword.length < 4) {
      setError('Bitte gib dein Apple-ID Passwort (mind. 4 Zeichen) ein.');
      return;
    }
    if (isConfirmedNewAccount && appleConfirmPassword !== applePassword) {
      setError('Die beiden Passwörter stimmen nicht überein.');
      return;
    }

    const accountEmail = appleHideEmail
      ? `${appleEmail.split('@')[0].trim()}.lefit@privaterelay.appleid.com`
      : appleEmail.trim();

    setIsLoading(true);
    setError(null);
    try {
      const res = await loginAccount({
        email: accountEmail,
        password: applePassword,
        confirmPassword: isConfirmedNewAccount ? appleConfirmPassword : undefined,
        name: appleEmail.split('@')[0] || 'Apple Nutzer',
        provider: 'apple',
      });

      if (!res.success || !res.token || !res.user) {
        setError(res.error || 'Falsches Apple-ID Passwort!');
        return;
      }

      setAuthToken(res.token);
      onLoginSuccess({ user: res.user, token: res.token });
    } catch {
      setError('Server nicht erreichbar.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- 3. E-MAIL REAL PASSWORD FLOW ---
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !emailInput.includes('@')) {
      setError('Bitte gib eine gültige E-Mail-Adresse ein.');
      return;
    }
    if (!emailPassword || emailPassword.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    if (isConfirmedNewAccount && emailConfirmPassword !== emailPassword) {
      setError('Die beiden Passwörter stimmen nicht überein.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await loginAccount({
        email: emailInput.trim(),
        password: emailPassword,
        confirmPassword: isConfirmedNewAccount ? emailConfirmPassword : undefined,
        name: emailName.trim() || emailInput.split('@')[0],
        provider: 'email',
      });

      if (!res.success || !res.token || !res.user) {
        setError(res.error || 'Falsches Passwort für dieses Konto.');
        return;
      }

      setAuthToken(res.token);
      onLoginSuccess({ user: res.user, token: res.token });
    } catch {
      setError('Server nicht erreichbar.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      onClick={handleSkipIntro}
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-[#120305] transition-colors duration-700 select-none overflow-y-auto cursor-pointer"
    >
      {/* 1. UNIFIED SEAMLESS CARD & INTRO */}
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

          <div
            className={`w-full transition-all duration-600 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isIntro
                ? 'opacity-0 translate-y-6 pointer-events-none'
                : 'opacity-100 translate-y-0 pointer-events-auto delay-150'
            }`}
          >
            <div className="text-center mt-4 mb-4">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase">
                LEFIT <span className="text-[#FF5757]">Account</span>
              </h2>
            </div>

            <div className="w-full space-y-3">
              <button
                onClick={() => {
                  setGoogleStep('select');
                  switchMode('google-dialog');
                }}
                className="w-full py-3.5 px-4 rounded-full bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm flex items-center justify-center gap-3 transition-all duration-200 active:scale-98 cursor-pointer shadow-md"
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

              <button
                onClick={() => switchMode('apple-dialog')}
                className="w-full py-3.5 px-4 rounded-full bg-black hover:bg-neutral-900 text-white font-bold text-sm flex items-center justify-center gap-3 transition-all duration-200 active:scale-98 cursor-pointer border border-white/20 shadow-md"
              >
                <AppleIcon className="w-5 h-5 fill-current shrink-0" />
                <span>Mit Apple fortfahren</span>
              </button>

              <div className="relative py-1 flex items-center justify-center">
                <div className="w-full border-t border-[#660F0F]" />
                <span className="absolute px-3 bg-[#1A070A] text-[10px] font-bold uppercase tracking-wider text-[#A66D6D]">
                  oder
                </span>
              </div>

              <button
                onClick={() => switchMode('email-form')}
                className="w-full py-3.5 px-4 rounded-full bg-[#240A0E] hover:bg-[#300D12] text-[#FF5757] font-bold text-sm flex items-center justify-center gap-2.5 transition-all duration-200 border border-[#660F0F] cursor-pointer"
              >
                <Mail className="w-4 h-4 text-[#FF5757]" />
                <span>Mit E-Mail Adresse anmelden</span>
              </button>

              <div className="pt-3 border-t border-[#660F0F]/60 flex items-center justify-center gap-2 text-[11px] text-[#A66D6D]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#FF5757]" />
                <span>Kontoschutz durch Passwort aktiv</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. GOOGLE DIALOG */}
      {mode === 'google-dialog' && (
        <div
          className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col text-slate-800 animate-fadeIn border border-slate-200 cursor-default"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2.5">
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
              </svg>
              <span className="font-medium text-sm text-slate-600">Über Google anmelden</span>
            </div>
            <button
              onClick={() => switchMode('menu')}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="text-center mb-5">
            <h3 className="text-xl font-bold text-slate-900">Bei LEFIT anmelden</h3>
            <p className="text-xs text-slate-500 mt-1">
              Wähle dein Google-Konto und gib genau das Passwort ein, mit dem das Google-Konto erstellt wurde
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {googleStep === 'select' && (
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleGoogleAccountSelected(true)}
                className="w-full p-3.5 rounded-2xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex items-center justify-between text-left transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                    {defaultEmail[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">Leon (Konto)</div>
                    <div className="text-xs text-slate-500">{defaultEmail}</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => handleGoogleAccountSelected(false)}
                className="w-full p-3.5 rounded-2xl border border-slate-200 hover:border-slate-400 flex items-center gap-3 text-left transition-all cursor-pointer"
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
          )}

          {googleStep === 'password' && (
            <form onSubmit={handleGooglePasswordSubmit} className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  {googleAccountChoice === 'default' ? defaultEmail : customGoogleEmail || 'Neues Konto'}
                </span>
                <button
                  type="button"
                  onClick={() => setGoogleStep('select')}
                  className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
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

              {isExistingCheckedAccount && (
                <div className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  Bestehendes Google-Konto erkannt – gib genau das Passwort ein, mit dem dieses Konto erstellt wurde.
                </div>
              )}
              {isConfirmedNewAccount && (
                <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  Konto wird erstellt – gib genau das Passwort ein, mit dem dieses Google-Konto erstellt wurde. Ab sofort ist ausschließlich dieses Passwort gültig.
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Konto-Passwort eingeben
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showGooglePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isConfirmedNewAccount && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Passwort bestätigen
                  </label>
                  <input
                    type={showGooglePassword ? 'text' : 'password'}
                    required
                    value={googleConfirmPassword}
                    onChange={(e) => setGoogleConfirmPassword(e.target.value)}
                    placeholder="Passwort wiederholen"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => switchMode('menu')}
                  className="px-4 py-2.5 rounded-full text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? 'Prüfe Passwort...' : isConfirmedNewAccount ? 'Konto erstellen' : 'Anmelden'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* 3. APPLE ID DIALOG */}
      {mode === 'apple-dialog' && (
        <div
          className="relative w-full max-w-md bg-[#1C1C1E] text-white rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col animate-fadeIn border border-white/10 cursor-default"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
            <div className="flex items-center gap-2.5">
              <AppleIcon className="w-5 h-5 fill-current text-white" />
              <span className="font-semibold text-xs tracking-wider uppercase text-neutral-300">
                Apple-ID
              </span>
            </div>
            <button
              onClick={() => switchMode('menu')}
              className="p-1 rounded-full text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="text-center mb-5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 text-white flex items-center justify-center mx-auto mb-3 border border-white/20 shadow-inner">
              <AppleIcon className="w-6 h-6 fill-current" />
            </div>
            <h3 className="text-xl font-bold text-white">Mit Apple-ID bei LEFIT anmelden</h3>
            <p className="text-xs text-neutral-400 mt-1">
              Gib deine Apple-ID und dein genaues Passwort ein.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-900/40 border border-red-500 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

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

            {isExistingCheckedAccount && (
              <div className="text-[11px] font-semibold text-sky-300 bg-sky-950/50 border border-sky-700/60 rounded-lg px-3 py-2">
                Bestehende Apple-ID gefunden – gib dein exaktes Passwort ein.
              </div>
            )}
            {isConfirmedNewAccount && (
              <div className="text-[11px] font-semibold text-emerald-300 bg-emerald-950/50 border border-emerald-700/60 rounded-lg px-3 py-2">
                Neue Anmeldung – Passwort wird dauerhaft für diesen Account gespeichert.
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Passwort
              </label>
              <div className="relative">
                <input
                  type={showApplePassword ? 'text' : 'password'}
                  required
                  value={applePassword}
                  onChange={(e) => setApplePassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-sm focus:outline-none focus:border-white"
                />
                <button
                  type="button"
                  onClick={() => setShowApplePassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white cursor-pointer"
                >
                  {showApplePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {isConfirmedNewAccount && (
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Passwort bestätigen
                </label>
                <input
                  type={showApplePassword ? 'text' : 'password'}
                  required
                  value={appleConfirmPassword}
                  onChange={(e) => setAppleConfirmPassword(e.target.value)}
                  placeholder="Passwort wiederholen"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-sm focus:outline-none focus:border-white"
                />
              </div>
            )}

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
                className="px-4 py-2.5 rounded-full text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2.5 rounded-full bg-white text-black font-bold text-sm shadow-md disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? 'Prüfe Passwort...' : isConfirmedNewAccount ? 'Konto erstellen' : 'Anmelden'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. E-MAIL FORM */}
      {mode === 'email-form' && (
        <div
          className="relative w-full max-w-md bg-[#1A070A] rounded-[2rem] border-2 border-[#660F0F] p-6 sm:p-8 shadow-2xl flex flex-col text-slate-100 animate-fadeIn cursor-default"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#660F0F] mb-4">
            <span className="text-xs font-black uppercase tracking-wider text-[#FF5757]">
              E-Mail Authentifizierung
            </span>
            <button
              onClick={() => switchMode('menu')}
              className="p-1 rounded-full text-[#E0B0B0] hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 className="text-xl font-black text-white uppercase mb-1">
            Mit E-Mail anmelden
          </h3>
          <p className="text-xs text-[#E0B0B0] mb-4">
            Jedes Konto erfordert das exakte Konto-Passwort.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-[#660F0F]/60 border border-[#FF5757] text-[#FFBDBD] text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#FF5757]" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleEmailSubmit} className="space-y-3.5">
            {!isExistingCheckedAccount && (
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
            )}

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

            {isExistingCheckedAccount && (
              <div className="text-[11px] font-semibold text-[#FFBDBD] bg-[#240A0E] border border-[#FF5757]/50 rounded-xl px-3 py-2">
                Bestehender Account erkannt – bitte gib dein genaues Account-Passwort ein.
              </div>
            )}
            {isConfirmedNewAccount && (
              <div className="text-[11px] font-semibold text-emerald-300 bg-emerald-950/40 border border-emerald-700/50 rounded-xl px-3 py-2">
                Neuer Account – dieses Passwort wird ab sofort fest für dein Konto gespeichert.
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#FF5757] mb-1">
                Passwort
              </label>
              <div className="relative">
                <input
                  type={showEmailPassword ? 'text' : 'password'}
                  required
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  placeholder="Mindestens 6 Zeichen"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-[#120305] border border-[#660F0F] text-white text-sm focus:outline-none focus:border-[#FF5757]"
                />
                <button
                  type="button"
                  onClick={() => setShowEmailPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A66D6D] hover:text-white cursor-pointer"
                >
                  {showEmailPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {isConfirmedNewAccount && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#FF5757] mb-1">
                  Passwort bestätigen
                </label>
                <input
                  type={showEmailPassword ? 'text' : 'password'}
                  required
                  value={emailConfirmPassword}
                  onChange={(e) => setEmailConfirmPassword(e.target.value)}
                  placeholder="Passwort wiederholen"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#120305] border border-[#660F0F] text-white text-sm focus:outline-none focus:border-[#FF5757]"
                />
              </div>
            )}

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => switchMode('menu')}
                className="px-4 py-3 rounded-full bg-[#240A0E] text-xs font-bold text-[#E0B0B0] hover:text-white cursor-pointer"
              >
                Zurück
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-3 px-4 rounded-full bg-[#FF5757] hover:bg-[#E84E50] text-[#120305] font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                <span>
                  {isLoading
                    ? 'Prüfe Passwort...'
                    : isConfirmedNewAccount
                    ? 'Konto erstellen'
                    : 'Anmelden'}
                </span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
