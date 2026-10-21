import { describe, it, expect, beforeEach } from 'vitest';
import { RiskClassifier } from '../../../src/main/action-layer/risk-classifier';
import { ProposedAction, RiskTier, SiteTrustLevel, PageSnapshot, InteractiveElement } from '../../../src/shared/types';

describe('RiskClassifier', () => {
  let classifier: RiskClassifier;
  let mockSnapshot: PageSnapshot;

  beforeEach(() => {
    classifier = new RiskClassifier();
    mockSnapshot = {
      url: 'https://example.com',
      title: 'Test',
      timestamp: Date.now(),
      dom: { tag: 'body', children: [] },
      accessibilityTree: [],
      visibleText: '',
      forms: [],
      links: [],
      interactiveElements: [
        { index: 0, tag: 'button', role: 'button', label: 'Submit', selector: '#submit', boundingBox: {x:0, y:0, width:10, height:10}, isVisible: true, isEnabled: true, type: 'submit' },
        { index: 1, tag: 'input', role: 'textbox', label: 'Password', selector: '#password', boundingBox: {x:0, y:0, width:10, height:10}, isVisible: true, isEnabled: true, type: 'password' },
        { index: 2, tag: 'a', role: 'link', label: 'Next Page', selector: '#nav', boundingBox: {x:0, y:0, width:10, height:10}, isVisible: true, isEnabled: true },
        { index: 3, tag: 'button', role: 'button', label: 'Delete Account', selector: '#delete', boundingBox: {x:0, y:0, width:10, height:10}, isVisible: true, isEnabled: true },
        { index: 4, tag: 'input', role: 'textbox', label: 'Search', selector: '#search', boundingBox: {x:0, y:0, width:10, height:10}, isVisible: true, isEnabled: true, type: 'search' },
        { index: 5, tag: 'input', role: 'textbox', label: 'Credit Card', selector: '#cc', boundingBox: {x:0, y:0, width:10, height:10}, isVisible: true, isEnabled: true, type: 'text' },
        { index: 6, tag: 'a', role: 'link', label: 'Download Report', selector: '#download', boundingBox: {x:0, y:0, width:10, height:10}, isVisible: true, isEnabled: true },
      ],
      estimatedTokenCount: 10
    };
    // Mock the download element href for the classifier
    (mockSnapshot.interactiveElements[6] as any).href = 'report.pdf';
  });

  const createAction = (type: string, target: string, value?: string): ProposedAction => ({
    id: 'test-action',
    type,
    target,
    value,
    riskTier: RiskTier.LOW, // Not used by classifier, just for shape
    reason: 'Testing',
    timestamp: Date.now(),
    tabId: 'tab-1',
    url: 'https://example.com'
  });

  it('classifies read/scroll/navigate as LOW', () => {
    const action = createAction('scroll', '');
    const result = classifier.classifyAction(action, mockSnapshot, SiteTrustLevel.READ_ACT);
    expect(result.tier).toBe(RiskTier.LOW);
  });

  it('classifies navigation link click as LOW', () => {
    const action = createAction('click', '#nav');
    const result = classifier.classifyAction(action, mockSnapshot, SiteTrustLevel.READ_ACT);
    expect(result.tier).toBe(RiskTier.LOW);
  });

  it('classifies search box fill as MEDIUM', () => {
    const action = createAction('type', '#search', 'hello');
    const result = classifier.classifyAction(action, mockSnapshot, SiteTrustLevel.READ_ACT);
    expect(result.tier).toBe(RiskTier.MEDIUM);
  });

  it('classifies file download as MEDIUM', () => {
    const action = createAction('click', '#download');
    const result = classifier.classifyAction(action, mockSnapshot, SiteTrustLevel.READ_ACT);
    expect(result.tier).toBe(RiskTier.MEDIUM);
  });

  it('classifies form submission as HIGH', () => {
    const action = createAction('click', '#submit');
    const result = classifier.classifyAction(action, mockSnapshot, SiteTrustLevel.READ_ACT);
    expect(result.tier).toBe(RiskTier.HIGH);
  });

  it('classifies sensitive form fill as HIGH -> CRITICAL due to hardcoded sensitive check', () => {
    const action = createAction('type', '#cc', '1234');
    const result = classifier.classifyAction(action, mockSnapshot, SiteTrustLevel.READ_ACT);
    expect(result.tier).toBe(RiskTier.CRITICAL);
    expect(result.reasons.some(r => r.includes('Escalated to CRITICAL due to sensitive target field'))).toBe(true);
  });

  it('classifies password field interaction as CRITICAL', () => {
    const action = createAction('type', '#password', 'secret');
    const result = classifier.classifyAction(action, mockSnapshot, SiteTrustLevel.READ_ACT);
    expect(result.tier).toBe(RiskTier.CRITICAL);
  });

  it('classifies delete action as CRITICAL', () => {
    const action = createAction('click', '#delete');
    const result = classifier.classifyAction(action, mockSnapshot, SiteTrustLevel.READ_ACT);
    expect(result.tier).toBe(RiskTier.CRITICAL);
  });

  it('escalates HIGH to CRITICAL on HIGHLY_RESTRICTED domain', () => {
    const action = createAction('click', '#submit'); // Normally HIGH
    const result = classifier.classifyAction(action, mockSnapshot, SiteTrustLevel.HIGHLY_RESTRICTED);
    expect(result.tier).toBe(RiskTier.CRITICAL);
    expect(result.reasons[0]).toContain('Escalated from HIGH to CRITICAL');
  });

  it('classifies Add to Cart as HIGH risk', () => {
    mockSnapshot.interactiveElements.push({
      index: 7,
      tag: 'button',
      role: 'button',
      label: 'Add to Cart',
      selector: '#add-cart-btn',
      boundingBox: { x: 0, y: 0, width: 10, height: 10 },
      isVisible: true,
      isEnabled: true,
    });
    const action = createAction('click', '#add-cart-btn');
    const result = classifier.classifyAction(action, mockSnapshot, SiteTrustLevel.READ_ACT);
    expect(result.tier).toBe(RiskTier.HIGH);
    expect(result.policyRulesFired).toContain('cart-action');
  });
});
