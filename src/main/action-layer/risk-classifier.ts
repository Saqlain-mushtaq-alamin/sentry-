import {
  ActionContext,
  RiskClassification,
  RiskTier,
  SiteTrustLevel,
  ProposedAction,
  PageSnapshot,
  InteractiveElement
} from '../../shared/types';
import { ElementResolver } from '../cdp/element-resolver';

interface PolicyRule {
  id: string;
  name: string;
  description: string;
  priority: number;        // Higher priority rules override lower
  condition: (context: ActionContext) => boolean;
  riskTier: RiskTier;
}

const resolver = new ElementResolver();

// Pre-defined rules
const rules: PolicyRule[] = [
  // CRITICAL Rules (Priority 100+)
  {
    id: 'password-manager-extension',
    name: 'Password Manager Interaction',
    description: 'Interaction with a password manager extension is ALWAYS CRITICAL',
    priority: 120, // Highest priority
    condition: (ctx) => {
      // If the target URL or any metadata indicates it's a password manager extension
      // E.g. chrome-extension://... or specific IDs for bitwarden/1password
      const targetStr = (ctx.action.target || '').toLowerCase();
      const urlStr = (ctx.action.url || '').toLowerCase();
      return urlStr.includes('chrome-extension://') && 
             (urlStr.includes('password') || urlStr.includes('bitwarden') || urlStr.includes('lastpass') || 
              targetStr.includes('bitwarden') || targetStr.includes('1password'));
    },
    riskTier: RiskTier.CRITICAL,
  },
  {
    id: 'password-field',
    name: 'Password Field Interaction',
    description: 'Any interaction with a password field is CRITICAL',
    priority: 100,
    condition: (ctx) => {
      const type = (ctx.targetElement as InteractiveElement)?.type;
      return type === 'password';
    },
    riskTier: RiskTier.CRITICAL,
  },
  {
    id: 'delete-action',
    name: 'Delete Action',
    description: 'Deleting content or accounts is CRITICAL',
    priority: 110,
    condition: (ctx) => {
      const label = (ctx.targetElement as InteractiveElement)?.label?.toLowerCase() || '';
      return ['delete', 'remove', 'destroy', 'terminate'].some(word => label.includes(word));
    },
    riskTier: RiskTier.CRITICAL,
  },
  {
    id: 'payment-action',
    name: 'Payment Action',
    description: 'Making payments is CRITICAL',
    priority: 110,
    condition: (ctx) => {
      const label = (ctx.targetElement as InteractiveElement)?.label?.toLowerCase() || '';
      return ['pay now', 'checkout', 'submit payment', 'buy now'].some(word => label.includes(word));
    },
    riskTier: RiskTier.CRITICAL,
  },
  // HIGH Rules (Priority 80+)
  {
    id: 'form-submit',
    name: 'Form Submission',
    description: 'Submitting a form is HIGH',
    priority: 80,
    condition: (ctx) => ctx.action.type === 'click' && (ctx.targetElement as InteractiveElement)?.type === 'submit',
    riskTier: RiskTier.HIGH,
  },
  {
    id: 'sensitive-form-fill',
    name: 'Sensitive Form Fill',
    description: 'Filling out sensitive information is HIGH',
    priority: 85,
    condition: (ctx) => {
      if (ctx.action.type !== 'type' && ctx.action.type !== 'fill') return false;
      const label = (ctx.targetElement as InteractiveElement)?.label?.toLowerCase() || '';
      return ['ssn', 'credit card', 'card number', 'phone', 'address'].some(word => label.includes(word));
    },
    riskTier: RiskTier.HIGH,
  },
  // MEDIUM Rules (Priority 50+)
  {
    id: 'download-file',
    name: 'Download File',
    description: 'Downloading a file is MEDIUM',
    priority: 50,
    condition: (ctx) => {
      const href = (ctx.targetElement as any)?.href || '';
      return href.match(/\.(pdf|zip|exe|dmg|pkg)$/i) !== null;
    },
    riskTier: RiskTier.MEDIUM,
  },
  {
    id: 'fill-search',
    name: 'Fill Search Box',
    description: 'Filling a search box is MEDIUM',
    priority: 60,
    condition: (ctx) => {
      if (ctx.action.type !== 'type' && ctx.action.type !== 'fill') return false;
      const type = (ctx.targetElement as InteractiveElement)?.type;
      const label = (ctx.targetElement as InteractiveElement)?.label?.toLowerCase() || '';
      return type === 'search' || label.includes('search');
    },
    riskTier: RiskTier.MEDIUM,
  },
  // LOW Rules (Priority 10+)
  {
    id: 'navigation-click',
    name: 'Navigation Link Click',
    description: 'Clicking a navigation link is LOW',
    priority: 20,
    condition: (ctx) => {
      return ctx.action.type === 'click' && ((ctx.targetElement as InteractiveElement)?.role === 'link' || (ctx.targetElement as any)?.tag === 'a');
    },
    riskTier: RiskTier.LOW,
  },
  {
    id: 'read-scroll-navigate',
    name: 'Read/Scroll/Navigate',
    description: 'Non-interactive or view-only actions are LOW',
    priority: 10,
    condition: (ctx) => ['scroll', 'hover', 'screenshot', 'navigate', 'goBack', 'goForward'].includes(ctx.action.type),
    riskTier: RiskTier.LOW,
  },
];

