import rules from '../../modules/screen-reader/android/src/main/assets/reading-rules.json';

// The Android screen reader (ReadingRules.kt) reads these keys. If one goes
// missing, the reader would crash on the phone, so check them here first.

const nonEmptyString = expect.stringMatching(/\S/);

test('every role the screen reader names has a word', () => {
  for (const key of ['button', 'textBox', 'heading', 'checkbox', 'switch', 'picture', 'list']) {
    expect(rules.roles).toHaveProperty(key, nonEmptyString);
  }
});

test('every state and phrase it says has a word', () => {
  for (const key of ['ticked', 'notTicked', 'on', 'off', 'empty', 'hidden']) {
    expect(rules.states).toHaveProperty(key, nonEmptyString);
  }
  for (const key of ['and', 'nothingToRead', 'endOfScreen']) {
    expect(rules.phrases).toHaveProperty(key, nonEmptyString);
  }
});

test('each count has a "one" and a "many" form, and "many" shows the number', () => {
  const pairs = [rules.listItems, ...['button', 'textBox', 'list'].map((key) => rules.summary.counts[key as 'button'])];
  for (const [one, many] of pairs) {
    expect(one).toEqual(nonEmptyString);
    expect(many).toContain('{n}');
  }
});

test('the summary names the app', () => {
  expect(typeof rules.summary.enabled).toBe('boolean');
  expect(rules.summary.opening).toContain('{app}');
});

test('skip settings have the right types', () => {
  expect(typeof rules.skipUnlabelledButtons).toBe('boolean');
  expect(typeof rules.stopWhenScreenChanges).toBe('boolean');
  rules.skipApps.forEach((app) => expect(app).toMatch(/^[a-z][\w.]+$/)); // Android app ids like com.android.systemui
});
