import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = (p) => readFileSync(p, 'utf8');
const ROOT = 'C:/xampp/htdocs/xampp/Capstone Project/QuickWash-Smart-Hub/frontend/';

// Icon-only buttons announce as just "button" without a name. Header and Sidebar
// were the only offenders; Header:330/359 turned out to contain visible text
// and needed nothing.
test('every icon-only button in Header carries an accessible name', () => {
  const text = source(ROOT + 'src/components/Header.tsx');
  const lines = text.split('\n');

  const unnamed = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('<button')) continue;
    const block = lines.slice(i, i + 13).join(' ');
    const close = block.indexOf('</button>');
    const inner = close > 0 ? block.slice(0, close) : block;

    const named =
      /aria-label|aria-labelledby|title=/.test(inner) ||
      inner.replace(/<[^>]*>/g, '').trim().length > 0;

    if (!named) unnamed.push(i + 1);
  }

  assert.deepEqual(unnamed, [], `Header.tsx has unnamed icon buttons at lines ${unnamed.join(', ')}`);
});

test('the mobile nav buttons are labelled in Header and Sidebar', () => {
  assert.match(source(ROOT + 'src/components/Header.tsx'), /aria-label="Open navigation menu"/);
  assert.match(source(ROOT + 'src/components/Sidebar.tsx'), /aria-label="Close navigation menu"/);
});

test('dropdown buttons expose their expanded state', () => {
  const header = source(ROOT + 'src/components/Header.tsx');
  // Three dropdown toggles exist (search, notifications, account).
  const expanded = header.match(/aria-expanded=/g) ?? [];
  assert.equal(expanded.length, 3, 'each dropdown toggle should report aria-expanded');
});

test('the profile photo alt text names the person', () => {
  const profile = source(ROOT + 'src/app/profile/page.tsx');
  assert.doesNotMatch(
    profile,
    /src=\{profile\.avatar_url\}\s*\n\s*alt=""/,
    'alt="" marks the operator photo decorative and hides it from screen readers',
  );
  assert.match(profile, /alt=\{`\$\{profile\.full_name\} profile photo`\}/);
});

test('motion is not a dependency any more', () => {
  const pkg = JSON.parse(source(ROOT + 'package.json'));
  assert.equal(pkg.dependencies.motion, undefined, 'motion was never imported anywhere');
});

test('no source file references motion', () => {
  for (const f of ['src/app/page.tsx', 'src/components/Header.tsx', 'src/app/login/page.tsx']) {
    assert.doesNotMatch(source(ROOT + f), /from 'motion'|from "motion"/, f);
  }
});

test('deps that ARE used are still declared', () => {
  const pkg = JSON.parse(source(ROOT + 'package.json'));
  for (const dep of ['next', 'react', 'react-dom', 'recharts', 'lucide-react', 'exceljs', 'jspdf', 'socket.io-client']) {
    assert.ok(pkg.dependencies[dep], `${dep} is used but not declared`);
  }
});

test('heavy export libraries stay dynamically imported', () => {
  // exceljs is ~900KB. If either becomes a static import it lands in the
  // initial bundle for every page including /login.
  const exp = source(ROOT + 'src/lib/export.ts');
  assert.match(exp, /await import\('exceljs'\)/);
  assert.match(exp, /await import\('jspdf'\)/);
  assert.doesNotMatch(exp, /^import .* from '(exceljs|jspdf)'$/m, 'must not be a top-level import');
});
