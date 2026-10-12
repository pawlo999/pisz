"""Her Pisz record from the sync service — read only (GET). Saves the full reply
OUTSIDE the repo (her drawings and name must never land in this public repo)
and prints one day's rows in order, without strokes. Never prints the key or
her name: a letter of her name prints as "(name)" (in order they would spell
it) and row texts (x: sentences, reports) are left out, since a sentence the
app said can hold her name.

    python3 tools/her-log.py [YYYY-MM-DD] [--out PATH]

Key: the file named by $PISZ_KEY_FILE, else ~/priv/litery/sync/key.txt.
Default --out: ~/.cache/pisz/her-log.json (the other tools read it from there).
Times are UTC.
"""
import datetime, json, os, subprocess, sys, urllib.parse, urllib.request

args = sys.argv[1:]
out = os.path.expanduser('~/.cache/pisz/her-log.json')
if '--out' in args:
    i = args.index('--out')
    if i + 1 >= len(args):
        sys.exit('--out needs a path')
    out = args[i + 1]
    del args[i:i + 2]
out = os.path.realpath(os.path.expanduser(out))

# refuse anywhere inside the repo — the main checkout and every worktree
# (worktrees live under it), whichever of them this script runs from
here = os.path.dirname(os.path.realpath(__file__))
common = subprocess.run(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'],
                        cwd=here, capture_output=True, text=True).stdout.strip()
roots = {os.path.dirname(os.path.realpath(common))} if common else set()
roots.add(os.path.dirname(here))
for root in roots:
    if out == root or out.startswith(root + os.sep):
        sys.exit('refusing to write her record inside the repo (' + root + '): ' + out)

key_file = os.environ.get('PISZ_KEY_FILE', os.path.expanduser('~/priv/litery/sync/key.txt'))
KEY = open(key_file).read().strip()
req = urllib.request.Request('https://pisz-sync.pawlo999.workers.dev/s/' + urllib.parse.quote(KEY, safe=''),
                             headers={'User-Agent': 'curl/8'})
d = json.loads(urllib.request.urlopen(req, timeout=20).read())
os.makedirs(os.path.dirname(out), exist_ok=True)
json.dump(d, open(out, 'w'))

log = d.get('log', [])
utc = lambda ms: datetime.datetime.fromtimestamp(ms / 1000, datetime.UTC)
print('saved', len(log), 'rows to', out, '| settings', d.get('settings'),
      '| updated', utc(d.get('updated', 0)).strftime('%Y-%m-%d %H:%M UTC'))
days = {}
for r in log:
    k = utc(r['t']).strftime('%Y-%m-%d')
    days[k] = days.get(k, 0) + 1
print('rows per day (UTC):', days)
day = args[0] if args else utc(max((r['t'] for r in log), default=0)).strftime('%Y-%m-%d')
print('---', day, 'UTC')
for r in log:
    t = utc(r['t'])
    if t.strftime('%Y-%m-%d') != day:
        continue
    x = {k: v for k, v in r.items() if k not in ('t', 's', 'x')}
    if r.get('st') == 'N':
        x['g'] = '(name)'
    print(t.strftime('%H:%M:%S'), json.dumps(x, ensure_ascii=False), '| strokes' if r.get('s') else '', '| text' if 'x' in r else '')
