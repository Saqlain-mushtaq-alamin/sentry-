import React, { useEffect, useState } from 'react';
import { Recipe } from '../../shared/types';
import './RecipeManager.css';

export const RecipeManager: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      const data = await window.sentry?.agent?.getRecipes();
      if (data) setRecipes(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this recipe?')) {
      await window.sentry?.agent?.deleteRecipe(id);
      loadRecipes();
    }
  };

  const handleRun = async (recipe: Recipe) => {
    const vars: Record<string, string> = {};
    for (const v of recipe.variables) {
      const val = prompt(`Enter value for ${v.name}:`, v.defaultValue || '');
      if (val === null) return; // user cancelled
      vars[v.name] = val;
    }
    
    try {
      await window.sentry?.agent?.replayRecipe(recipe.id, vars);
      alert('Recipe replayed successfully!');
    } catch (e: any) {
      alert(`Replay failed: ${e.message}`);
    }
  };

  if (isLoading) return <div className="recipe-manager">Loading...</div>;

  return (
    <div className="recipe-manager">
      <div className="rm-header">
        <h1>📋 My Recipes</h1>
        <div className="rm-actions">
          <button>Import Recipe</button>
          <button>Export All</button>
        </div>
      </div>
      
      {recipes.length === 0 ? (
        <div className="rm-empty">No recipes found. Complete a task to save one!</div>
      ) : (
        <div className="rm-list">
          {recipes.map(r => (
            <div key={r.id} className="rm-card">
              <div className="rm-card-header">
                <h3>🔍 {r.name}</h3>
                <span className="rm-sites">Sites: {r.sitePatterns.join(', ')}</span>
              </div>
              <div className="rm-card-meta">
                <span>Last used: {new Date(r.lastUsedAt).toLocaleDateString()}</span>
                <span> • </span>
                <span>Used {r.useCount} times</span>
              </div>
              {r.variables.length > 0 && (
                <div className="rm-vars">
                  Variables: {r.variables.map(v => v.name).join(', ')}
                </div>
              )}
              <div className="rm-card-actions">
                <button onClick={() => handleRun(r)} className="primary-btn">▶ Run</button>
                <button>✏️ Edit</button>
                <button>📋 Duplicate</button>
                <button onClick={() => handleDelete(r.id)} className="danger-btn">🗑️ Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
