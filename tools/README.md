# tools — measuring the judge

Scripts for deciding whether a change to how letters are judged (`engine.js`)
is better or worse, on synthetic child handwriting and on her own stored
attempts. They are not tests: they print numbers to compare, build against build.
The suite in `test/` sets the floors; these show what moved.

| Script | What it answers | b9 result |
|---|---|---|
| `her-log.py [day]` | downloads her record from the sync service (read only) to `~/.cache/pisz/her-log.json` and prints one day's rows, without strokes | — |
| `her-log.py --marks [N] [day]` | his 🐞 marks (two quick taps on ⚙️, one in 10 s at most): what was on her screen, her last 20 lines, the judge's last word and the voice at that second, with the rows around each; a day limits them to it | — |
| `rejudge.cjs <engine> [engine]` | her stored copy, memory and name attempts judged again with the app's own rivals: where two engines disagree (one engine: where it differs from the verdict she got, which mixes in every build since) | b8 → b9: 3 of 83 |
| `sweep-unfinished.mjs [root]` | every letter with a line left out or stopped at its last corner — how often it still passes | 9 of 984 |
| `levels.mjs [root]` | whole letters and shapes, moderate and heavy wobble, at every level: passed, called unfinished, taken for another letter | heavy letters 255 / 247 / 215 of 276 |
| `timing.mjs [root]` | how long one verdict takes in node | ~30 ms |

`root` defaults to this repo. To compare with the live build, check master
out into a second worktree and run the script on both roots — or for
`rejudge.cjs`, `git show master:engine.js > /tmp/engine-master.js` and pass both.

**Trying a setting without editing:** every script merges `TUNE` from the
environment into `P.TUNE`, e.g. `TUNE='{"reach":26}' node tools/levels.mjs`.
`rejudge.cjs` applies it to the last engine only, so
`TUNE='{"reach":26}' node tools/rejudge.cjs engine.js engine.js` compares the
setting against the build as it is (3 of her 83 attempts change at 26).

**Her record stays out of every git checkout.** `her-log.py` refuses any path
in this repo or its worktrees, ignored or not (`serve.py` serves the whole
folder), and any path in another checkout unless that checkout ignores it;
it refuses when git cannot tell. Neither tool prints her strokes,
her name (a letter of her name prints as "(name)") or the sentences the app
said (they can hold her name). Her key is read from
`~/priv/litery/sync/key.txt` (or `$PISZ_KEY_FILE`) and never printed.
