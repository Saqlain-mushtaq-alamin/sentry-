import { describe, it, expect } from 'vitest';
import { RiskTier, TaskState } from '../../src/shared/types';
import { APP_NAME } from '../../src/shared/constants';

describe('Shared Domain Types & Constants', () => {
  it('should have valid RiskTier enum values', () => {
    expect(RiskTier.LOW).toBe('low');
    expect(RiskTier.CRITICAL).toBe('critical');
  });

  it('should have valid TaskState enum values', () => {
    expect(TaskState.IDLE).toBe('idle');
    expect(TaskState.EXECUTING).toBe('executing');
  });

  it('should expose the correct application name', () => {
    expect(APP_NAME).toBe('Sentry Browser');
  });
});
