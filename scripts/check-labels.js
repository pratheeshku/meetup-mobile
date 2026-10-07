#!/usr/bin/env node
/**
 * Label scan (DES-MEETUP-FEEDBACK-001 R-03 / C2.7). CI script, not a test.
 *
 * Fails (exit 1) when it finds:
 *   a. hardcoded customer-facing text in app source (JSX text, customer-facing
 *      props, Alert.alert / toast / snackbar arguments);
 *   b. a label key used in source (t / getLabel / mob.* literal) that has no
 *      entry in the bundled defaults (src/labels/defaultLabels.ts, plus the
 *      pre-existing BASE_LABELS in src/labels/fallbackLabels.ts);
 *   c. a banned glossary term (docs/glossary.json "banned") in a default label value.
 *
 * Exclusions live ONLY in scripts/check-labels.allowlist.json (each with a reason).
 * Uses the TypeScript compiler API already in devDependencies; no new packages.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const GLOSSARY_PATH = path.join(ROOT, 'docs', 'glossary.json');
const ALLOWLIST_PATH = path.join(__dirname, 'check-labels.allowlist.json');
const DEFAULT_LABELS_PATH = path.join(ROOT, 'src', 'labels', 'defaultLabels.ts');
const BASE_LABELS_PATH = path.join(ROOT, 'src', 'labels', 'fallbackLabels.ts');
const SCAN_ROOTS = ['src', 'App.tsx'];

// Props / object keys whose string value is shown to the customer.
const TEXT_PROPS = new Set([
  'title', 'headerTitle', 'tabBarLabel', 'placeholder', 'label',
  'accessibilityLabel', 'accessibilityHint', 'subtitle', 'message', 'description',
]);
// Calls whose string arguments are shown to the customer.
const ALERT_CALLEES = new Set(['Alert.alert']);
const TOAST_CALLEES = new Set([
  'toast', 'Toast.show', 'showToast', 'snackbar', 'showSnackbar', 'Snackbar.show',
  'toast.show', 'toast.error', 'toast.success', 'toast.info',
]);
// Calls whose key argument is checked against the defaults: name -> arg index.
const KEY_CALLEES = { t: 0, currentT: 0, bundledT: 0, getLabel: 1 };
const KEY_LITERAL = /^mob[._]/;

const failures = [];
const used = new Set();

function fail(file, line, kind, message) {
  failures.push({ file, line, kind, message });
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function blocked(msg) {
  console.error(`check-labels: BLOCKED - ${msg}`);
  process.exit(2);
}

if (!fs.existsSync(GLOSSARY_PATH)) {
  blocked('docs/glossary.json is missing. Copy it from the backend; do not edit it.');
}
const glossary = readJson(GLOSSARY_PATH);
if (!Array.isArray(glossary.banned) || glossary.banned.length === 0) {
  blocked('docs/glossary.json has no "banned" list.');
}
const banned = glossary.banned.map(b => ({ term: b.term, use: b.use, re: new RegExp(b.pattern, 'i') }));

const allowlist = readJson(ALLOWLIST_PATH);
const entries = (allowlist.entries || []).map(e => ({ ...e, hits: 0 }));
for (const e of entries) {
  if (!e.reason || !e.kind || !e.file || e.match === undefined) {
    blocked(`allowlist entry needs kind, file, match and reason: ${JSON.stringify(e)}`);
  }
}
const patterns = (allowlist.patterns || []).map(p => {
  if (!p.reason) {
    blocked(`allowlist pattern needs a reason: ${JSON.stringify(p)}`);
  }
  return { ...p, re: new RegExp(p.regex) };
});
const testFiles = (allowlist.testFiles || []).map(p => {
  if (!p.reason) {
    blocked(`allowlist testFiles entry needs a reason: ${JSON.stringify(p)}`);
  }
  return { ...p, re: new RegExp(p.regex) };
});

function allowed(kind, file, text) {
  for (const e of entries) {
    if (e.kind === kind && e.file === file && e.match === text) {
      e.hits += 1;
      return true;
    }
  }
  return false;
}

function parse(file, text) {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
}

function lineOf(sf, node) {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

// Extract the label table from an object literal assigned in a labels file.
function readLabelTable(file, rel) {
  const sf = parse(file, fs.readFileSync(file, 'utf8'));
  const table = [];
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      let init = node.initializer;
      while (ts.isAsExpression(init) || ts.isParenthesizedExpression(init)) {
        init = init.expression;
      }
      if (ts.isObjectLiteralExpression(init) && /^(DEFAULT_LABELS|BASE_LABELS)$/.test(node.name.getText(sf))) {
        for (const prop of init.properties) {
          if (!ts.isPropertyAssignment(prop)) {
            continue;
          }
          const key = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : null;
          const v = prop.initializer;
          if (key !== null && (ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v))) {
            table.push({ key, value: v.text, line: lineOf(sf, prop), file: rel });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return table;
}

const labelRows = [
  ...readLabelTable(DEFAULT_LABELS_PATH, 'src/labels/defaultLabels.ts'),
  ...readLabelTable(BASE_LABELS_PATH, 'src/labels/fallbackLabels.ts'),
];
if (labelRows.length === 0) {
  blocked('found no label entries in src/labels/defaultLabels.ts');
}
const knownKeys = new Set(labelRows.map(r => r.key));

// (c) banned glossary terms in default label values.
for (const row of labelRows) {
  for (const b of banned) {
    if (b.re.test(row.value) && !allowed('banned-term', row.file, `${row.key}`)) {
      fail(row.file, row.line, 'banned-term',
        `label "${row.key}" value "${row.value}" contains banned term "${b.term}" - use ${b.use}`);
    }
  }
}

// Strings that are not human-readable text.
function isCustomerText(text) {
  const stripped = text.replace(/\{\w+\}/g, '');
  if (!/[A-Za-z]/.test(stripped)) {
    return false;
  }
  return !patterns.some(p => p.re.test(text));
}

// Literal text reachable from an expression without passing through a call
// (a call such as t('key') is already label-resolved).
function literalsIn(node, out) {
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)) {
    literalsIn(node.expression, out);
  } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    out.push({ text: node.text, node });
  } else if (ts.isTemplateExpression(node)) {
    const parts = [node.head.text, ...node.templateSpans.map(s => s.literal.text)];
    out.push({ text: parts.join('{}'), node });
  } else if (ts.isConditionalExpression(node)) {
    literalsIn(node.whenTrue, out);
    literalsIn(node.whenFalse, out);
  } else if (ts.isBinaryExpression(node)) {
    const op = node.operatorToken.kind;
    if (op === ts.SyntaxKind.PlusToken) {
      const parts = [];
      literalsIn(node.left, parts);
      literalsIn(node.right, parts);
      out.push(...parts);
    } else if (
      op === ts.SyntaxKind.QuestionQuestionToken ||
      op === ts.SyntaxKind.BarBarToken ||
      op === ts.SyntaxKind.AmpersandAmpersandToken
    ) {
      literalsIn(node.left, out);
      literalsIn(node.right, out);
    }
  }
}

function calleeName(expr) {
  if (ts.isIdentifier(expr)) {
    return expr.text;
  }
  if (ts.isPropertyAccessExpression(expr)) {
    const base = calleeName(expr.expression);
    return base ? `${base}.${expr.name.text}` : null;
  }
  return null;
}

function scanFile(abs) {
  const rel = path.relative(ROOT, abs).split(path.sep).join('/');
  const sf = parse(abs, fs.readFileSync(abs, 'utf8'));

  const report = (node, text, why) => {
    const trimmed = text.replace(/\s+/g, ' ').trim();
    if (!isCustomerText(trimmed) || allowed('hardcoded-string', rel, trimmed)) {
      return;
    }
    fail(rel, lineOf(sf, node), 'hardcoded-string',
      `hardcoded customer-facing text "${trimmed}" (${why}) - move it to a label key in src/labels/defaultLabels.ts`);
  };
  const reportExpr = (expr, why) => {
    const found = [];
    literalsIn(expr, found);
    for (const f of found) {
      report(f.node, f.text, why);
    }
  };

  const visit = node => {
    if (ts.isJsxText(node)) {
      report(node, node.text, 'JSX text');
    } else if (ts.isJsxAttribute(node) && TEXT_PROPS.has(node.name.getText(sf)) && node.initializer) {
      const init = node.initializer;
      if (ts.isStringLiteral(init)) {
        report(init, init.text, `prop ${node.name.getText(sf)}`);
      } else if (ts.isJsxExpression(init) && init.expression) {
        reportExpr(init.expression, `prop ${node.name.getText(sf)}`);
      }
    } else if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
      reportExpr(node.expression, 'JSX child');
    } else if (ts.isPropertyAssignment(node) && TEXT_PROPS.has(node.name.getText(sf).replace(/['"]/g, ''))) {
      reportExpr(node.initializer, `property ${node.name.getText(sf)}`);
    } else if (ts.isCallExpression(node)) {
      const name = calleeName(node.expression);
      if (name && (ALERT_CALLEES.has(name) || TOAST_CALLEES.has(name))) {
        const why = `${name} argument`;
        const scanArg = arg => {
          if (ts.isArrayLiteralExpression(arg)) {
            arg.elements.forEach(scanArg);
          } else if (ts.isObjectLiteralExpression(arg)) {
            for (const p of arg.properties) {
              if (ts.isPropertyAssignment(p) && /^(text|message|title)$/.test(p.name.getText(sf))) {
                reportExpr(p.initializer, why);
              }
            }
          } else {
            reportExpr(arg, why);
          }
        };
        node.arguments.forEach(scanArg);
      }
      const keyIndex = name ? KEY_CALLEES[name] : undefined;
      if (keyIndex !== undefined && node.arguments[keyIndex]) {
        const arg = node.arguments[keyIndex];
        if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
          checkKey(rel, sf, arg, arg.text);
        }
      }
    }
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
        KEY_LITERAL.test(node.text) && !ts.isImportDeclaration(node.parent)) {
      checkKey(rel, sf, node, node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

const reportedKeys = new Set();
function checkKey(rel, sf, node, key) {
  if (knownKeys.has(key) || allowed('unknown-key', rel, key)) {
    return;
  }
  const id = `${rel}:${node.getStart(sf)}`;
  if (reportedKeys.has(id)) {
    return;
  }
  reportedKeys.add(id);
  fail(rel, lineOf(sf, node), 'unknown-key',
    `label key "${key}" has no entry in src/labels/defaultLabels.ts`);
}

function walk(p, acc) {
  const stat = fs.statSync(p);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(p)) {
      walk(path.join(p, name), acc);
    }
  } else if (/\.(ts|tsx)$/.test(p) && !p.endsWith('.d.ts')) {
    acc.push(p);
  }
  return acc;
}

const files = [];
for (const r of SCAN_ROOTS) {
  const abs = path.join(ROOT, r);
  if (fs.existsSync(abs)) {
    walk(abs, files);
  }
}

let scanned = 0;
for (const abs of files.sort()) {
  const rel = path.relative(ROOT, abs).split(path.sep).join('/');
  if (testFiles.some(t => t.re.test(rel))) {
    continue;
  }
  // The label tables themselves are checked by (c), not as UI source.
  if (abs === DEFAULT_LABELS_PATH || abs === BASE_LABELS_PATH) {
    continue;
  }
  scanned += 1;
  scanFile(abs);
}

for (const e of entries) {
  if (e.hits === 0) {
    fail('scripts/check-labels.allowlist.json', 0, 'stale-allowlist',
      `allowlist entry no longer matches anything (${e.kind} in ${e.file}: "${e.match}") - remove it`);
  }
}

if (failures.length > 0) {
  for (const f of failures) {
    console.error(`${f.file}:${f.line}: [${f.kind}] ${f.message}`);
  }
  console.error(`\ncheck-labels: FAILED - ${failures.length} problem(s) in ${scanned} files scanned.`);
  process.exit(1);
}
console.log(`check-labels: OK - ${scanned} files scanned, ${labelRows.length} default labels checked.`);
