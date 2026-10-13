"""Her Pisz record from the sync service — read only (GET). Saves the full reply
OUTSIDE any git checkout (her drawings and name must never land in a public
repo) and prints one day's rows in order, without strokes. Never prints the
key or her name: a letter of her name prints as "(name)" (in order they would
spell it), row texts (x: sentences, reports) are left out, and in a 🐞 mark
her name, as a whole word, prints as "(name)".

    python3 tools/her-log.py [YYYY-MM-DD] [--out PATH]
    python3 tools/her-log.py --marks [N] [YYYY-MM-DD] [--out PATH]
        his 🐞 marks (two quick taps on ⚙️; the last N, default 5, of that
        day if one is given), each with the rows around it
    --from PATH   read a reply saved before instead of asking the service

Key: the file named by $PISZ_KEY_FILE, else ~/priv/litery/sync/key.txt.
Default --out: ~/.cache/pisz/her-log.json (the other tools read it from there).
Times are UTC. A reply with no rows at all (a wrong or changed key gets an
empty record) keeps the copy saved before and exits with an error.
"""
import datetime, json, os, re, subprocess, sys, urllib.parse, urllib.request


def refuse_inside_a_checkout(out):
    """Her record must never land where git could pick it up or a test
    server could serve it: refuse any path under the checkout this script
    lives in (ignored or not — serve.py serves the whole folder), and any
    path inside another git checkout unless that checkout ignores it. Fails
    closed: if git cannot say, nothing is written. The same guard sits in
    pisz/tools/her-log.py and litery/tools/her-log.py — change both (their
    tests compare the two)."""
    env = dict(os.environ, LC_ALL='C', LANGUAGE='')
    here = os.path.dirname(os.path.realpath(__file__))
    own = subprocess.run(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir', '--show-toplevel'],
                         cwd=here, capture_output=True, text=True, env=env)
    if own.returncode != 0:
        sys.exit('cannot tell which checkout this script is in (%s) — refusing' % own.stderr.strip())
    common, top = own.stdout.split('\n')[:2]
    for root in {os.path.dirname(os.path.realpath(common)), os.path.realpath(top)}:
        if out == root or out.startswith(root + os.sep):
            sys.exit('refusing to write her record inside this repo (%s): %s' % (root, out))
    probe = out
    while not os.path.isdir(probe):
        parent = os.path.dirname(probe)
        if parent == probe:
            break
        probe = parent
    other = subprocess.run(['git', 'rev-parse', '--show-toplevel'], cwd=probe, capture_output=True, text=True, env=env)
    if other.returncode != 0:
        if 'not a git repository' in other.stderr:
            return
        sys.exit('cannot tell whether %s is inside a git checkout (%s) — refusing' % (out, other.stderr.strip()))
    ignored = subprocess.run(['git', 'check-ignore', '-q', out], cwd=probe, capture_output=True, text=True, env=env)
    if ignored.returncode == 0:
        return
    sys.exit('refusing to write her record inside the git checkout %s (not ignored there): %s' % (other.stdout.strip(), out))


def save_outside(out, data):
    """write through a temporary file of its own beside `out`, which the guard
    checks too, then move it into place"""
    import tempfile
    os.makedirs(os.path.dirname(out), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(out), prefix='.' + os.path.basename(out) + '.', suffix='.json')
    try:
        refuse_inside_a_checkout(tmp)
        with os.fdopen(fd, 'w') as f:
            json.dump(data, f)
        os.replace(tmp, out)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)
# --- end of the part shared by pisz/tools/her-log.py and litery/tools/her-log.py ---


# the arguments first: nothing is fetched for a typo
args = sys.argv[1:]
marks_n = None
if '--marks' in args:
    i = args.index('--marks')
    has_n = i + 1 < len(args) and args[i + 1].isdigit()
    marks_n = int(args[i + 1]) if has_n else 5
    del args[i:i + (2 if has_n else 1)]
src = None
if '--from' in args:
    i = args.index('--from')
    if i + 1 >= len(args):
        sys.exit('--from needs a path')
    src = args[i + 1]
    del args[i:i + 2]
out = os.path.expanduser('~/.cache/pisz/her-log.json')
if '--out' in args:
    i = args.index('--out')
    if i + 1 >= len(args):
        sys.exit('--out needs a path')
    out = args[i + 1]
    del args[i:i + 2]
