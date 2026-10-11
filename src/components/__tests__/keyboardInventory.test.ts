/**
 * Inventory guard: every screen with a text input renders inside the shared
 * `KeyboardAwareScreen`, and nothing else keeps its own ad-hoc
 * `KeyboardAvoidingView`. A new screen that renders a `TextField` must be
 * added to the list below (and wrapped), or this fails.
 */
// No Node typings in this RN project, so the built-ins come via Jest. Jest runs
// from the repo root.
const fs = jest.requireActual('fs') as {
  readdirSync(dir: string, opts: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
  readFileSync(file: string, enc: 'utf8'): string;
};

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : sourceFiles(path);
    }
    return /\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name) ? [path] : [];
  });
}
const read = (path: string): string => fs.readFileSync(path, 'utf8');

/** Screens that contain (directly or through a shared input component) a text input. */
const INPUT_SCREENS = [
  'src/screens/LoginScreen.tsx',
  'src/screens/RegisterScreen.tsx',
  'src/screens/VerifyScreen.tsx',
  'src/screens/ForgotPasswordScreen.tsx',
  'src/screens/CreateGameScreen.tsx',
  'src/screens/CreateGroupScreen.tsx',
  'src/screens/EventDetailScreen.tsx',
  'src/screens/GroupDetailScreen.tsx',
  'src/screens/ProfileScreen.tsx',
  'src/components/onboarding/MobileNumberStep.tsx',
];

/** Components that render inputs but are always placed inside one of the screens above. */
const SHARED_INPUT_COMPONENTS = [
  'src/components/TextField.tsx',
  'src/components/MobileNumberInput.tsx',
  'src/components/MobileNumberCard.tsx',
  'src/components/UserSearchPicker.tsx',
];

const files = sourceFiles('src');

it.each(INPUT_SCREENS)('%s renders inside KeyboardAwareScreen', path => {
  expect(read(path)).toContain('<KeyboardAwareScreen');
});

it('every file that renders a TextField is a listed screen or a listed shared input component', () => {
  const rendering = files.filter(path => /<TextField\b/.test(read(path)));
  const allowed = new Set([...INPUT_SCREENS, ...SHARED_INPUT_COMPONENTS]);
  expect(rendering.filter(path => !allowed.has(path))).toEqual([]);
});

it('only KeyboardAwareScreen uses KeyboardAvoidingView', () => {
  const users = files.filter(path => /KeyboardAvoidingView/.test(read(path)));
  expect(users).toEqual(['src/components/KeyboardAwareScreen.tsx']);
});

it('only TextField renders a bare TextInput', () => {
  const users = files.filter(path => /(^|\n)\s*<TextInput\b/.test(read(path)));
  expect(users).toEqual(['src/components/TextField.tsx']);
});
