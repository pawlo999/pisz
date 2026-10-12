// node test/tools.test.mjs — tools/her-log.py keeps her record out of every
// git checkout. Checked before the key is read, so nothing here touches the
// network.
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { c ? (pass++, console.log('  ✓ ' + m)) : (fail++, console.log('  ✗ ' + m + (x ? '   <- ' + x : ''))); };
const tool = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'tools', 'her-log.py');
const repo = path.dirname(path.dirname(tool));
const run = (...a) => spawnSync('python3', [tool, ...a], { encoding: 'utf8', env: { ...process.env, PISZ_KEY_FILE: path.join(os.tmpdir(), 'pisz-no-such-key-' + process.pid) } });
const last = r => r.stderr.trim().split('\n').pop();

console.log('her record stays out of every checkout');
const r1 = run('--out', path.join(repo, 'her.json'));
ok(r1.status !== 0 && /refusing to write her record inside this repo/.test(r1.stderr), 'a path in this checkout is refused', last(r1));
const r2 = run('--out', path.join(repo, 'tools', 'deeper', 'her.json'));
ok(r2.status !== 0 && /refusing/.test(r2.stderr), 'and a folder in it that does not exist yet', last(r2));
const r3 = run('--out', path.join(os.tmpdir(), 'pisz-guard-' + process.pid, 'her.json'));
ok(r3.status !== 0 && /No such file|FileNotFound/.test(r3.stderr) && !/refusing/.test(r3.stderr), 'a path outside any checkout passes the guard (and stops at the missing key)', last(r3));
const other = path.join(os.tmpdir(), 'pisz-guard-repo-' + process.pid);
spawnSync('git', ['init', '-q', other]);
fs.writeFileSync(path.join(other, '.gitignore'), 'private/\n');
const r4 = run('--out', path.join(other, 'her.json'));
ok(r4.status !== 0 && /refusing to write her record inside the git checkout/.test(r4.stderr), 'a path in another checkout is refused (12 Oct review: ~/priv/pisz/her.json was let through)', last(r4));
const r5 = run('--out', path.join(other, 'private', 'her.json'));
ok(r5.status !== 0 && !/refusing/.test(r5.stderr), 'a path another checkout ignores is allowed', last(r5));
const r8 = run('--out', path.join(repo, 'test', 'out', 'her.json'));
ok(r8.status !== 0 && /refusing to write her record inside this repo/.test(r8.stderr), 'but in this repo even an ignored folder is refused (serve.py serves test/out/)', last(r8));
fs.rmSync(other, { recursive: true, force: true });

console.log('\nthe arguments are read before anything is fetched');
const r6 = run('2026-10-7');
ok(r6.status !== 0 && /not understood: 2026-10-7/.test(r6.stderr), 'a day not written YYYY-MM-DD is refused', last(r6));
const r7 = run('--out');
ok(r7.status !== 0 && /--out needs a path/.test(r7.stderr), '--out with no path is refused', last(r7));

console.log('\nwhat --marks prints (a made-up record, read with --from)');
{
  const T0 = Date.UTC(2026, 9, 12, 16), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pisz-marks-'));
  const rec = { name: 'ADA', settings: { lang: 'pl' }, updated: T0 + 9000, log: [
    { t: T0, g: 'A', st: 'N', ok: 1, l: 'pl' },
    { t: T0 + 1000, k: 'B', l: 'pl', x: JSON.stringify({ scr: 'write', item: '(name)', name: 1, st: 'N', g: 'D', ink: [[1, 2, 3, 4]],
      voice: { live: ['d jak dom'], queue: ['clip:A'], last: 'Brawo ADA!', speaking: true } }) },
    { t: T0 + 2000, k: 'B', l: 'pl', p: 1, x: JSON.stringify({ scr: 'write', st: 'C', g: 'T', ink: [], voice: { live: ['Brawo, ada!'], queue: [], last: 'Adam' } }) },
    { t: T0 + 3000, k: 'B', l: 'pl', x: 'null' },
    { t: T0 + 86400000, k: 'B', l: 'pl', x: JSON.stringify({ scr: 'path', voice: {} }) },
  ] };
  const f = path.join(dir, 'rec.json'); fs.writeFileSync(f, JSON.stringify(rec));
  const r = run('--marks', '--from', f), o = r.stdout;
  ok(r.status === 0 && /4 marks in her record; showing 4/.test(o), 'all four marks shown, a broken one too (x: null)', (r.stderr || o).trim().split('\n').slice(-2).join(' | '));
  ok(!/ADA/i.test(o.replace(/Adam/g, '')) && !/d jak dom|clip:A/.test(o), 'her name never printed: not in a sentence, not as the letters of her name step', o);
  ok(/\(during her name\)/.test(o) && /Brawo, \(name\)!/.test(o) && /Adam/.test(o), 'her name as a whole word becomes (name); "Adam" stays', o);
  ok(/\(test run\)/.test(o), 'a mark from a test run says so');
  const d = run('--marks', '2026-10-13', '--from', f);
  ok(/1 marks on 2026-10-13; showing 1/.test(d.stdout), '--marks with a day: that day only', d.stdout.split('\n')[1]);
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\nthe guard is one copy in two repos');
const common = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: repo, encoding: 'utf8' }).stdout.trim();
const twin = path.join(path.dirname(common), '..', 'litery', 'tools', 'her-log.py');
const guardOf = f => (fs.readFileSync(f, 'utf8').match(/^def refuse_inside_a_checkout[\s\S]*?^# --- end of the part shared[^\n]*\n/m) || [''])[0];
if (common && fs.existsSync(twin)) ok(guardOf(tool) && guardOf(tool) === guardOf(twin), 'the guard is the same as in litery/tools/her-log.py', twin);
else console.log('  (no ' + twin + ' yet — the copies are compared once it is on main there)');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
