/**
 * Static check (test 51, AD-19, tl-c-mobile PR 3): a drawn "+" or "-" glyph (PlusIcon / MinusIcon
 * imports, or a Text whose only content is "+" or the minus sign) lives in the shared component
 * (src/components/AddRemoveControl.tsx) or in the exceptions below. Every exception is listed in
 * docs/reports/tl-c-mobile-report.md with its reason; a new file that draws one fails here until it
 * uses the shared component or is added to that list on purpose.
 */
const fs = jest.requireActual('fs') as {
  readdirSync(dir: string, opts: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
  readFileSync(file: string, enc: 'utf8'): string;
};

const SHARED = 'src/components/AddRemoveControl.tsx';

/** file -> why it may draw its own glyph. Not invite controls, or listed open owner questions. */
const EXCEPTIONS: Record<string, string> = {
  'src/components/icons/ActionIcons.tsx': 'defines the glyphs the shared control uses',
  'src/components/invite/InviteCard.tsx':
    'OPEN QUESTION: approved GV-5 board draws a light-blue "+" circle + chevron entry; AD-19 says use the shared entry control',
  'src/components/groups/UndoAddButton.tsx':
    'OPEN QUESTION: undo/revoke of a person already added to a group; AD-19 leaves the revoke control unchanged',
  'src/screens/GroupDetailScreen.tsx':
    'OPEN QUESTION: "+" square that closes the invite panel (plusSquare); AddEntryButton opens it',
  'src/components/NumberField.tsx': 'numeric stepper, not an invite control',
  'src/components/tournament/wizard/parts.tsx': 'numeric count stepper of the wizard boards (players, teams), not an invite control',
  'src/components/HeaderAddButton.tsx': 'screen header "create" action, not an invite control',
  'src/components/home/CreateGameCard.tsx': 'create-game card, not an invite control',
  'src/navigation/CreateTabButton.tsx': 'create tab button, not an invite control',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') {
        walk(full, out);
      }
    } else if (/\.tsx$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** True when the source draws an add/remove glyph itself. */
export function drawsOwnGlyph(text: string): boolean {
  return (
    /\b(PlusIcon|MinusIcon)\b/.test(text) ||
    /<Text[^>]*>\s*[+−–-]\s*<\/Text>/.test(text) ||
    /\bplusSquareText\b/.test(text)
  );
}

describe('AD-19 static check: no screen draws its own "+" or "-" invite glyph', () => {
  const files = walk('src');

  it('detector self-check', () => {
    expect(drawsOwnGlyph('<PlusIcon size={1} />')).toBe(true);
    expect(drawsOwnGlyph("<Text style={s}>+</Text>")).toBe(true);
    expect(drawsOwnGlyph('<Text style={s}>−</Text>')).toBe(true);
    expect(drawsOwnGlyph("<Text>{t('x')}</Text>")).toBe(false);
  });

  it('only the shared control and the listed exceptions draw one', () => {
    const offenders = files.filter(
      file => file !== SHARED && !(file in EXCEPTIONS) && drawsOwnGlyph(fs.readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('every listed exception still exists and still draws a glyph (keep the list honest)', () => {
    Object.keys(EXCEPTIONS).forEach(file => {
      expect(files).toContain(file);
    });
    const stale = Object.keys(EXCEPTIONS).filter(
      file => !drawsOwnGlyph(fs.readFileSync(file, 'utf8')) && !/Icons?\.tsx$/.test(file),
    );
    expect(stale).toEqual([]);
  });
});
