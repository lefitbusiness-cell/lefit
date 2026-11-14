import { AuthUser, ScannedProduct } from '../types';

const TOKEN_STORAGE_KEY = 'lefit_auth_token_v1';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

async function apiJson<T = any>(url: string, options: RequestInit = {}): Promise<T & { httpStatus: number }> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let data: any = {};
  try {
    data = await response.json();
  } catch {
    data = { success: false, error: 'Ungültige Serverantwort.' };
  }

  return {
    ...data,
    httpStatus: response.status,
  };
}

// --- AUTH API ---
export async function checkAccountExists(email: string): Promise<{
  exists: boolean;
  provider?: string;
  name?: string;
}> {
  return apiJson('/api/auth/check-account', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function loginAccount(payload: {
  email: string;
  password: string;
  confirmPassword?: string;
  name?: string;
  provider: 'google' | 'apple' | 'email';
  avatar?: string;
}): Promise<{
  success: boolean;
  token?: string;
  user?: AuthUser;
  isNewAccount?: boolean;
  error?: string;
  httpStatus: number;
}> {
  return apiJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchSessionMe(): Promise<{
  success: boolean;
  user?: AuthUser;
  code?: string;
  error?: string;
  httpStatus: number;
}> {
  return apiJson('/api/auth/me', { method: 'GET' });
}

// --- RECIPES API ---
export async function fetchServerRecipes(): Promise<{
  success: boolean;
  savedRecipes?: ScannedProduct[];
  httpStatus: number;
}> {
  return apiJson('/api/recipes', { method: 'GET' });
}

export async function saveServerRecipe(product: ScannedProduct): Promise<{
  success: boolean;
  savedRecipes?: ScannedProduct[];
  code?: string;
  error?: string;
  httpStatus: number;
}> {
  return apiJson('/api/recipes', {
    method: 'POST',
    body: JSON.stringify({ product }),
  });
}

export async function syncServerRecipes(localRecipes: ScannedProduct[]): Promise<{
  success: boolean;
  savedRecipes?: ScannedProduct[];
  httpStatus: number;
}> {
  return apiJson('/api/recipes/sync', {
    method: 'POST',
    body: JSON.stringify({ localRecipes }),
  });
}

export async function deleteServerRecipe(id: string): Promise<{
  success: boolean;
  savedRecipes?: ScannedProduct[];
  httpStatus: number;
}> {
  return apiJson(`/api/recipes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function resetServerRecipes(): Promise<{
  success: boolean;
  savedRecipes?: ScannedProduct[];
  httpStatus: number;
}> {
  return apiJson('/api/recipes/reset', {
    method: 'POST',
  });
}

// --- SCANNER API ---
export async function scanProductRequest(payload: {
  imageBase64?: string;
  sampleId?: string;
  productNameHint?: string;
  autoScan?: boolean;
}): Promise<{
  success: boolean;
  recognized?: boolean;
  data?: any;
  code?: string;
  error?: string;
  message?: string;
  httpStatus: number;
}> {
  return apiJson('/api/scan-product', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
