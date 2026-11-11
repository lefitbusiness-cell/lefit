export interface AuthUser {
  id: string;
  name: string;
  email: string;
  provider: 'google' | 'apple' | 'email';
  avatar?: string;
  createdAt: number;
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
  healthCheck: string;
  portionTip: string;
  shortSummary?: string;
  cleanRecipe: CleanRecipe;
  thumbnail?: string;
}
