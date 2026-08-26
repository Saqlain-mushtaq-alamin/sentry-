import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import * as crypto from 'crypto';
import { Recipe } from '../../shared/types';

const ENCRYPTION_KEY = crypto.scryptSync('sentry-recipe-secret-key-1234!', 'salt', 32); // In production, use secure key vault
const ALGORITHM = 'aes-256-gcm';

export class RecipeManager {
  private filePath: string;
  private recipes: Map<string, Recipe> = new Map();

  constructor() {
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, 'sentry-recipes.enc');
    this.loadRecipes();
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  private decrypt(text: string): string {
    const parts = text.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted recipe format');
    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex as string, 'hex');
    const authTag = Buffer.from(authTagHex as string, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted as string, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
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