export class RiskClassifier {
  public classifyAction(
    action: ProposedAction,
    pageSnapshot: PageSnapshot,
    siteTrust: SiteTrustLevel
  ): RiskClassification {
    // 1. Resolve target element
    let targetElement: InteractiveElement | undefined;
    if (action.target) {
      if (action.target.startsWith('#') && !isNaN(parseInt(action.target.replace('#', '')))) {
         const idx = parseInt(action.target.replace('#', ''));
         targetElement = pageSnapshot.interactiveElements.find(e => e.index === idx);
      } else {
         targetElement = pageSnapshot.interactiveElements.find(e => e.selector === action.target);
      }
    }

    const context: ActionContext = {
      action,
      pageSnapshot,
      siteTrust,
      targetElement,
    };

    // 2. Evaluate all rules
    const matchingRules = rules.filter(rule => rule.condition(context));
    
    // Sort by priority descending
    matchingRules.sort((a, b) => b.priority - a.priority);

    let baseTier = RiskTier.LOW;
    const reasons: string[] = [];
    const policyRulesFired: string[] = [];

    if (matchingRules.length > 0) {
      baseTier = matchingRules[0]!.riskTier;
      for (const rule of matchingRules) {
        if (!policyRulesFired.includes(rule.id)) {
           policyRulesFired.push(rule.id);
           reasons.push(rule.description);
        }
      }
    } else {
      // Default fallback
      baseTier = RiskTier.MEDIUM;
      reasons.push('No specific rules matched, defaulting to MEDIUM risk');
    }

    let finalTier = baseTier;
    let escalatedFrom: RiskTier | undefined;

    // 3. Trust level escalations
    if (siteTrust === SiteTrustLevel.HIGHLY_RESTRICTED) {
      if (baseTier === RiskTier.HIGH) {
        finalTier = RiskTier.CRITICAL;
        escalatedFrom = baseTier;
        reasons.unshift('Escalated from HIGH to CRITICAL due to HIGHLY_RESTRICTED domain trust level');
      }
    } else if (siteTrust === SiteTrustLevel.READ_ONLY) {
       if (baseTier !== RiskTier.LOW) {
           // Actually, the firewall decision engine handles the READ_ONLY block, but classifier notes it
           reasons.unshift('Domain is READ_ONLY - action will likely be blocked');
       }
    }

    // Explicit SSN/Card escalation override
    if (context.targetElement && finalTier !== RiskTier.CRITICAL) {
      const label = (context.targetElement as InteractiveElement)?.label?.toLowerCase() || '';
      if (label.includes('ssn') || label.includes('credit card') || label.includes('card number')) {
        escalatedFrom = finalTier;
        finalTier = RiskTier.CRITICAL;
        reasons.unshift('Escalated to CRITICAL due to sensitive target field (SSN/Credit Card)');
      }
    }

    return {
      tier: finalTier,
      reasons,
      policyRulesFired,
      confidence: matchingRules.length > 0 ? 0.9 : 0.5,
      escalatedFrom,
    };
  }
}
