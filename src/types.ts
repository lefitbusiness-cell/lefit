export interface AuthUser {
  id: string;
  name: string;
  email: string;
  provider: 'google' | 'apple' | 'email';
  avatar?: string;
  createdAt: number;
  isAdmin?: boolean;
  role?: 'admin' | 'user';
}

export interface RecipeMacros {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber?: string;
}

export interface CleanRecipe {
  title: string;
  subtitle: string;
  prepTime: string;
  difficulty: string;
  servings: string;
  macros: RecipeMacros;
  originalCalories?: string;
  cleanCalories?: string;
  calorieSavings?: string;
  comparison: string;
  ingredients: string[];
  instructions: string[];
  leonsVerdict: string;
}

export interface ScannedProduct {
  id: string;
  timestamp: number;
  productName: string;
  brand: string;
  category: string;
  originalCalories?: string;
  cleanCalories?: string;
  calorieSavings?: string;
  healthCheck: string;
  portionTip: string;
  shortSummary?: string;
  cleanRecipe: CleanRecipe;
  thumbnail?: string;
}
