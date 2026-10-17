import { describe, it, expect, beforeEach } from 'vitest';
import { RiskClassifier } from '../../../src/main/action-layer/risk-classifier';
import {
  InteractiveElement,
  PageSnapshot,
  ProposedAction,
  RiskTier,
  SiteTrustLevel,
} from '../../../src/shared/types';

describe('RiskClassifier — policy rule and escalation gap coverage', () => {
  let classifier: RiskClassifier;

  beforeEach(() => {
    classifier = new RiskClassifier();
  });

  const el = (index: number, selector: string, props: Partial<InteractiveElement>): InteractiveElement => ({
    index,
    tag: 'button',
    role: 'button',
    label: '',
    selector,
    boundingBox: { x: 0, y: 0, width: 10, height: 10 },
    isVisible: true,
    isEnabled: true,
    ...props,
  });

  const snapshotWith = (elements: InteractiveElement[]): PageSnapshot => ({
    url: 'https://example.com',
    title: 'Test',
    timestamp: Date.now(),
    dom: { tag: 'body', children: [] },
    accessibilityTree: [],
    visibleText: '',
    forms: [],
    links: [],
    interactiveElements: elements,
    estimatedTokenCount: 10,
  });

  const action = (type: string, target: string, value?: string): ProposedAction => ({
    id: 'gap-action',
    type,
    target,
    value,
    riskTier: RiskTier.LOW,
    reason: 'gap coverage',
    timestamp: Date.now(),
    tabId: 'tab-1',
    url: 'https://example.com',
  });

  it('classifies a "Pay now" button click as CRITICAL via the payment-action rule', () => {
    const snapshot = snapshotWith([el(0, '#pay', { label: 'Pay now' })]);

    const result = classifier.classifyAction(action('click', '#pay'), snapshot, SiteTrustLevel.READ_ACT);

    expect(result.tier).toBe(RiskTier.CRITICAL);
    expect(result.policyRulesFired).toContain('payment-action');
  });

  it('reports the delete-action rule when clicking a "Delete Account" button', () => {
    const snapshot = snapshotWith([el(0, '#delete', { label: 'Delete Account' })]);

    const result = classifier.classifyAction(action('click', '#delete'), snapshot, SiteTrustLevel.READ_ACT);

    expect(result.tier).toBe(RiskTier.CRITICAL);
    expect(result.policyRulesFired).toContain('delete-action');
  });

  it('reports the password-field rule when interacting with a password input', () => {
    const snapshot = snapshotWith([
      el(0, '#password', { tag: 'input', label: 'Password', type: 'password' }),
    ]);

    const result = classifier.classifyAction(action('type', '#password', 'x'), snapshot, SiteTrustLevel.READ_ACT);

    expect(result.tier).toBe(RiskTier.CRITICAL);
    expect(result.policyRulesFired).toContain('password-field');
  });

  it('classifies clicking a file upload input as HIGH via the file-upload rule', () => {
    const snapshot = snapshotWith([
      el(0, '#upload', { tag: 'input', label: 'Upload document', type: 'file' }),
    ]);

    const result = classifier.classifyAction(action('click', '#upload'), snapshot, SiteTrustLevel.READ_ACT);

    expect(result.tier).toBe(RiskTier.HIGH);
    expect(result.policyRulesFired).toContain('file-upload');
  });

  it('escalates an SSN fill to CRITICAL via the sensitive-field override with escalatedFrom recorded', () => {
    const snapshot = snapshotWith([el(0, '#ssn', { tag: 'input', label: 'SSN', type: 'text' })]);

    const result = classifier.classifyAction(
      action('fill', '#ssn', '123-45-6789'),
      snapshot,
      SiteTrustLevel.READ_ACT
    );

    expect(result.tier).toBe(RiskTier.CRITICAL);
    expect(result.policyRulesFired).toContain('sensitive-form-fill');
    expect(result.escalatedFrom).toBe(RiskTier.HIGH);
    expect(result.reasons[0]).toContain('sensitive target field');
  });

  it('classifies CVV, phone, and address fills as HIGH via the sensitive-form-fill rule without the CRITICAL override', () => {
    const cases = [
      { selector: '#cvv', label: 'CVV code' },
      { selector: '#phone', label: 'Phone Number' },
      { selector: '#address', label: 'Home Address' },
    ];

    for (const c of cases) {
      const snapshot = snapshotWith([el(0, c.selector, { tag: 'input', label: c.label, type: 'text' })]);
      const result = classifier.classifyAction(action('type', c.selector, 'x'), snapshot, SiteTrustLevel.READ_ACT);

      expect(result.tier, `${c.label} should classify as HIGH`).toBe(RiskTier.HIGH);
      expect(result.policyRulesFired).toContain('sensitive-form-fill');
      expect(result.escalatedFrom).toBeUndefined();
    }
  });

  it('classifies a "Credit Card Number" fill as CRITICAL with escalatedFrom set to HIGH', () => {
    const snapshot = snapshotWith([
      el(0, '#cc', { tag: 'input', label: 'Credit Card Number', type: 'text' }),
    ]);

    const result = classifier.classifyAction(
      action('fill', '#cc', '4111111111111111'),
      snapshot,
      SiteTrustLevel.READ_ACT
    );

    expect(result.tier).toBe(RiskTier.CRITICAL);
    expect(result.escalatedFrom).toBe(RiskTier.HIGH);
  });

  it('classifies a "Remove from cart" click as HIGH via the remove-action rule', () => {
    const snapshot = snapshotWith([el(0, '#remove', { label: 'Remove from cart' })]);

    const result = classifier.classifyAction(action('click', '#remove'), snapshot, SiteTrustLevel.READ_ACT);

    expect(result.tier).toBe(RiskTier.HIGH);
    expect(result.policyRulesFired).toContain('remove-action');
  });

  it('classifies explicit submit actions as HIGH via the form-submit rule', () => {
    const snapshot = snapshotWith([
      el(0, '#go', { tag: 'button', type: 'submit', label: 'Continue' }),
    ]);

    const result = classifier.classifyAction(action('submit', '#go'), snapshot, SiteTrustLevel.READ_ACT);

    expect(result.tier).toBe(RiskTier.HIGH);
    expect(result.policyRulesFired).toContain('form-submit');
  });

  it('excludes search-labelled submit buttons from the form-submit rule and falls back to MEDIUM', () => {
    const snapshot = snapshotWith([
      el(0, '#search-btn', { tag: 'button', type: 'submit', label: 'Search' }),
    ]);

    const result = classifier.classifyAction(action('click', '#search-btn'), snapshot, SiteTrustLevel.READ_ACT);

    expect(result.policyRulesFired).not.toContain('form-submit');
    expect(result.tier).toBe(RiskTier.MEDIUM);
  });

  it('classifies typing into a search-labelled input as MEDIUM via the fill-search rule', () => {
    const snapshot = snapshotWith([
      el(0, '#q', { tag: 'input', label: 'Search products', type: 'text' }),
    ]);

    const result = classifier.classifyAction(action('type', '#q', 'boots'), snapshot, SiteTrustLevel.READ_ACT);

    expect(result.tier).toBe(RiskTier.MEDIUM);
    expect(result.policyRulesFired).toContain('fill-search');
  });

  it('classifies fill actions on type=search inputs as MEDIUM even without a search label', () => {
    const snapshot = snapshotWith([
      el(0, '#find', { tag: 'input', label: 'Keywords', type: 'search' }),
    ]);

    const result = classifier.classifyAction(action('fill', '#find', 'x'), snapshot, SiteTrustLevel.READ_ACT);

    expect(result.tier).toBe(RiskTier.MEDIUM);
    expect(result.policyRulesFired).toContain('fill-search');
  });

  it('classifies checkbox, radio, and select interactions as MEDIUM via the form-controls rule', () => {
    const elements = [
      el(0, '#agree', { tag: 'input', type: 'checkbox', label: 'Agree' }),
      el(1, '#choice', { tag: 'input', type: 'radio', label: 'Choice' }),
      el(2, '#pick', { tag: 'select', label: 'Pick one' }),
    ];
    const snapshot = snapshotWith(elements);

    for (const element of elements) {
      const result = classifier.classifyAction(action('click', element.selector), snapshot, SiteTrustLevel.READ_ACT);

      expect(result.tier, `${element.selector} should classify as MEDIUM`).toBe(RiskTier.MEDIUM);
      expect(result.policyRulesFired).toContain('form-controls');
    }
  });

  it('classifies clicks on elements whose href ends in .zip as MEDIUM via the download-file rule', () => {
    const snapshot = snapshotWith([
      el(0, '#dl', { tag: 'a', role: 'link', label: 'Get archive', href: 'files/archive.zip' }),
    ]);

    const result = classifier.classifyAction(action('click', '#dl'), snapshot, SiteTrustLevel.READ_ACT);

    expect(result.tier).toBe(RiskTier.MEDIUM);
    expect(result.policyRulesFired).toContain('download-file');
  });

  it('classifies navigation link clicks as LOW via the navigation-click rule', () => {
    const snapshot = snapshotWith([el(0, '#next', { tag: 'a', role: 'link', label: 'Next' })]);

    const result = classifier.classifyAction(action('click', '#next'), snapshot, SiteTrustLevel.READ_ACT);

    expect(result.tier).toBe(RiskTier.LOW);
    expect(result.policyRulesFired).toContain('navigation-click');
  });

  it('classifies scroll, hover, screenshot, navigate, goBack, and goForward as LOW via read-scroll-navigate', () => {
    const snapshot = snapshotWith([]);

    for (const type of ['scroll', 'hover', 'screenshot', 'navigate', 'goBack', 'goForward']) {
      const result = classifier.classifyAction(action(type, ''), snapshot, SiteTrustLevel.READ_ACT);

      expect(result.tier, `${type} should classify as LOW`).toBe(RiskTier.LOW);
      expect(result.policyRulesFired).toContain('read-scroll-navigate');
    }
  });

  it('falls back to MEDIUM with reduced confidence when no policy rules match', () => {
    const snapshot = snapshotWith([el(0, '#plain', { tag: 'button', label: 'Continue' })]);

    const result = classifier.classifyAction(action('click', '#plain'), snapshot, SiteTrustLevel.READ_ACT);

    expect(result.tier).toBe(RiskTier.MEDIUM);
    expect(result.policyRulesFired).toEqual([]);
    expect(result.confidence).toBe(0.5);
    expect(result.reasons.some((r) => r.includes('defaulting to MEDIUM risk'))).toBe(true);
  });

  it('escalates MEDIUM to HIGH on HIGHLY_RESTRICTED domains with escalatedFrom recorded', () => {
    const snapshot = snapshotWith([el(0, '#agree', { tag: 'input', type: 'checkbox', label: 'Agree' })]);

    const result = classifier.classifyAction(
      action('click', '#agree'),
      snapshot,
      SiteTrustLevel.HIGHLY_RESTRICTED
    );

    expect(result.tier).toBe(RiskTier.HIGH);
    expect(result.escalatedFrom).toBe(RiskTier.MEDIUM);
    expect(result.reasons[0]).toContain('Escalated from MEDIUM to HIGH');
  });

  it('notes READ_ONLY domains in the reasons for non-LOW actions without changing the tier', () => {
    const snapshot = snapshotWith([el(0, '#go', { tag: 'button', type: 'submit', label: 'Continue' })]);

    const result = classifier.classifyAction(action('click', '#go'), snapshot, SiteTrustLevel.READ_ONLY);

    expect(result.tier).toBe(RiskTier.HIGH);
    expect(result.reasons.some((r) => r.includes('READ_ONLY'))).toBe(true);
  });

  it('does not add a READ_ONLY note for LOW actions on READ_ONLY domains', () => {
    const snapshot = snapshotWith([]);

    const result = classifier.classifyAction(action('scroll', ''), snapshot, SiteTrustLevel.READ_ONLY);

    expect(result.tier).toBe(RiskTier.LOW);
    expect(result.reasons.some((r) => r.includes('READ_ONLY'))).toBe(false);
  });
});
