import { PageSnapshot } from '../../../shared/types';
import { CDPManager } from '../../cdp/cdp-manager';
import { HiddenScanner } from './hidden-scanner';
import { detectInjection } from './pattern-matcher';
import { ContentSanitizer } from './content-sanitizer';
import { ScanReport, DetectionResult } from './types';

export class InjectionDetector {
  private hiddenScanner: HiddenScanner;
  private sanitizer: ContentSanitizer;

  constructor(cdp: CDPManager) {
    this.hiddenScanner = new HiddenScanner(cdp);
    this.sanitizer = new ContentSanitizer();
  }

  public async scanPage(tabId: string, snapshot: PageSnapshot): Promise<ScanReport> {
    const start = Date.now();
    const allDetections: DetectionResult[] = [];

    // 1. Scan for hidden content
    const hiddenContent = await this.hiddenScanner.scanForHiddenContent(tabId);
    
    // 2. Run pattern matching on all visible text
    const visibleTextResult = detectInjection(snapshot.visibleText, 'visible_text');
    if (visibleTextResult.isInjection) {
      allDetections.push(visibleTextResult);
    }
    
    // 3. Run pattern matching on all hidden content
    for (const h of hiddenContent) {
      const hiddenResult = detectInjection(h.content, h.type);
      if (hiddenResult.isInjection) {
        allDetections.push(hiddenResult);
      }
    }
    
    // 4. Run pattern matching on metadata
    const metaResult = detectInjection(snapshot.title || '', 'metadata');
    if (metaResult.isInjection) {
      allDetections.push(metaResult);
    }
    
    // 5. Aggregate results
    const isClean = allDetections.length === 0;
    const sanitizedSnapshot = this.sanitizer.sanitize(snapshot, allDetections);
    const elapsed = Date.now() - start;

    return {
      isClean,
      detections: allDetections,
      hiddenContentFound: hiddenContent.length,
      sanitizedSnapshot,
      scanDuration: elapsed,
    };
  }
}
