import { PageSnapshot } from '../../../shared/types';

export interface HiddenContent {
  type: 'hidden-element' | 'zero-size' | 'offscreen' | 'same-color' |
        'metadata' | 'aria-hidden' | 'comment' | 'data-attribute';
  content: string;
  selector: string;
  confidence: number;  // 0-1
}

export interface InjectionPattern {
  id: string;
  regex: RegExp;
  confidence: number;
  category: 'instruction_override' | 'role_manipulation' | 'action_command' | 'data_exfiltration' | 'encoding_evasion';
}

export interface DetectionResult {
  isInjection: boolean;
  confidence: number;          // 0-1
  matchedPatterns: string[];   // Which patterns matched
  sourceText: string;          // The suspicious text
  sourceLocation: string;      // Where it was found (e.g. 'visible_text', 'hidden-element')
  explanation: string;         // User-facing explanation
}

export interface SanitizedSnapshot extends PageSnapshot {
  wasSanitized: boolean;
  sanitizationDetails?: {
    removedHiddenElements: number;
    removedDataAttributes: number;
    removedComments: number;
  };
}

export interface ScanReport {
  isClean: boolean;
  detections: DetectionResult[];
  hiddenContentFound: number;
  sanitizedSnapshot: SanitizedSnapshot;
  scanDuration: number;
}
