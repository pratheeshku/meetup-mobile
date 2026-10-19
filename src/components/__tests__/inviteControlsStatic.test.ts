/**
 * Static check (test 51, AD-19): no per-person or per-group "Invite" TEXT button is drawn
 * outside the shared component (src/components/AddRemoveControl.tsx).
 *
 * The invite label keys below may appear only as (a) an accessibility label, (b) a prop of the
 * shared entry controls (AddEntryRow / AddEntryButton), or (c) a form title Text styled
 * `formTitle`. Any other use (a Button/TextLink/Pressable label or text) fails. Exceptions are
 * listed in docs/reports/ui-mobile-report.md; there are none in this list.
 */
import ts from 'typescript';

// No Node typings in this RN project, so the built-ins come via Jest. Jest runs from the repo root.
const fs = jest.requireActual('fs') as {
  readdirSync(dir: string, opts: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
  readFileSync(file: string, enc: 'utf8'): string;
};

const SRC = 'src';
const SHARED = 'src/components/AddRemoveControl.tsx';

/** Label keys whose text is "Invite ..." on a per-person or per-group control. */
const INVITE_KEYS = new Set([
  'mob.user_search.invite_button',
  'mob.group_detail.invite',
  'mob.game_detail.invite_group',
  'mob.game_detail.invite_player',
]);
const ALLOWED_ELEMENTS = new Set(['AddEntryRow', 'AddEntryButton']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      walk(full, out);
    } else if (/\.tsx$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function jsxTagOf(node: ts.Node): ts.JsxOpeningLikeElement | undefined {
  let cur: ts.Node | undefined = node;
  while (cur) {
    if (ts.isJsxSelfClosingElement(cur)) return cur;
    if (ts.isJsxElement(cur)) return cur.openingElement;
    cur = cur.parent;
  }
  return undefined;
}

function violationsIn(file: string, text: string): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 't' &&
      node.arguments.length > 0 &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      INVITE_KEYS.has(node.arguments[0].text)
    ) {
      const key = node.arguments[0].text;
      const where = `${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${key}`;
      // Inside a JSX attribute?
      let attr: ts.Node | undefined = node.parent;
      while (attr && !ts.isJsxAttribute(attr) && !ts.isJsxElement(attr) && !ts.isJsxSelfClosingElement(attr)) {
        attr = attr.parent;
      }
      if (attr && ts.isJsxAttribute(attr)) {
        const tag = (attr.parent.parent as ts.JsxOpeningLikeElement).tagName.getText();
        if (attr.name.getText() === 'accessibilityLabel' || ALLOWED_ELEMENTS.has(tag)) {
          return;
        }
        found.push(`${where}: attribute ${attr.name.getText()} on <${tag}>`);
        return;
      }
      // Child text of an element: only a form title is allowed.
      const tag = jsxTagOf(node);
      const styleOk = tag?.attributes.properties.some(
        p => ts.isJsxAttribute(p) && p.name.getText() === 'style' && /formTitle/.test(p.getText()),
      );
      if (!(tag && tag.tagName.getText() === 'Text' && styleOk)) {
        found.push(`${where}: child text of <${tag?.tagName.getText() ?? 'unknown'}>`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const violations = (file: string): string[] => violationsIn(file, fs.readFileSync(file, 'utf8'));

describe('invite controls (static check)', () => {
  const files = walk(SRC).filter(file => file !== SHARED);

  it('scans the screens and components', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('no per-person or per-group "Invite" text button remains outside the shared component', () => {
    expect(files.flatMap(violations)).toEqual([]);
  });

  it('the detector catches a text button (guards the check itself)', () => {
    const bad = `const a = <Button label={t('mob.user_search.invite_button')} onPress={f} />;`;
    const ok = `const a = <Pressable accessibilityLabel={t('mob.game_detail.invite_group')} />;`;
    const title = `const a = <Text style={styles.formTitle}>{t('mob.game_detail.invite_group')}</Text>;`;
    expect(violationsIn('x.tsx', bad)).toHaveLength(1);
    expect(violationsIn('x.tsx', ok)).toEqual([]);
    expect(violationsIn('x.tsx', title)).toEqual([]);
  });
});
