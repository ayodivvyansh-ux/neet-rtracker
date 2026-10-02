import { validateQuestionVisual, TextItem, BoundingBox } from '../src/services/visualValidator';
import { extractVisualStorageDetails } from '../src/services/visualResolver';

function runAssertions() {
  console.log('======================================================');
  console.log('RUNNING FULL 10-TEST HARDENED VALIDATOR SUITE');
  console.log('======================================================');

  let passed = 0;
  let failed = 0;

  function assert(testNum: number, name: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`TEST ${testNum} — PASS`);
      passed++;
    } else {
      console.error(`TEST ${testNum} — FAIL (${name}) | ${details || ''}`);
      failed++;
    }
  }

  // TEST 1: Clean matching table -> SAFE
  {
    const textItems: TextItem[] = [
      { str: 'Column-I Column-II', x: 10, y: 10 },
      { str: 'A. Fibrinogen (i) Osmotic balance', x: 10, y: 20 },
      { str: 'B. Globulin (ii) Blood clotting', x: 10, y: 30 },
      { str: 'C. Albumin (iii) Defence mechanism', x: 10, y: 40 },
      { str: 'D. Water (iv) Plasma fluid', x: 10, y: 50 }
    ];
    const res = validateQuestionVisual({
      textItems,
      isDiagram: false,
      qNum: 4,
      sourcePdf: 'test.pdf'
    });
    assert(1, 'Clean matching table is SAFE', res.isValid && res.status === 'SAFE');
  }

  // TEST 2: Matching table + Answer Key -> QUARANTINED
  {
    const textItems: TextItem[] = [
      { str: 'Column-I Column-II', x: 10, y: 10 },
      { str: 'A. Fibrinogen (i) Blood clotting', x: 10, y: 20 },
      { str: 'B. Globulin (ii) Defence mechanism', x: 10, y: 30 },
      { str: 'C. Albumin (iii) Osmotic balance', x: 10, y: 40 },
      { str: 'D. Water (iv) Plasma fluid', x: 10, y: 50 },
      { str: 'Answer Key: 1. (a) 2. (b) 3. (c) 4. (d)', x: 10, y: 70 }
    ];
    const res = validateQuestionVisual({
      textItems,
      isDiagram: false,
      qNum: 4,
      sourcePdf: 'test.pdf'
    });
    assert(
      2,
      'Matching table + Answer Key is QUARANTINED',
      !res.isValid && res.status === 'QUARANTINED' && res.reasons.includes('ANSWER_KEY_DETECTED')
    );
  }

  // TEST 3: Matching table + next question -> QUARANTINED
  {
    const textItems: TextItem[] = [
      { str: 'Column-I Column-II', x: 10, y: 10 },
      { str: 'A. Fibrinogen (i) Blood clotting', x: 10, y: 20 },
      { str: 'B. Globulin (ii) Defence mechanism', x: 10, y: 30 },
      { str: 'C. Albumin (iii) Osmotic balance', x: 10, y: 40 },
      { str: 'D. Water (iv) Plasma fluid', x: 10, y: 50 },
      { str: '5. Which of the following is correct', x: 10, y: 70 }
    ];
    const res = validateQuestionVisual({
      textItems,
      isDiagram: false,
      qNum: 4,
      sourcePdf: 'test.pdf'
    });
    assert(
      3,
      'Matching table + next question is QUARANTINED',
      !res.isValid && res.status === 'QUARANTINED' && res.reasons.includes('NEIGHBOURING_QUESTION_DETECTED')
    );
  }

  // TEST 4: Matching table + answer options underneath -> QUARANTINED
  {
    const textItems: TextItem[] = [
      { str: 'Column-I Column-II', x: 10, y: 10 },
      { str: 'A. Fibrinogen (i) Blood clotting', x: 10, y: 20 },
      { str: 'B. Globulin (ii) Defence mechanism', x: 10, y: 30 },
      { str: 'C. Albumin (iii) Osmotic balance', x: 10, y: 40 },
      { str: 'D. Water (iv) Plasma fluid', x: 10, y: 50 },
      { str: 'a. A-(ii), B-(iii), C-(i), D-(iv)', x: 10, y: 70 },
      { str: 'b. A-(ii), B-(i), C-(iii), D-(iv)', x: 10, y: 80 }
    ];
    const res = validateQuestionVisual({
      textItems,
      isDiagram: false,
      qNum: 4,
      sourcePdf: 'test.pdf'
    });
    assert(
      4,
      'Matching table + options underneath is QUARANTINED',
      !res.isValid && res.status === 'QUARANTINED' && res.reasons.includes('MCQ_OPTIONS_DETECTED')
    );
  }

  // TEST 5: Matching table containing A/B/C/D legitimately -> SAFE
  {
    const textItems: TextItem[] = [
      { str: 'Column-I Column-II', x: 10, y: 10 },
      { str: 'A. Fibrinogen', x: 10, y: 20 },
      { str: 'B. Globulin', x: 10, y: 30 },
      { str: 'C. Albumin', x: 10, y: 40 },
      { str: 'D. Water', x: 10, y: 50 }
    ];
    const res = validateQuestionVisual({
      textItems,
      isDiagram: false,
      qNum: 4,
      sourcePdf: 'test.pdf'
    });
    assert(5, 'Legitimate A/B/C/D match is SAFE', res.isValid && res.status === 'SAFE');
  }

  // TEST 6: Incomplete A/B-only matching table -> QUARANTINED
  {
    const textItems: TextItem[] = [
      { str: 'Column-I Column-II', x: 10, y: 10 },
      { str: 'A. Fibrinogen', x: 10, y: 20 },
      { str: 'B. Globulin', x: 10, y: 30 }
    ];
    const res = validateQuestionVisual({
      textItems,
      isDiagram: false,
      qNum: 4,
      sourcePdf: 'test.pdf'
    });
    assert(
      6,
      'Incomplete A/B matching table is QUARANTINED',
      !res.isValid && res.status === 'QUARANTINED' && res.reasons.includes('INCOMPLETE_TABLE')
    );
  }

  // TEST 7: Diagram + unrelated source-page content -> QUARANTINED
  {
    const textItems: TextItem[] = [
      { str: 'Class-XI Zoology Practical', x: 10, y: 10 },
      { str: 'Diagram of Human Heart', x: 10, y: 20 }
    ];
    const res = validateQuestionVisual({
      textItems,
      isDiagram: true,
      qNum: 23,
      sourcePdf: 'test.pdf'
    });
    assert(
      7,
      'Diagram + unrelated source-page practical header is QUARANTINED',
      !res.isValid && res.status === 'QUARANTINED' && res.reasons.includes('SOURCE_PAGE_CONTAMINATION')
    );
  }

  // TEST 8: Clean diagram -> SAFE
  {
    const textItems: TextItem[] = [
      { str: 'P-wave', x: 10, y: 10 },
      { str: 'QRS complex', x: 10, y: 20 },
      { str: 'T-wave', x: 10, y: 30 }
    ];
    const res = validateQuestionVisual({
      textItems,
      isDiagram: true,
      qNum: 23,
      sourcePdf: 'test.pdf'
    });
    assert(8, 'Clean diagram is SAFE', res.isValid && res.status === 'SAFE');
  }

  // TEST 9: Missing storage asset -> MISSING/UNRESOLVABLE
  {
    // Simulate resolution of a visual with missing/invalid storage details
    const visualObj = { hasVisual: true, storage_path: '' };
    const details = extractVisualStorageDetails(visualObj);
    const isUnresolvable = !details.storagePath && !details.dataUrl;
    assert(9, 'Missing storage asset is UNRESOLVABLE', isUnresolvable);
  }

  // TEST 10: Frontend visual has no URL -> fallback UI
  {
    // Check that extractVisualStorageDetails correctly flags hasVisual: false
    // if there is no URL or path, which prompts the UI to render the fallback
    const visualObj = { hasVisual: true, storage_path: null, data_url: null };
    const details = extractVisualStorageDetails(visualObj);
    const triggerFallback = !details.storagePath && !details.dataUrl;
    assert(10, 'Frontend visual has no URL triggers fallback UI', triggerFallback);
  }

  console.log('\n======================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAssertions();
