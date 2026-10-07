import fs from 'fs';
import path from 'path';
import { app, safeStorage } from 'electron';
import { Recipe } from '../../shared/types';

export class RecipeManager {
  private filePath: string;
  private recipes: Map<string, Recipe> = new Map();

  constructor(filePath?: string) {
    if (filePath) {
      this.filePath = filePath;
    } else {
      let userDataPath = '';
      try {
        userDataPath = app.getPath('userData');
      } catch {
        userDataPath = process.cwd();
      }
      this.filePath = path.join(userDataPath, 'sentry-recipes.enc');
    }
    this.loadRecipes();
  }

  private encrypt(text: string): string {
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(text).toString('base64');
    }
    return Buffer.from(text, 'utf-8').toString('base64');
  }

  private decrypt(text: string): string {
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(text, 'base64'));
    }
    return Buffer.from(text, 'base64').toString('utf-8');
  }

  private loadRecipes(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const encrypted = fs.readFileSync(this.filePath, 'utf-8');
        const raw = this.decrypt(encrypted);
        const parsed: Recipe[] = JSON.parse(raw);
        parsed.forEach(r => this.recipes.set(r.id, r));
      }
    } catch (err) {
      console.error('Failed to load recipes:', err);
    }
  }

  private saveRecipes(): void {
    try {
      const raw = JSON.stringify(Array.from(this.recipes.values()));
      const encrypted = this.encrypt(raw);
      fs.writeFileSync(this.filePath, encrypted, 'utf-8');
    } catch (err) {
      console.error('Failed to save recipes:', err);
    }
  }

  public getAllRecipes(): Recipe[] {
    return Array.from(this.recipes.values()).sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  }

  public getRecipe(id: string): Recipe | undefined {
    return this.recipes.get(id);
  }

  public saveRecipe(recipe: Recipe): void {
    this.recipes.set(recipe.id, recipe);
    this.saveRecipes();
  }

  public deleteRecipe(id: string): void {
    this.recipes.delete(id);
    this.saveRecipes();
  }

  public forgetAll(): void {
    this.recipes.clear();
    this.saveRecipes();
    // Secure deletion: Overwrite with empty encrypted array, 
    // real secure deletion would rotate keys or overwrite file bytes.
  }
}
