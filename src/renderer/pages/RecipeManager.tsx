import React, { useEffect, useState } from 'react';
import { Play, Trash2, Globe, Clock, Check, AlertCircle } from 'lucide-react';
import { Recipe } from '../../shared/types';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';

export const RecipeManager: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ message: string; type: 'ok' | 'error' } | null>(null);

  // Run modal state
  const [runningRecipe, setRunningRecipe] = useState<Recipe | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  // Delete modal state
  const [deletingRecipeId, setDeletingRecipeId] = useState<string | null>(null);

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

  const openRunModal = (recipe: Recipe) => {
    if (recipe.variables.length === 0) {
      executeRun(recipe, {});
      return;
    }
    const defaults: Record<string, string> = {};
    recipe.variables.forEach((v) => {
      defaults[v.name] = v.defaultValue || '';
    });
    setVariableValues(defaults);
    setRunningRecipe(recipe);
  };

  const executeRun = async (recipe: Recipe, vars: Record<string, string>) => {
    try {
      await window.sentry?.agent?.replayRecipe(recipe.id, vars);
      setFeedback({ message: `Recipe "${recipe.name}" started successfully.`, type: 'ok' });
    } catch (e: any) {
      setFeedback({ message: `Replay failed: ${e.message}`, type: 'error' });
    } finally {
      setRunningRecipe(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const confirmDelete = async () => {
    if (!deletingRecipeId) return;
    try {
      await window.sentry?.agent?.deleteRecipe(deletingRecipeId);
      loadRecipes();
      setFeedback({ message: 'Recipe removed.', type: 'ok' });
    } catch {
      setFeedback({ message: 'Failed to delete recipe.', type: 'error' });
    } finally {
      setDeletingRecipeId(null);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  return (
    <PageShell
      title="Recipes"
      description="Automate repeatable web workflows with saved multi-step tasks."
    >
      {feedback && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            background: feedback.type === 'ok' ? 'var(--ok-bg)' : 'var(--danger-bg)',
            color: feedback.type === 'ok' ? 'var(--ok)' : 'var(--danger)',
            border: `1px solid ${feedback.type === 'ok' ? 'rgba(63, 178, 127, 0.25)' : 'rgba(229, 72, 77, 0.25)'}`,
          }}
        >
          {feedback.type === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {isLoading ? (
        <Card style={{ textAlign: 'center', color: 'var(--text-3)', padding: '32px' }}>
          Loading recipes…
        </Card>
      ) : recipes.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '32px', color: 'var(--text-2)' }}>
          <p style={{ fontWeight: 500, color: 'var(--text)' }}>No saved recipes yet</p>
          <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px' }}>
            Complete an agent task and click "Save as recipe" in the sidebar to create one.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {recipes.map((r) => (
            <Card
              key={r.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                    {r.name}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', fontSize: '11px', color: 'var(--text-3)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Globe size={11} /> {r.sitePatterns.join(', ') || 'Any site'}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={11} /> Used {r.useCount} times
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => openRunModal(r)}
                    icon={<Play size={12} />}
                  >
                    Run
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setDeletingRecipeId(r.id)}
                    icon={<Trash2 size={12} />}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              {r.variables.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Variables:</span>
                  {r.variables.map((v) => (
                    <Badge key={v.name} variant="neutral">
                      {v.name}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Run with variables Modal */}
      {runningRecipe && (
        <Modal
          isOpen={true}
          onClose={() => setRunningRecipe(null)}
          title={`Run: ${runningRecipe.name}`}
          description="Provide parameter values for this recipe before executing."
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setRunningRecipe(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => executeRun(runningRecipe, variableValues)}
                icon={<Play size={12} />}
              >
                Run recipe
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {runningRecipe.variables.map((v) => (
              <div key={v.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>
                  {v.name}
                </label>
                <input
                  type="text"
                  value={variableValues[v.name] || ''}
                  onChange={(e) =>
                    setVariableValues({ ...variableValues, [v.name]: e.target.value })
                  }
                  placeholder={v.defaultValue || `Enter ${v.name}`}
                  style={{
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 10px',
                    color: 'var(--text)',
                    fontSize: '12px',
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deletingRecipeId && (
        <Modal
          isOpen={true}
          onClose={() => setDeletingRecipeId(null)}
          title="Delete recipe"
          description="Are you sure you want to remove this saved recipe? This action cannot be undone."
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setDeletingRecipeId(null)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={confirmDelete}>
                Delete
              </Button>
            </>
          }
        >
          <p style={{ fontSize: '12px', color: 'var(--text-2)' }}>
            The recipe steps and associated parameters will be permanently erased from your local storage.
          </p>
        </Modal>
      )}
    </PageShell>
  );
};
