import {
  decodeLiteralControlMarkers,
  escapeLiteralControlMarkers,
  parseOptionDisplay
} from '../src/services/optionParser';

function runOptionMarkerProtocolRegressionSuite() {
  console.log('Running Reserved Control Marker Protocol (¤) Regression Suite...');

  const errors: string[] = [];

  // ==========================================
  // TEST 1: Basic Selectable Options (¤a, ¤b, ¤c, ¤d)
  // ==========================================
  const t1Inputs = {
    A: '¤a. Alpha',
    B: '¤b. Beta',
    C: '¤c. Gamma',
    D: '¤d. Delta'
  };

  const parsed1 = (['A', 'B', 'C', 'D'] as const).map((k) => parseOptionDisplay(t1Inputs[k]));
  if (parsed1.filter((p) => p.selectable).length !== 4) {
    errors.push('FAIL Test 1: Expected 4 selectable options for ¤a, ¤b, ¤c, ¤d');
  } else {
    console.log('PASS Test 1: ¤a. Alpha, ¤b. Beta, ¤c. Gamma, ¤d. Delta → 4 selectable options');
  }

  // ==========================================
  // TEST 2: Statement Question (Unmarked Statements + ¤a/b/c/d Answers)
  // ==========================================
  const stmtOne = parseOptionDisplay('A. Statement one');
  const stmtTwo = parseOptionDisplay('B. Statement two');
  const stmtThree = parseOptionDisplay('C. Statement three');
  const stmtFour = parseOptionDisplay('D. Statement four');

  if (stmtOne.selectable || stmtTwo.selectable || stmtThree.selectable || stmtFour.selectable) {
    errors.push('FAIL Test 2: Unmarked statements were erroneously classified as selectable!');
  } else {
    console.log('PASS Test 2: Statement labels A/B/C/D without ¤ are non-selectable');
  }

  const ansA = parseOptionDisplay('¤a. Only A');
  const ansB = parseOptionDisplay('¤b. Only B');
  const ansC = parseOptionDisplay('¤c. A and C');
  const ansD = parseOptionDisplay('¤d. B and D');

  if (!ansA.selectable || !ansB.selectable || !ansC.selectable || !ansD.selectable) {
    errors.push('FAIL Test 2: ¤a/¤b/¤c/¤d answer choices were not classified as selectable');
  } else {
    console.log('PASS Test 2: Only lower ¤a/¤b/¤c/¤d answer block is selectable');
  }

  // ==========================================
  // TEST 3: Normal text containing a., b., c., d. without ¤
  // ==========================================
  const plainTextInputs = ['a. Parasympathetic', 'b. Pneumotaxic', 'c. Adrenal', 'd. Sympathetic'];
  for (const str of plainTextInputs) {
    const p = parseOptionDisplay(str);
    if (p.selectable) {
      errors.push(`FAIL Test 3: Plain text line "${str}" without ¤ was classified as selectable!`);
    }
  }
  console.log('PASS Test 3: Normal text containing "a.", "b.", "c.", "d." without ¤ → NONE selectable');

  // ==========================================
  // TEST 4: Literal "¤" in source text → Escaped "¤¤" -> Displays "¤" -> NOT selectable
  // ==========================================
  const literalSource = 'The currency symbol ¤ is used in economics.';
  const escapedStore = escapeLiteralControlMarkers(literalSource);
  if (escapedStore !== 'The currency symbol ¤¤ is used in economics.') {
    errors.push(`FAIL Test 4: Escaping failed: expected "The currency symbol ¤¤...", got "${escapedStore}"`);
  }

  const parsedLiteral = parseOptionDisplay(escapedStore);
  if (parsedLiteral.selectable) {
    errors.push('FAIL Test 4: Escaped literal "¤¤" was erroneously classified as selectable!');
  }
  if (parsedLiteral.displayText !== 'The currency symbol ¤ is used in economics.') {
    errors.push(`FAIL Test 4: Display text unescaping failed: got "${parsedLiteral.displayText}"`);
  }
  console.log('PASS Test 4: Source text containing literal "¤" → stored "¤¤" → displays "¤" → NOT selectable');

  // ==========================================
  // TEST 5: "¤¤a. This is literal source text" → NOT selectable
  // ==========================================
  const t5 = parseOptionDisplay('¤¤a. This is literal source text');
  if (t5.selectable) {
    errors.push('FAIL Test 5: "¤¤a. This is literal source text" was erroneously classified as selectable!');
  }
  if (t5.displayText !== '¤a. This is literal source text') {
    errors.push(`FAIL Test 5: "¤¤a..." unescaping incorrect: got "${t5.displayText}"`);
  }
  console.log('PASS Test 5: "¤¤a. This is literal source text" → NOT selectable (displays "¤a. This is literal source text")');

  // ==========================================
  // TEST 6: "¤a. Real option" → selectable A
  // ==========================================
  const t6 = parseOptionDisplay('¤a. Real option');
  if (!t6.selectable || t6.letter !== 'A' || t6.displayText !== 'Real option') {
    errors.push(`FAIL Test 6: "¤a. Real option" parsed incorrectly: ${JSON.stringify(t6)}`);
  } else {
    console.log('PASS Test 6: "¤a. Real option" → selectable A, displayText "Real option"');
  }

  // ==========================================
  // TEST 7: Verify "¤" is NEVER visible in rendered UI for selectable options
  // ==========================================
  const testSelectables = [
    '¤a. Option Alpha',
    '¤b) Option Beta',
    '¤c (A), (C) and (D)',
    '¤d. Less than that in the vena cava'
  ];

  for (const s of testSelectables) {
    const p = parseOptionDisplay(s);
    if (!p.selectable) {
      errors.push(`FAIL Test 7: "${s}" was not recognized as selectable`);
    }
    if (p.displayText.includes('¤')) {
      errors.push(`FAIL Test 7: Control marker ¤ leaked into displayText: "${p.displayText}"`);
    }
  }
  console.log('PASS Test 7: Control marker "¤" is NEVER visible in rendered production UI for selectable options');

  if (errors.length > 0) {
    console.error('\n========================================');
    console.error('CONTROL MARKER PROTOCOL FAILURES:');
    for (const err of errors) console.error(' - ' + err);
    console.error('========================================\n');
    process.exit(1);
  }

  console.log('\n========================================');
  console.log('ALL RESERVED CONTROL MARKER ASSERTIONS PASSED PERFECTLY!');
  console.log('========================================\n');
}

runOptionMarkerProtocolRegressionSuite();
