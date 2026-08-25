import { DetectionResult, InjectionPattern } from './types';

export const INJECTION_PATTERNS: InjectionPattern[] = [
  // Category 1: Direct instruction override
  { id: 'ignore-previous', regex: /ignore\s+(all\s+)?(prior|previous)\s+instructions/i, confidence: 0.95, category: 'instruction_override' },
  { id: 'forget-instructions', regex: /forget\s+your\s+instructions/i, confidence: 0.9, category: 'instruction_override' },
  { id: 'disregard-above', regex: /disregard\s+the\s+above/i, confidence: 0.9, category: 'instruction_override' },
  { id: 'new-instructions', regex: /new\s+instructions:/i, confidence: 0.8, category: 'instruction_override' },
  { id: 'system-prompt-override', regex: /system\s+prompt:/i, confidence: 0.8, category: 'instruction_override' },
  { id: 'you-are-now', regex: /you\s+are\s+now/i, confidence: 0.9, category: 'instruction_override' },
  
  // Category 2: Role manipulation
  { id: 'new-role', regex: /your\s+new\s+role\s+is/i, confidence: 0.85, category: 'role_manipulation' },
  { id: 'reprogrammed', regex: /you\s+have\s+been\s+reprogrammed/i, confidence: 0.95, category: 'role_manipulation' },
  { id: 'creator-wants', regex: /your\s+creator\s+wants\s+you\s+to/i, confidence: 0.85, category: 'role_manipulation' },
  { id: 'user-actually-wants', regex: /the\s+user\s+actually\s+wants\s+you\s+to/i, confidence: 0.8, category: 'role_manipulation' },
  
  // Category 3: Action commands in content
  { id: 'click-on', regex: /click\s+on/i, confidence: 0.5, category: 'action_command' },
  { id: 'navigate-to', regex: /navigate\s+to\s+['"]?https?:\/\//i, confidence: 0.6, category: 'action_command' },
  { id: 'enter-password', regex: /enter\s+the\s+password/i, confidence: 0.7, category: 'action_command' },
  { id: 'transfer-money', regex: /transfer\s+money\s+to/i, confidence: 0.9, category: 'action_command' },
  { id: 'download-and-run', regex: /download\s+and\s+run/i, confidence: 0.9, category: 'action_command' },

  // Category 4: Data exfiltration attempts
  { id: 'send-all-data', regex: /send\s+all\s+data\s+to\s+['"]?https?:\/\//i, confidence: 0.95, category: 'data_exfiltration' },
  { id: 'email-following', regex: /email\s+the\s+following\s+to/i, confidence: 0.8, category: 'data_exfiltration' },
  { id: 'include-user-data', regex: /include\s+\[?user\s+data\]?\s+in/i, confidence: 0.8, category: 'data_exfiltration' },
  { id: 'copy-page-content', regex: /copy\s+the\s+page\s+content/i, confidence: 0.7, category: 'data_exfiltration' },

  // Category 5: Encoding evasion (Basic detection of base64 chunks or strange instructions)
  { id: 'base64-evasion', regex: /atob\s*\(/i, confidence: 0.6, category: 'encoding_evasion' },
  { id: 'base64-evasion-btoa', regex: /btoa\s*\(/i, confidence: 0.6, category: 'encoding_evasion' }
];

export function detectInjection(text: string, sourceLocation: string): DetectionResult {
  const matchedPatterns: string[] = [];
  let totalConfidence = 0;
  let maxConfidence = 0;

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.regex.test(text)) {
      matchedPatterns.push(pattern.id);
      totalConfidence += pattern.confidence;
      if (pattern.confidence > maxConfidence) {
        maxConfidence = pattern.confidence;
      }
    }
  }

  // Determine if it's an injection based on confidence
  // We flag if there's a single high confidence match (>0.85) or aggregate > 1.2
  const isInjection = maxConfidence >= 0.85 || totalConfidence >= 1.2;

  return {
    isInjection,
    confidence: Math.min(1.0, maxConfidence), // cap at 1.0
    matchedPatterns,
    sourceText: text,
    sourceLocation,
    explanation: isInjection 
      ? `Found prompt injection patterns: ${matchedPatterns.join(', ')}` 
      : ''
  };
}
