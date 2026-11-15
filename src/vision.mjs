/**
 * The near-vision screen behind the Eyes check: lines of letters at arm's length, each smaller than the last, one eye at a
 * time. It is a self-check for change, not an acuity measurement; the result feeds the vision symptom (0 none, 1 mild, 2 strong).
 */
export const LETTERS = 'CDHKNORSVZ';
/** Letter heights in px for lines 1 to 6, largest first. */
export const SIZES = [64, 48, 36, 26, 18, 12];

/** Five letters per line, no letter twice in a row. @param {() => number} [random] */
export function chart(random = Math.random) {
  return SIZES.map(() => {
    let line = '';
    while (line.length < 5) { const l = LETTERS[Math.floor(random() * LETTERS.length)]; if (l !== line.at(-1)) line += l; }
    return line;
  });
}

/** Where an eye first stopped reading clearly. @param {('clear'|'blurry'|'none')[]} answers */
export function firstIssue(answers) {
  const i = answers.findIndex(a => a !== 'clear');
  return i < 0 ? null : { line: i + 1, answer: answers[i] };
}

/** One eye: 0 clear to the end, 1 a blur only on the small lines (5–6) or a blur at line 4, 2 anything worse. */
export function eyeScore(answers) {
  const issue = firstIssue(answers);
  if (!issue) return 0;
  if (issue.line >= 5) return 1;
  return issue.line === 4 && issue.answer === 'blurry' ? 1 : 2;
}

/** The vision check's value: the worse eye decides. */
export const visionValue = (left, right) => Math.max(eyeScore(left), eyeScore(right));

/** One line per eye, for the result. */
export function describe(answers) {
  const issue = firstIssue(answers);
  if (!issue) return `clear to line ${SIZES.length}`;
  return issue.answer === 'none' ? `can't see from line ${issue.line}` : `blurry from line ${issue.line}`;
}

/** An eye is finished when it can't see a line, or has answered every line. */
export const eyeDone = answers => answers.at(-1) === 'none' || answers.length === SIZES.length;
