<!-- GENERATED FILE - DO NOT EDIT.
     Source: the fixture corpus under tests/ plus each ADR's MATRIX-SEVERITY table.
     Regenerate: npm run coverage:matrix -->

# Scope-Context Test Matrix

Which structural contexts and file relationships each ADR's fixtures actually
exercise. Occupancy is derived from the fixture corpus; the obligation for each
cell is declared by the ADR that owns it.

| Legend        | Meaning                                                                         |
| ------------- | ------------------------------------------------------------------------------- |
| `ok`          | a fixture occupies this cell                                                    |
| `**MISSING**` | the ADR declared `error` and nothing occupies it                                |
| `warn`        | the ADR declared `warn` and nothing occupies it                                 |
| `-`           | no obligation declared (`off`)                                                  |
| `n/a`         | not derivable yet -- provider-side relationships need the emitting file (#1219) |

## ADR-001

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-004

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

8 linked fixtures with no derivable context:

- `adr-004/register-expression-address-mmio.test.cnx`
- `adr-004/register-imported-bitmap-member.test.cnx`
- `adr-004/register-imported-expression-mmio.test.cnx`
- `adr-004/register-imported-rw.test.cnx`
- `adr-004/register-imported-wo-mmio.test.cnx`
- `bugs/issue-1514-cross-file-bitmap-register/cross-file-bitmap-register-out-of-closure-error.test.cnx`
- `bugs/issue-1514-cross-file-bitmap-register/cross-file-bitmap-register.test.cnx`
- `bugs/issue-2258-register-enum-member/register-enum-member.test.cnx`

## ADR-004 E0870

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-004 E0871

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-004 E0872

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-006

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

4 linked fixtures with no derivable context:

- `bugs/issue-1203-non-addressable-mut-argument/c-pointer-parenthesized.test.cnx`
- `bugs/issue-1203-non-addressable-mut-argument/parenthesized-chain-value.test.cnx`
- `bugs/issue-1203-non-addressable-mut-argument/parenthesized-mut-argument.test.cnx`
- `bugs/issue-1639-one-passing-decision/every-shape.test.cnx`

## ADR-006 E0915

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-007 E0856

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-007 E0858

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-007 E0859

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-007 E0860

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-007 E0861

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-007 E0888

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-007 E0890

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-007 E0920

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-010

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | ok     | ok         | n/a         | n/a        |
| scope method       | -         | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

13 linked fixtures with no derivable context:

- `bugs/issue-1133-guard-collision-diagnostic/guard-collision.test.cnx`
- `bugs/issue-1833-miscased-cnx-extension/miscased-include-error.test.cnx`
- `external-types/external-struct-fields.test.cnx`
- `include/cnx-alternative-error-angle.test.cnx`
- `include/cnx-alternative-error-hpp.test.cnx`
- `include/cnx-alternative-error-quoted.test.cnx`
- `include/cpp-syntax-undeclared.test.cnx`
- `include/cpp-transitive-undeclared.test.cnx`
- `include/cpp-undeclared.test.cnx`
- `include/missing-cnx-include-error.test.cnx`
- `include/self-include-public-scope.test.cnx`
- `preprocessor/include-impl-file-error.test.cnx`
- `regression/issue-332-cnx-struct-pointer.test.cnx`

## ADR-010 E0503

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-010 E0504

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-010 E0506

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-010 E0509

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-010 E0518

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-013

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

4 linked fixtures with no derivable context:

- `bugs/issue-1545-auto-const-one-rule/auto-const-one-rule.test.cnx`
- `bugs/issue-1545-auto-const-one-rule/callback-arity.test.cnx`
- `bugs/issue-1545-auto-const-one-rule/callback-shapes.test.cnx`
- `bugs/issue-1545-auto-const-one-rule/cross-file-callback-const.test.cnx`

## ADR-013 E0432

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-013 E0433

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-013 E0900

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-014

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

10 linked fixtures with no derivable context:

- `adr-014/struct-inferred-every-position.test.cnx`
- `adr-014/struct-literal-argument-by-value-callback.test.cnx`
- `adr-014/struct-literal-argument-included.test.cnx`
- `adr-014/struct-literal-argument-transpile.test.cnx`
- `adr-014/struct-literal-argument.test.cnx`
- `adr-014/struct-literal-for-header.test.cnx`
- `adr-014/struct-literal-positions.test.cnx`
- `bugs/issue-1782-whole-array-assignment/list-assignment.test.cnx`
- `bugs/issue-2157-array-parameter-list/list-argument.test.cnx`
- `bugs/issue-2157-array-parameter-list/ternary-argument.test.cnx`

## ADR-014 E0357

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-014 E0358

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-014 E0508

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-014 E0866

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | ok     | ok         | n/a         | n/a        |
| top-level function | -         | ok     | ok         | n/a         | n/a        |
| scope member       | -         | ok     | ok         | n/a         | n/a        |
| scope method       | -         | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-015 E0433

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-016

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

5 linked fixtures with no derivable context:

- `adr-016/global-outside-scope-imported-error.test.cnx`
- `adr-016/this-outside-scope-imported-error.test.cnx`
- `bugs/issue-1306-nested-scope-diagnostic/cross-file-nested.test.cnx`
- `bugs/issue-1334-scope-declaration-sites/conflict-across-files.test.cnx`
- `scope/nested-scope-error.test.cnx`

## ADR-016 E0381

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-016 E0425

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-016 E0430

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-016 E0431

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-016 E0435

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-016 E0436

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-016 E0437

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-017

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

16 linked fixtures with no derivable context:

- `adr-017/bare-enum-struct-literal-argument.test.cnx`
- `bugs/issue-1531-declaration-rejections/cross-file-enum.test.cnx`
- `bugs/issue-1669-enum-member-values/binary-values.test.cnx`
- `bugs/issue-1669-enum-member-values/cross-file-const.test.cnx`
- `bugs/issue-1669-enum-member-values/decimal-values.test.cnx`
- `bugs/issue-1669-enum-member-values/earlier-members.test.cnx`
- `bugs/issue-1669-enum-member-values/hex-values.test.cnx`
- `bugs/issue-1669-enum-member-values/value-call.test.cnx`
- `bugs/issue-1669-enum-member-values/value-header-macro.test.cnx`
- `bugs/issue-1669-enum-member-values/value-i32-range.test.cnx`
- `bugs/issue-1669-enum-member-values/value-negative-hex.test.cnx`
- `bugs/issue-1669-enum-member-values/value-overflow.test.cnx`
- `bugs/issue-1669-enum-member-values/value-self-later.test.cnx`
- `bugs/issue-1669-enum-member-values/value-variable.test.cnx`
- `bugs/issue-1971-enum-field-zero-enumerator/enum-field-defaults.test.cnx`
- `enum/enum-error-negative.test.cnx`

## ADR-017 E0424

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-017 E0428

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-017 E0434

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-017 E0894

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-017 E0909

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-017 E0910

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-017 E0911

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-017 E0925

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-022

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | -      | -          | n/a         | n/a        |
| top-level function | ok        | -      | -          | n/a         | n/a        |
| scope member       | ok        | -      | -          | n/a         | n/a        |
| scope method       | ok        | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-022 E0701

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-022 E0702

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-022 E0710

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-023 E0603

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-024

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

14 linked fixtures with no derivable context:

- `bugs/issue-1268-qualified-zero-const/float-cast-bit-width.test.cnx`
- `bugs/issue-1268-qualified-zero-const/float-cast-const-dimension.test.cnx`
- `bugs/issue-1268-qualified-zero-const/float-cast-dimension.test.cnx`
- `bugs/issue-1268-qualified-zero-const/float-cast-enum.test.cnx`
- `bugs/issue-1268-qualified-zero-const/float-cast-imported.test.cnx`
- `bugs/issue-1668-c-integers/subscript-cpp.test.cnx`
- `bugs/issue-1668-c-integers/subscript.test.cnx`
- `bugs/issue-1668-c-integers/unknown-width.test.cnx`
- `bugs/issue-1668-c-integers/width.test.cnx`
- `bugs/issue-1668-suffixed-literals/width.test.cnx`
- `bugs/issue-1688-float-macro/char-macro-controls.test.cnx`
- `bugs/issue-1688-float-macro/macro-controls.test.cnx`
- `bugs/issue-1688-float-macro/per-file-macros.test.cnx`
- `bugs/issue-1688-float-macro/unreadable-macro-cast.test.cnx`

## ADR-024 E0810

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-024 E0811

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-024 E0812

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-024 E0854

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-024 E0868

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-024 E0869

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-024 E0873

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-024 E0891

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-024 E0910

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | ok     | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-025

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

1 linked fixture with no derivable context:

- `bugs/issue-2052-scope-enum-case-label/scope-enum-case-label.test.cnx`

## ADR-025 E0711

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-025 E0712

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-025 E0713

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-025 E0714

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-025 E0717

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-026 E0703

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-029

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

20 linked fixtures with no derivable context:

- `adr-029/callback-assign.test.cnx`
- `adr-029/callback-basic.test.cnx`
- `adr-029/callback-multi-param.test.cnx`
- `adr-029/callback-param-types.test.cnx`
- `adr-029/callback-return-types.test.cnx`
- `adr-029/callback-struct-member.test.cnx`
- `bugs/issue-1283-adr029-init-at-declaration/callback-array-field.test.cnx`
- `bugs/issue-1283-adr029-init-at-declaration/every-position.test.cnx`
- `bugs/issue-1283-adr029-init-at-declaration/macro-sized-callback-array.test.cnx`
- `bugs/issue-1283-adr029-init-at-declaration/nested-struct-field.test.cnx`
- `bugs/issue-1491-cross-file-function-as-type/cross-file-callback.test.cnx`
- `bugs/issue-1491-cross-file-function-as-type/cross-file-string-param.test.cnx`
- `bugs/issue-1491-duplicate-typedef/two-consumers.test.cnx`
- `bugs/issue-1544-cross-file-callback/cross-file-callback.test.cnx`
- `bugs/issue-1552-cross-file-typedef-const/cross-file-typedef-const.test.cnx`
- `bugs/issue-1562-fn-type-variable-header/cross-file-fn-type-variable.test.cnx`
- `bugs/issue-1562-fn-type-variable-header/fn-type-variable.test.cnx`
- `bugs/issue-1566-struct-init-all-fields/struct-init-all-fields.test.cnx`
- `bugs/issue-1568-init-designated-position/init-designated-position.test.cnx`
- `bugs/issue-2157-array-parameter-list/chained-call.test.cnx`

## ADR-029 E0879

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-029 E0880

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-030

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | warn      | warn   | warn       | n/a         | n/a        |
| top-level function | ok        | warn   | warn       | n/a         | n/a        |
| scope member       | ok        | warn   | warn       | n/a         | n/a        |
| scope method       | ok        | warn   | warn       | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

21 linked fixtures with no derivable context:

- `bugs/issue-1312-undefined-type-position/order-consumer-first.test.cnx`
- `bugs/issue-1312-undefined-type-position/order-lib-first.test.cnx`
- `bugs/issue-1312-undefined-type-position/transitive-type-resolves.test.cnx`
- `bugs/issue-1312-undefined-type-position/undefined-type-sibling.test.cnx`
- `bugs/issue-1353-undeclared-value-position/declared-value-resolves.test.cnx`
- `bugs/issue-1353-undeclared-value-position/macro-through-cnx-include.test.cnx`
- `bugs/issue-1353-undeclared-value-position/undeclared-value-sibling-consumer-first.test.cnx`
- `bugs/issue-1353-undeclared-value-position/undeclared-value-sibling-source-first.test.cnx`
- `bugs/issue-1430-e0427-order-dependence/consumer-first.test.cnx`
- `bugs/issue-1430-e0427-order-dependence/source-first.test.cnx`
- `bugs/issue-1582-undeclared-write-target/shadowed-write-resolves.test.cnx`
- `bugs/issue-1582-undeclared-write-target/undeclared-write-sibling-consumer-first.test.cnx`
- `bugs/issue-1582-undeclared-write-target/undeclared-write-sibling-source-first.test.cnx`
- `bugs/issue-1643-self-referential-initializer/member-above-global-array.test.cnx`
- `bugs/issue-1643-self-referential-initializer/member-above-global-private.test.cnx`
- `bugs/issue-1643-self-referential-initializer/member-above-global.test.cnx`
- `bugs/issue-1643-self-referential-initializer/outer-bare-name.test.cnx`
- `bugs/issue-1643-self-referential-initializer/shadow-enclosing-local.test.cnx`
- `bugs/issue-1866-scope-member-is-not-external/included-member-from-reopened-scope.test.cnx`
- `bugs/issue-1953-block-shadow-rename-ends/block-shadow-constructor-reads-outer.test.cnx`
- `bugs/issue-2019-header-unclosed-name/declared-elsewhere.test.cnx`

## ADR-030 E0422

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-030 E0423

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-030 E0426

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-030 E0427

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-030 E0433

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-034

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

3 linked fixtures with no derivable context:

- `bitmap/bitmap-error-bits.test.cnx`
- `bugs/issue-1531-declaration-rejections/cross-file-bitmap.test.cnx`
- `bugs/issue-2251-bitmap-field-bit-index/field-bit-index-register.test.cnx`

## ADR-034 E0857

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-034 E0881

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-034 E0882

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-034 E0883

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-034 E0893

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-034 E0921

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-035

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

3 linked fixtures with no derivable context:

- `adr-035/empty-dimension-included.test.cnx`
- `adr-035/inferred-size-render.test.cnx`
- `bugs/issue-2110-nested-fill-all/nested-fill.test.cnx`

## ADR-035 E0866

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-035 E0876

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-035 E0892

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-036

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-036 E0854

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-036 E0874

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-036 E0875

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-036 E0909

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-036 E0910

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-036 E0917

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-037

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

6 linked fixtures with no derivable context:

- `adr-037/conditional-compilation.test.cnx`
- `adr-037/define-every-rejected-form-error.test.cnx`
- `adr-037/flag-define-valid.test.cnx`
- `adr-037/function-macro-error.test.cnx`
- `adr-037/nested-ifdef.test.cnx`
- `adr-037/value-define-error.test.cnx`

## ADR-037 E0501

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-037 E0502

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-044

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | warn       | n/a         | n/a        |
| top-level function | ok        | ok     | warn       | n/a         | n/a        |
| scope member       | ok        | ok     | warn       | n/a         | n/a        |
| scope method       | ok        | ok     | warn       | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

1 linked fixture with no derivable context:

- `bugs/issue-1669-enum-member-values/value-overflow.test.cnx`

## ADR-044 E0909

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-044 E0910

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-044 E0912

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-045 E0427

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-045 E0862

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-045 E0863

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-045 E0864

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-045 E0865

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-045 E0866

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-045 E0887

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-045 string-copy

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-049

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-049 E0510

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-049 E0511

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-049 E0512

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-049 E0513

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-049 E0514

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-049 E0515

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-049 E0862

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-049 E0889

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-049 E0898

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-049 E0899

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | -      | -          | n/a         | n/a        |
| scope member       | ok        | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-049 E0919

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-050 E0853

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-051

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

1 linked fixture with no derivable context:

- `bugs/issue-1175-constant-dimensions/enum-zero-divisor.test.cnx`

## ADR-051 E0426

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-051 E0800

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-051 E0802

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-051 E0884

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-051 E0885

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-057

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | warn      | warn   | warn       | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

15 linked fixtures with no derivable context:

- `adr-057/local-shadows-scope.test.cnx`
- `adr-057/scope-variable-does-not-capture-type.test.cnx`
- `adr-057/shadowing-all-levels.test.cnx`
- `bugs/issue-1472-global-qualifier-register-capture/global-vs-scoped-bitmap.test.cnx`
- `bugs/issue-1629-case-label-undeclared/case-label-imported-direct.test.cnx`
- `bugs/issue-1629-case-label-undeclared/case-label-rooted-resolves.test.cnx`
- `bugs/issue-1643-self-referential-initializer/member-above-global.test.cnx`
- `bugs/issue-1650-strlen-cache-scope-member/strlen-cache-array-element.test.cnx`
- `bugs/issue-1724-sibling-scope-type-not-included/frames-see-own-closure-error.test.cnx`
- `bugs/issue-1724-sibling-scope-type-not-included/motor-uses-ext-alone.test.cnx`
- `bugs/issue-1724-sibling-scope-type-not-included/sibling-declared-first.test.cnx`
- `bugs/issue-1724-sibling-scope-type-not-included/sibling-declared-second.test.cnx`
- `bugs/issue-1724-sibling-scope-type-not-included/typer-sees-own-closure-error.test.cnx`
- `bugs/issue-1740-reopened-scope-this-call/this-call-across-files.test.cnx`
- `bugs/issue-2004-initialization-binds-through-1-4/for-variable-read.test.cnx`

## ADR-057 E0381

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-057 E0422

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | ok     | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-057 E0425

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-058

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

11 linked fixtures with no derivable context:

- `adr-058/kinds-contexts.test.cnx`
- `adr-058/kinds-header.test.cnx`
- `adr-058/kinds-memory-dimension-error.test.cnx`
- `adr-058/kinds-memory-dimension.test.cnx`
- `adr-058/kinds-memory-row.test.cnx`
- `adr-058/kinds-type-row.test.cnx`
- `adr-058/kinds-value-row.test.cnx`
- `adr-058/length-property-enum-and-bitmap.test.cnx`
- `adr-058/length-property-struct.test.cnx`
- `adr-058/slice-length-byte-length.test.cnx`
- `bugs/issue-1975-type-length-across-includes/type-length-across-includes.test.cnx`

## ADR-058 E0800

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-058 E0867

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-058 E0886

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-058 E0897

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-058 E0909

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-064

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

1 linked fixture with no derivable context:

- `bugs/issue-2254-volatile-not-inlined/volatile-read-not-inlined.test.cnx`

## ADR-064 E0909

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-068

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

1 linked fixture with no derivable context:

- `adr-068/forever-basic.test.cnx`

## ADR-068 E0705

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-068 E0707

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-068 E0715

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-070 E0708

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-071

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

11 linked fixtures with no derivable context:

- `adr-071/c-callback-mut-match.test.cnx`
- `adr-071/callback-initializer-wiring.test.cnx`
- `adr-071/const-keyword-imported-error.test.cnx`
- `adr-071/cpp-constructed-member.test.cnx`
- `adr-071/cpp-method-receiver.test.cnx`
- `adr-071/cpp-opaque-handle-global.test.cnx`
- `adr-071/isr-callback-typedef.test.cnx`
- `adr-071/mut-scalar-parameters.test.cnx`
- `adr-071/mut-signature-follows-declaration.test.cnx`
- `adr-071/opaque-handle-copy.test.cnx`
- `adr-071/read-only-by-default.test.cnx`

## ADR-071 E0879

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-071 E0896

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | -      | -          | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-071 E0898

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | -         | -      | -          | n/a         | n/a        |

## ADR-071 E0899

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## ADR-071 E0900

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
| for header         | ok        | ok     | ok         | n/a         | n/a        |

## Positions

Which part of its statement each code's diagnostics land in, for a code whose
ADR declares a position table.

### ADR-024 E0868

| Position                  | Severity | Fixtures |
| ------------------------- | -------- | -------- |
| declaration initializer   | error    | ok (11)  |
| assignment                | error    | ok (3)   |
| array element assignment  | error    | ok (1)   |
| struct field assignment   | error    | ok (1)   |
| compound assignment       | error    | ok (2)   |
| return statement          | error    | ok (1)   |
| call argument             | error    | ok (2)   |
| array element initializer | error    | ok (1)   |
| struct field initializer  | error    | ok (2)   |
| ternary branch            | error    | ok (1)   |

### ADR-024 E0869

| Position                  | Severity | Fixtures |
| ------------------------- | -------- | -------- |
| declaration initializer   | error    | ok (18)  |
| assignment                | error    | ok (2)   |
| array element assignment  | error    | ok (1)   |
| struct field assignment   | error    | ok (2)   |
| compound assignment       | error    | ok (4)   |
| return statement          | error    | ok (6)   |
| call argument             | error    | ok (6)   |
| array element initializer | error    | ok (5)   |
| struct field initializer  | error    | ok (5)   |
| ternary branch            | error    | ok (5)   |
