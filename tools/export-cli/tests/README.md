# CRE parity tests

The fixture file `cre_fixtures.json` is the contract between
`src/engine/cre.ts` (canonical) and `tools/export-cli/cre.py` (port). Both
test suites load it and assert their `resolve()` output matches every
expected `sourceRect` within `1e-9` per component.

Run the Python side from the repo root:

```
python -m unittest discover tools/export-cli/tests
```

Run the TS side via:

```
npm test
```

Adding new fixture cases is fine; changing existing cases requires
updating both implementations and both test runs in the same commit.
