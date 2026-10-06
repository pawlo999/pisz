# Pisz

A writing game for a pre-schooler, in Polish and Norwegian. She watches a
letter being drawn, traces it along a road, then over dots, copies it
beside a model, and on a later day writes it from memory, from its word
and picture alone ("_ŁOŃ 🐘"). Shapes first, then capitals, then her name.

**No asset files.** Pictures are emoji, speech is the device's own voice,
sounds are generated. Sibling of [Litery](https://pawlo999.github.io/litery/).

Her name is typed in on the device and stored there. It is not in this
repository, and no progress data is either.

    python3 serve.py 8791          # serve locally (UTF-8 declared)
    node test/engine.test.mjs      # the engine: templates, tracing, judging, pacing
    node test/worker.test.mjs      # the sync worker
    PISZ_URL=http://localhost:8791/ node test/e2e.test.mjs   # the app in WebKit and Chromium

`PLAN.md` has the research behind every rule, the learning model, and
what comes next. `parent.html` shows her progress on any phone, given the
sync key.