bad = [a for a in args if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', a)]
if bad or len(args) > 1:
    sys.exit(__doc__.strip().split('\n\n')[1] + '\n(day as YYYY-MM-DD; not understood: ' + ' '.join(bad or args[1:]) + ')')
out = os.path.realpath(os.path.expanduser(out))
if src:
    d = json.load(open(os.path.expanduser(src)))
    log = d.get('log', [])
    out = os.path.realpath(os.path.expanduser(src))
else:
    refuse_inside_a_checkout(out)
    key_file = os.environ.get('PISZ_KEY_FILE', os.path.expanduser('~/priv/litery/sync/key.txt'))
    KEY = open(key_file).read().strip()
    req = urllib.request.Request('https://pisz-sync.pawlo999.workers.dev/s/' + urllib.parse.quote(KEY, safe=''),
                                 headers={'User-Agent': 'curl/8'})
    d = json.loads(urllib.request.urlopen(req, timeout=20).read())
    log = d.get('log', [])
    if not log:
        sys.exit('the service has no rows under this key (a wrong or changed key gets an empty record) — %s left as it was' % out)
    save_outside(out, d)

utc = lambda ms: datetime.datetime.fromtimestamp(ms / 1000, datetime.UTC)
name = d.get('name') if isinstance(d.get('name'), str) else ''
whole = re.compile(r'(?<!\w)' + re.escape(name) + r'(?!\w)', re.I) if name else None
def masked(v):
    """her name, as a whole word in any value, becomes (name); keys are left alone"""
    if isinstance(v, str):
        return whole.sub('(name)', v) if whole else v
    if isinstance(v, dict):
        return {k: masked(x) for k, x in v.items()}
    if isinstance(v, list):
        return [masked(x) for x in v]
    return v

def show(r):
    """one row, never her strokes, sentences or name"""
    t = utc(r['t'])
    if r.get('k') == 'B':
        try:
            m = json.loads(r.get('x') or '{}')
        except ValueError:
            m = {}
        if not isinstance(m, dict):
            m = {}
        v = masked(m.get('voice') or {}) if isinstance(m.get('voice'), dict) else {}
        if m.get('name'):
            # during her name the voice says its letters one by one: not printed
            v = {k: '(during her name)' for k in ('live', 'queue', 'last')} | {'speaking': v.get('speaking')}
        what = {k: m.get(k) for k in ('scr', 'item', 'st', 'g', 'si', 'steps', 'ready', 'watch', 'intro', 'drawing',
                                      'tries', 'helped', 'overlay', 'last', 'tracer', 'view', 'b') if m.get(k) is not None}
        if m.get('name'):
            what['item'] = what['g'] = '(name)'
        what['lines'] = len(m.get('ink') or [])
        print(t.strftime('%H:%M:%S'), '🐞 MARK' + (' (test run)' if r.get('p') else ''), json.dumps(masked(what), ensure_ascii=False))
        print('          voice: speaking', v.get('speaking'), '| now', json.dumps(v.get('live'), ensure_ascii=False),
              '| waiting', json.dumps(v.get('queue'), ensure_ascii=False), '| last', json.dumps(v.get('last'), ensure_ascii=False))
        return
    x = {k: v for k, v in r.items() if k not in ('t', 's', 'x')}
    if r.get('st') == 'N':
        x['g'] = '(name)'
    if r.get('k') == 'Z':
        x['x'] = '(name)' if r.get('q') == 'N' else r.get('x')
    print(t.strftime('%H:%M:%S'), json.dumps(x, ensure_ascii=False), '| strokes' if r.get('s') else '', '| text' if 'x' in r else '')

print('read' if src else 'saved', len(log), 'rows', 'from' if src else 'to', out, '| updated', utc(d.get('updated', 0)).strftime('%Y-%m-%d %H:%M UTC'),
      '| settings', json.dumps(masked(d.get('settings')), ensure_ascii=False))
if marks_n is not None:
    on_day = lambda r: not args or utc(r['t']).strftime('%Y-%m-%d') == args[0]
    every = [i for i, r in enumerate(log) if r.get('k') == 'B' and on_day(r)]
    marks = every[-marks_n:] if marks_n else []
    print(len(every), 'marks' + (' on ' + args[0] if args else ' in her record') + '; showing', len(marks))
    for i in marks:
        print('===', utc(log[i]['t']).strftime('%Y-%m-%d %H:%M:%S UTC'))
        for r in log[max(0, i - 4):i + 3]:
            show(r)
    sys.exit(0)
days = {}
for r in log:
    k = utc(r['t']).strftime('%Y-%m-%d')
    days[k] = days.get(k, 0) + 1
print('rows per day (UTC):', dict(sorted(days.items())))
day = args[0] if args else utc(max(r['t'] for r in log)).strftime('%Y-%m-%d')
print('---', day, 'UTC')
for r in log:
    if utc(r['t']).strftime('%Y-%m-%d') == day:
        show(r)
