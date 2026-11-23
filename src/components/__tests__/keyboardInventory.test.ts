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
  // VerifyScreen renders its input through VerificationCodeForm, which owns the KeyboardAwareScreen.
  'src/components/auth/VerificationCodeForm.tsx',
  'src/screens/CompleteAccountScreen.tsx',
  'src/screens/ResetPasswordScreen.tsx',
  'src/screens/TournamentEditScreen.tsx',
  'src/screens/TeamDetailScreen.tsx',
  'src/screens/ForgotPasswordScreen.tsx',
  'src/screens/CreateGameScreen.tsx',
  'src/screens/CreateGroupScreen.tsx',
  'src/screens/EditGroupScreen.tsx',
  'src/screens/EventDetailScreen.tsx',
  'src/screens/GroupDetailScreen.tsx',
  'src/screens/ProfileScreen.tsx',
  'src/components/onboarding/MobileNumberStep.tsx',
  // te-a2: bottom sheets with their own keyboard-aware body
  'src/components/tournament/v2/tabs/ScoreSheet.tsx',
  'src/components/tournament/v2/tabs/CloseSheet.tsx',
];

/** Components that render inputs but are always placed inside one of the screens above. */
const SHARED_INPUT_COMPONENTS = [
  'src/components/TextField.tsx',
  'src/components/MobileNumberInput.tsx',
  'src/components/MobileNumberCard.tsx',
  'src/components/UserSearchPicker.tsx',
  // te-a2: the search box of Participants, inside the version 2 tournament page (a KeyboardAwareScreen)
  'src/components/tournament/v2/tabs/ParticipantsTab.tsx',
  // Form parts and sheets used inside the wrapped create/edit screens above (wizard steps, fees, series, teams).
  'src/components/GameFeeFields.tsx',
  'src/components/RepeatWeeklyControl.tsx',
  'src/components/TeamsDiscoverContent.tsx',
  'src/components/series/SeriesParts.tsx',
  'src/components/tournament/FeeEditSheet.tsx',
  'src/components/tournament/participants/AddTeamSheet.tsx',
  'src/components/tournament/wizard/BasicsStep.tsx',
  'src/components/tournament/wizard/CommitteeStep.tsx',
  'src/components/tournament/wizard/RegistrationStep.tsx',
  'src/components/tournament/wizard/VisibilityStep.tsx',
  'src/components/tournament/wizard/WhenWhereStep.tsx',
];

/**
 * Files that render a bare TextInput besides the TextField primitive: input primitives, pickers and search
 * boxes that already sit inside a KeyboardAwareScreen screen (or a modal), plus the screens that mix several inputs.
 */
const BARE_TEXT_INPUT_FILES = [
  'src/components/GroupMultiSelect.tsx',
  'src/components/NumberField.tsx',
  'src/components/TextField.tsx',
  'src/components/tournament/participants/parts.tsx',
  'src/components/venue/OthersVenueModal.tsx',
  'src/components/venue/VenueDetailCard.tsx',
  'src/components/venue/VenuePicker.tsx',
  'src/screens/AccountDeletionCodeScreen.tsx',
  'src/screens/CreateGameScreen.tsx',
  'src/screens/EditProfileScreen.tsx',
  'src/screens/EventDetailScreen.tsx',
  'src/screens/TransferGroupOwnershipScreen.tsx',
  // priority1-nov23 P1-03: one search box at the top of a list (header of the FlatList); the keyboard never covers it.
  'src/screens/GroupsScreen.tsx',
  'src/screens/StatGamesScreen.tsx',
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

it('only TextField and the listed input primitives render a bare TextInput', () => {
  const users = files.filter(path => /(^|\n)\s*<TextInput\b/.test(read(path)));
  expect(users.sort()).toEqual([...BARE_TEXT_INPUT_FILES].sort());
});
