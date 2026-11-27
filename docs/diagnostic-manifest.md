<!-- GENERATED FILE - DO NOT EDIT.
     Source: every .expected.error under tests/.
     Regenerate: npm run diagnostics:manifest -->

# Diagnostic Manifest

Every fixture that asserts a diagnostic, and the codes it asserts. The
manifest exists so that losing an assertion is a reviewable diff rather than
a silent deletion -- `npm run diagnostics:manifest:check` fails when a listed
fixture loses its `.expected.error`, or stops asserting a code listed for it.

The rows are in `docs/diagnostic-manifest/`, one document per fixture
directory: the fixtures of `tests/adr-034/` are listed in
`docs/diagnostic-manifest/tests/adr-034.md`.

Removing a diagnostic on purpose means deleting its row in the same commit.
Adding one, or promoting `(uncoded)` to a real code, is never a loss: regenerate
to record it.

One document per directory, because git cannot order two insertions at one
place. In a single list the rows of two new `tests/bugs/issue-NNNN-*`
directories sort next to each other, so two pull requests that each added one
conflicted (#2518). A new directory is now a new document. For the same reason
no line counts the rows (#2517): the check prints the totals each time it
passes.
