<!-- GENERATED FILE - DO NOT EDIT.
     Source: every .expected.error under tests/.
     Regenerate: npm run diagnostics:manifest -->

# Diagnostic Manifest

Every fixture that asserts a diagnostic, and the codes it asserts. This file
exists so that losing an assertion is a reviewable diff rather than a silent
deletion -- `npm run diagnostics:manifest:check` fails when a listed fixture
loses its `.expected.error`, or stops asserting a code listed here.

Removing a diagnostic on purpose means deleting its row in the same commit.
Adding one, or promoting `(uncoded)` to a real code, never fails the gate.

917 fixture(s) assert a diagnostic; 903 carry a code.

| Fixture                                                                                                   | Codes                             |
| --------------------------------------------------------------------------------------------------------- | --------------------------------- |
| tests/adr-004/register-access-uncovered-arms-error.test.cnx                                               | E0870, E0871, E0872               |
| tests/adr-004/register-for-header-read-wo-error.test.cnx                                                  | E0870                             |
| tests/adr-004/register-imported-bitmap-access-error.test.cnx                                              | E0870, E0871, E0872               |
| tests/adr-004/register-imported-direct-error.test.cnx                                                     | E0870, E0871, E0872               |
| tests/adr-004/register-imported-direct-for-header-error.test.cnx                                          | E0870                             |
| tests/adr-004/register-imported-direct-method-error.test.cnx                                              | E0870, E0871                      |
| tests/adr-004/register-imported-transitive-error.test.cnx                                                 | E0870, E0871, E0872               |
| tests/adr-004/register-imported-transitive-for-header-error.test.cnx                                      | E0870                             |
| tests/adr-004/register-imported-transitive-method-error.test.cnx                                          | E0870, E0871, E0872               |
| tests/adr-004/register-read-wo-error.test.cnx                                                             | E0870                             |
| tests/adr-004/register-wo-set-false-error.test.cnx                                                        | E0872                             |
| tests/adr-004/register-write-ro-error.test.cnx                                                            | E0871                             |
| tests/adr-007/bit-access-imported-direct-error.test.cnx                                                   | E0856, E0888, E0890, E0920        |
| tests/adr-007/bit-access-imported-transitive-error.test.cnx                                               | E0856, E0888, E0890, E0920        |
| tests/adr-007/bit-access-same-file-error.test.cnx                                                         | E0856, E0888, E0890, E0920        |
| tests/adr-007/float-bit-range-field-global-scope-error.test.cnx                                           | E0888                             |
| tests/adr-007/float-bit-range-global-scope-error.test.cnx                                                 | E0888                             |
| tests/adr-007/rmw-side-effect-error.test.cnx                                                              | E0890                             |
| tests/adr-007/rmw-side-effect-imported-error.test.cnx                                                     | E0890                             |
| tests/adr-007/slice-bounds-violation.test.cnx                                                             | E0860                             |
| tests/adr-007/slice-imported-direct-error.test.cnx                                                        | E0860                             |
| tests/adr-007/slice-imported-transitive-error.test.cnx                                                    | E0860                             |
| tests/adr-007/slice-in-scope-method-error.test.cnx                                                        | E0860                             |
| tests/adr-007/slice-length-exceeds-source.test.cnx                                                        | E0861                             |
| tests/adr-007/slice-literal-negative-too-wide.test.cnx                                                    | E0861                             |
| tests/adr-007/slice-literal-too-wide.test.cnx                                                             | E0861                             |
| tests/adr-007/slice-outer-dim-error.test.cnx                                                              | E0858                             |
| tests/adr-007/slice-rules-imported-direct-error.test.cnx                                                  | E0858, E0859, E0860, E0861        |
| tests/adr-007/slice-rules-imported-transitive-error.test.cnx                                              | E0858, E0859, E0860, E0861        |
| tests/adr-007/slice-rules-scope-method-error.test.cnx                                                     | E0858, E0859, E0861               |
| tests/adr-007/slice-runtime-offsets.test.cnx                                                              | E0859                             |
| tests/adr-007/slice-silent-overflow.test.cnx                                                              | E0859                             |
| tests/adr-007/slice-wide-element-span-error.test.cnx                                                      | E0860                             |
| tests/adr-007/slice-zero-length.test.cnx                                                                  | E0860                             |
| tests/adr-007/subscript-depth-scalar-error.test.cnx                                                       | E0856                             |
| tests/adr-007/subscript-depth-this-error.test.cnx                                                         | E0856                             |
| tests/adr-013/const-assign-error.test.cnx                                                                 | E0900                             |
| tests/adr-013/const-bool-assign-error.test.cnx                                                            | E0900                             |
| tests/adr-013/const-bool-param-assign-error.test.cnx                                                      | E0900                             |
| tests/adr-013/const-compound-assign-error.test.cnx                                                        | E0900                             |
| tests/adr-013/const-compound-f32-error.test.cnx                                                           | E0900                             |
| tests/adr-013/const-compound-f64-error.test.cnx                                                           | E0900                             |
| tests/adr-013/const-compound-i16-error.test.cnx                                                           | E0900                             |
| tests/adr-013/const-compound-i64-error.test.cnx                                                           | E0900                             |
| tests/adr-013/const-compound-i8-error.test.cnx                                                            | E0900                             |
| tests/adr-013/const-compound-u16-error.test.cnx                                                           | E0900                             |
| tests/adr-013/const-compound-u64-error.test.cnx                                                           | E0900                             |
| tests/adr-013/const-f32-assign-error.test.cnx                                                             | E0900                             |
| tests/adr-013/const-f32-param-assign-error.test.cnx                                                       | E0900                             |
| tests/adr-013/const-f64-assign-error.test.cnx                                                             | E0900                             |
| tests/adr-013/const-f64-param-assign-error.test.cnx                                                       | E0900                             |
| tests/adr-013/const-i16-assign-error.test.cnx                                                             | E0900                             |
| tests/adr-013/const-i16-param-assign-error.test.cnx                                                       | E0900                             |
| tests/adr-013/const-i64-assign-error.test.cnx                                                             | E0900                             |
| tests/adr-013/const-i64-param-assign-error.test.cnx                                                       | E0900                             |
| tests/adr-013/const-i8-assign-error.test.cnx                                                              | E0900                             |
| tests/adr-013/const-i8-param-assign-error.test.cnx                                                        | E0900                             |
| tests/adr-013/const-imported-direct-error.test.cnx                                                        | E0900                             |
| tests/adr-013/const-imported-transitive-error.test.cnx                                                    | E0900                             |
| tests/adr-013/const-param-assign-error.test.cnx                                                           | E0900                             |
| tests/adr-013/const-u16-assign-error.test.cnx                                                             | E0900                             |
| tests/adr-013/const-u16-param-assign-error.test.cnx                                                       | E0900                             |
| tests/adr-013/const-u64-assign-error.test.cnx                                                             | E0900                             |
| tests/adr-013/const-u64-param-assign-error.test.cnx                                                       | E0900                             |
| tests/adr-013/const-uncovered-arms-error.test.cnx                                                         | E0900                             |
| tests/adr-013/constructor-arg-error.test.cnx                                                              | E0432, E0433                      |
| tests/adr-013/constructor-arg-imported-direct-error.test.cnx                                              | E0432, E0433                      |
| tests/adr-013/constructor-arg-imported-transitive-error.test.cnx                                          | E0432, E0433                      |
| tests/adr-014/cpp-class-direct-error.test.cnx                                                             | E0508                             |
| tests/adr-014/cpp-class-transitive-error.test.cnx                                                         | E0508                             |
| tests/adr-014/struct-init-for-header-direct-error.test.cnx                                                | E0357, E0358                      |
| tests/adr-014/struct-init-for-header-same-file-error.test.cnx                                             | E0357, E0358                      |
| tests/adr-014/struct-init-for-header-transitive-error.test.cnx                                            | E0357, E0358                      |
| tests/adr-014/struct-init-non-struct-direct-error.test.cnx                                                | E0358                             |
| tests/adr-014/struct-init-non-struct-transitive-error.test.cnx                                            | E0358                             |
| tests/adr-014/struct-init-same-file-error.test.cnx                                                        | E0357, E0358                      |
| tests/adr-014/struct-no-type-direct-error.test.cnx                                                        | E0357                             |
| tests/adr-014/struct-no-type-error.test.cnx                                                               | E0357                             |
| tests/adr-014/struct-no-type-transitive-error.test.cnx                                                    | E0357                             |
| tests/adr-014/struct-written-type-direct-error.test.cnx                                                   | (uncoded)                         |
| tests/adr-014/struct-written-type-every-context-error.test.cnx                                            | (uncoded)                         |
| tests/adr-014/struct-written-type-rejected-error.test.cnx                                                 | (uncoded)                         |
| tests/adr-014/struct-written-type-transitive-error.test.cnx                                               | (uncoded)                         |
| tests/adr-014/whole-array-field-direct-error.test.cnx                                                     | E0866                             |
| tests/adr-014/whole-array-field-transitive-error.test.cnx                                                 | E0866                             |
| tests/adr-016/access-rules-imported-direct-error.test.cnx                                                 | E0435, E0436, E0437               |
| tests/adr-016/access-rules-imported-transitive-error.test.cnx                                             | E0435, E0436, E0437               |
| tests/adr-016/access-rules-scope-member-error.test.cnx                                                    | E0435, E0436, E0437               |
| tests/adr-016/cross-scope-bare-error.test.cnx                                                             | E0436                             |
| tests/adr-016/cross-scope-register-bare-error.test.cnx                                                    | E0437                             |
| tests/adr-016/duplicate-definition-imported-direct-error.test.cnx                                         | E0425                             |
| tests/adr-016/duplicate-definition-imported-transitive-error.test.cnx                                     | E0425                             |
| tests/adr-016/duplicate-definition-same-file-error.test.cnx                                               | E0425                             |
| tests/adr-016/for-header-access-rules-imported-direct-error.test.cnx                                      | E0435, E0436, E0437               |
| tests/adr-016/for-header-access-rules-imported-transitive-error.test.cnx                                  | E0435, E0436, E0437               |
| tests/adr-016/for-header-access-rules-same-file-error.test.cnx                                            | E0435, E0436, E0437               |
| tests/adr-016/for-header-this-outside-scope-imported-direct-error.test.cnx                                | E0431                             |
| tests/adr-016/for-header-this-outside-scope-imported-transitive-error.test.cnx                            | E0431                             |
| tests/adr-016/for-header-this-outside-scope-same-file-error.test.cnx                                      | E0431                             |
| tests/adr-016/global-outside-scope-error.test.cnx                                                         | E0431                             |
| tests/adr-016/global-outside-scope-imported-error.test.cnx                                                | E0431                             |
| tests/adr-016/mixed-access-ultimate-error.test.cnx                                                        | E0435, E0436                      |
| tests/adr-016/private-cross-scope-error.test.cnx                                                          | E0436                             |
| tests/adr-016/private-func-access-error.test.cnx                                                          | E0436                             |
| tests/adr-016/private-imported-direct-error.test.cnx                                                      | E0436                             |
| tests/adr-016/private-imported-transitive-error.test.cnx                                                  | E0436                             |
| tests/adr-016/private-scoped-struct-error.test.cnx                                                        | E0436                             |
| tests/adr-016/private-var-access-error.test.cnx                                                           | E0436                             |
| tests/adr-016/qualifier-outside-scope-imported-direct-error.test.cnx                                      | E0431                             |
| tests/adr-016/qualifier-outside-scope-imported-transitive-error.test.cnx                                  | E0431                             |
| tests/adr-016/scope-access-uncovered-arms-error.test.cnx                                                  | E0435, E0436, E0437               |
| tests/adr-016/scope-enum-naming-conflict.test.cnx                                                         | E0437                             |
| tests/adr-016/self-scope-bare-error.test.cnx                                                              | E0435                             |
| tests/adr-016/this-outside-scope-error.test.cnx                                                           | E0431                             |
| tests/adr-016/this-outside-scope-imported-error.test.cnx                                                  | E0431                             |
| tests/adr-017/bare-enum-field-slice-target-error.test.cnx                                                 | E0424                             |
| tests/adr-017/bare-enum-slice-target-error.test.cnx                                                       | E0424                             |
| tests/adr-017/bare-enum-uncovered-arms-error.test.cnx                                                     | E0424                             |
| tests/adr-017/enum-bare-in-array-dim.test.cnx                                                             | E0424                             |
| tests/adr-017/enum-bare-in-comparison.test.cnx                                                            | E0424                             |
| tests/adr-017/enum-bare-in-for-header-imported-direct.test.cnx                                            | E0424                             |
| tests/adr-017/enum-bare-in-for-header-imported-transitive.test.cnx                                        | E0424                             |
| tests/adr-017/enum-bare-in-for-header.test.cnx                                                            | E0424                             |
| tests/adr-017/enum-bare-in-function-arg.test.cnx                                                          | E0424                             |
| tests/adr-017/enum-error-assign-for-header-imported-direct.test.cnx                                       | E0428                             |
| tests/adr-017/enum-error-assign-for-header-imported-transitive.test.cnx                                   | E0428                             |
| tests/adr-017/enum-error-assign-for-header.test.cnx                                                       | E0428                             |
| tests/adr-017/enum-error-assign-int.test.cnx                                                              | E0428                             |
| tests/adr-017/enum-error-assign-non-enum.test.cnx                                                         | E0428                             |
| tests/adr-017/enum-error-assign-wrong-enum.test.cnx                                                       | E0428                             |
| tests/adr-017/enum-error-compare-contexts.test.cnx                                                        | E0434                             |
| tests/adr-017/enum-error-compare-for-header-imported-direct.test.cnx                                      | E0434                             |
| tests/adr-017/enum-error-compare-for-header-imported-transitive.test.cnx                                  | E0434                             |
| tests/adr-017/enum-error-compare-for-header.test.cnx                                                      | E0434                             |
| tests/adr-017/enum-error-compare-imported-direct.test.cnx                                                 | E0434                             |
| tests/adr-017/enum-error-compare-imported-transitive.test.cnx                                             | E0434                             |
| tests/adr-017/enum-error-compare-int.test.cnx                                                             | E0434                             |
| tests/adr-017/enum-error-compare-types.test.cnx                                                           | E0434                             |
| tests/adr-017/enum-error-imported-direct.test.cnx                                                         | E0428, E0434                      |
| tests/adr-017/enum-error-imported-transitive.test.cnx                                                     | E0428, E0434                      |
| tests/adr-017/unqualified-enum-crossfile-return.test.cnx                                                  | E0424                             |
| tests/adr-017/unqualified-enum-crossfile-switch.test.cnx                                                  | E0424                             |
| tests/adr-017/unqualified-enum-direct-error.test.cnx                                                      | E0424                             |
| tests/adr-017/unqualified-enum-return-bool.test.cnx                                                       | E0424                             |
| tests/adr-017/unqualified-enum-return-i32.test.cnx                                                        | E0424                             |
| tests/adr-017/unqualified-enum-return-u8.test.cnx                                                         | E0424                             |
| tests/adr-017/unqualified-enum-scope-return.test.cnx                                                      | E0424                             |
| tests/adr-017/unqualified-enum-switch-case.test.cnx                                                       | E0424                             |
| tests/adr-017/unqualified-enum-transitive-error.test.cnx                                                  | E0424                             |
| tests/adr-022/controlling-expression-contexts-error.test.cnx                                              | E0701, E0702                      |
| tests/adr-022/controlling-expression-every-kind-error.test.cnx                                            | E0701                             |
| tests/adr-022/controlling-expression-imported-direct-error.test.cnx                                       | E0701, E0702                      |
| tests/adr-022/controlling-expression-imported-transitive-error.test.cnx                                   | E0701, E0702                      |
| tests/adr-022/do-while-error-non-boolean.test.cnx                                                         | E0701                             |
| tests/adr-022/for-error-non-boolean.test.cnx                                                              | E0701                             |
| tests/adr-022/function-call-in-do-while-error.test.cnx                                                    | E0702                             |
| tests/adr-022/function-call-in-for-error.test.cnx                                                         | E0702                             |
| tests/adr-022/function-call-in-if-double-negated-error.test.cnx                                           | E0702                             |
| tests/adr-022/function-call-in-if-error.test.cnx                                                          | E0702                             |
| tests/adr-022/function-call-in-if-negated-error.test.cnx                                                  | E0702                             |
| tests/adr-022/function-call-in-if-negated-this-error.test.cnx                                             | E0702                             |
| tests/adr-022/function-call-in-if-this-method-error.test.cnx                                              | E0702                             |
| tests/adr-022/function-call-in-ternary-error.test.cnx                                                     | E0702                             |
| tests/adr-022/function-call-in-while-error.test.cnx                                                       | E0702                             |
| tests/adr-022/if-error-non-boolean.test.cnx                                                               | E0701                             |
| tests/adr-022/nested-ternary-error.test.cnx                                                               | E0710                             |
| tests/adr-022/nested-ternary-for-header-error.test.cnx                                                    | E0710                             |
| tests/adr-022/nested-ternary-imported-direct-error.test.cnx                                               | E0710                             |
| tests/adr-022/nested-ternary-imported-transitive-error.test.cnx                                           | E0710                             |
| tests/adr-022/nested-ternary-unparenthesized-contexts-error.test.cnx                                      | (uncoded)                         |
| tests/adr-022/nested-ternary-unparenthesized-error.test.cnx                                               | (uncoded)                         |
| tests/adr-022/ternary-error-non-boolean.test.cnx                                                          | E0701                             |
| tests/adr-022/while-error-non-boolean.test.cnx                                                            | E0701                             |
| tests/adr-023/imported-direct-error.test.cnx                                                              | E0603                             |
| tests/adr-023/imported-transitive-error.test.cnx                                                          | E0603                             |
| tests/adr-023/same-file-contexts-error.test.cnx                                                           | E0603                             |
| tests/adr-023/sizeof-rejected-error.test.cnx                                                              | E0603                             |
| tests/adr-024/category-imported-direct-error.test.cnx                                                     | E0810, E0811, E0812               |
| tests/adr-024/category-imported-transitive-error.test.cnx                                                 | E0810, E0811, E0812               |
| tests/adr-024/category-same-file-error.test.cnx                                                           | E0810, E0811, E0812               |
| tests/adr-024/composite-narrowing-error.test.cnx                                                          | E0869                             |
| tests/adr-024/conversion-imported-direct-error.test.cnx                                                   | E0869                             |
| tests/adr-024/conversion-imported-transitive-error.test.cnx                                               | E0869                             |
| tests/adr-024/conversion-in-scope-error.test.cnx                                                          | E0869                             |
| tests/adr-024/conversion-other-scope-error.test.cnx                                                       | E0869                             |
| tests/adr-024/conversion-positions-contexts-error.test.cnx                                                | E0868, E0869                      |
| tests/adr-024/conversion-positions-imported-direct-error.test.cnx                                         | E0869                             |
| tests/adr-024/conversion-positions-imported-transitive-error.test.cnx                                     | E0869                             |
| tests/adr-024/conversion-scope-imported-direct-error.test.cnx                                             | E0869                             |
| tests/adr-024/conversion-scope-imported-transitive-error.test.cnx                                         | E0869                             |
| tests/adr-024/float-imported-direct-error.test.cnx                                                        | E0891                             |
| tests/adr-024/float-imported-transitive-error.test.cnx                                                    | E0891                             |
| tests/adr-024/float-same-file-error.test.cnx                                                              | E0891                             |
| tests/adr-024/forheader-category-imported-direct-error.test.cnx                                           | E0810, E0811, E0812               |
| tests/adr-024/forheader-category-imported-transitive-error.test.cnx                                       | E0810, E0811, E0812               |
| tests/adr-024/forheader-category-same-file-error.test.cnx                                                 | E0810, E0811, E0812               |
| tests/adr-024/forheader-conversion-imported-direct-error.test.cnx                                         | E0868, E0869, E0891               |
| tests/adr-024/forheader-conversion-imported-transitive-error.test.cnx                                     | E0868, E0869, E0891               |
| tests/adr-024/forheader-conversion-same-file-error.test.cnx                                               | E0868, E0869, E0891               |
| tests/adr-024/literal-binary-overflow-error.test.cnx                                                      | E0868                             |
| tests/adr-024/literal-contexts-error.test.cnx                                                             | E0868                             |
| tests/adr-024/literal-hex-overflow-error.test.cnx                                                         | E0868                             |
| tests/adr-024/literal-imported-direct-error.test.cnx                                                      | E0868                             |
| tests/adr-024/literal-imported-transitive-error.test.cnx                                                  | E0868                             |
| tests/adr-024/literal-negative-unsigned-error.test.cnx                                                    | E0868                             |
| tests/adr-024/literal-overflow-error.test.cnx                                                             | E0868                             |
| tests/adr-024/narrowing-assign-error.test.cnx                                                             | E0869                             |
| tests/adr-024/narrowing-cast-error.test.cnx                                                               | E0869                             |
| tests/adr-024/sign-assign-error.test.cnx                                                                  | E0869                             |
| tests/adr-024/sign-cast-error.test.cnx                                                                    | E0869                             |
| tests/adr-025/switch-codes-imported-direct.test.cnx                                                       | E0711, E0712, E0713, E0714, E0717 |
| tests/adr-025/switch-codes-imported-transitive.test.cnx                                                   | E0711, E0712, E0713, E0714, E0717 |
| tests/adr-025/switch-codes-in-scope-method.test.cnx                                                       | E0711, E0712                      |
| tests/adr-025/switch-error-boolean.test.cnx                                                               | E0711                             |
| tests/adr-025/switch-error-duplicate-case.test.cnx                                                        | E0713                             |
| tests/adr-025/switch-error-duplicate-neg-hex.test.cnx                                                     | E0713                             |
| tests/adr-025/switch-error-duplicate-negative.test.cnx                                                    | E0713                             |
| tests/adr-025/switch-error-non-exhaustive.test.cnx                                                        | E0714                             |
| tests/adr-025/switch-error-single-case.test.cnx                                                           | E0712                             |
| tests/adr-025/switch-error-wrong-count.test.cnx                                                           | E0714                             |
| tests/adr-025/switch-imported-direct-error.test.cnx                                                       | E0714                             |
| tests/adr-025/switch-imported-transitive-error.test.cnx                                                   | E0714                             |
| tests/adr-025/switch-in-scope-method-error.test.cnx                                                       | E0714                             |
| tests/adr-026/break-rejected.test.cnx                                                                     | E0703                             |
| tests/adr-026/continue-rejected.test.cnx                                                                  | E0703                             |
| tests/adr-026/imported-direct-rejected.test.cnx                                                           | E0703                             |
| tests/adr-026/imported-transitive-rejected.test.cnx                                                       | E0703                             |
| tests/adr-026/outside-loop-body-rejected.test.cnx                                                         | E0703                             |
| tests/adr-029/callback-c-header-arm-error.test.cnx                                                        | E0879                             |
| tests/adr-029/callback-c-header-cpp-error.test.cnx                                                        | E0879                             |
| tests/adr-029/callback-c-header-error.test.cnx                                                            | E0879                             |
| tests/adr-029/callback-c-header-grid-error.test.cnx                                                       | E0879                             |
| tests/adr-029/callback-c-header-host-error.test.cnx                                                       | E0879                             |
| tests/adr-029/callback-c-header-volatile-error.test.cnx                                                   | E0879                             |
| tests/adr-029/callback-error-nominal.test.cnx                                                             | E0880                             |
| tests/adr-029/callback-for-header-error.test.cnx                                                          | E0879, E0880                      |
| tests/adr-029/callback-for-header-imported-direct-error.test.cnx                                          | E0879, E0880                      |
| tests/adr-029/callback-for-header-imported-transitive-error.test.cnx                                      | E0879, E0880                      |
| tests/adr-029/callback-imported-direct-error.test.cnx                                                     | E0879, E0880                      |
| tests/adr-029/callback-imported-transitive-error.test.cnx                                                 | E0879, E0880                      |
| tests/adr-029/callback-inner-dimension-error.test.cnx                                                     | E0879                             |
| tests/adr-029/callback-scope-type-imported-error.test.cnx                                                 | E0879                             |
| tests/adr-029/callback-signature-error.test.cnx                                                           | E0879                             |
| tests/adr-029/callback-signature-imported-direct-error.test.cnx                                           | E0879                             |
| tests/adr-029/callback-signature-imported-transitive-error.test.cnx                                       | E0879                             |
| tests/adr-029/callback-signature-scope-error.test.cnx                                                     | E0879                             |
| tests/adr-029/callback-uncovered-arms-error.test.cnx                                                      | E0880                             |
| tests/adr-030/imported-direct-e0422.test.cnx                                                              | E0422                             |
| tests/adr-030/imported-direct-e0423.test.cnx                                                              | E0423                             |
| tests/adr-030/imported-direct-e0426.test.cnx                                                              | E0426                             |
| tests/adr-030/imported-direct-e0427.test.cnx                                                              | E0427                             |
| tests/adr-030/imported-transitive-e0422.test.cnx                                                          | E0422                             |
| tests/adr-030/imported-transitive-e0423.test.cnx                                                          | E0423                             |
| tests/adr-030/imported-transitive-e0426.test.cnx                                                          | E0426                             |
| tests/adr-030/imported-transitive-e0427.test.cnx                                                          | E0427                             |
| tests/adr-030/same-file-e0422.test.cnx                                                                    | E0422                             |
| tests/adr-030/same-file-e0423.test.cnx                                                                    | E0423                             |
| tests/adr-030/same-file-e0426.test.cnx                                                                    | E0426                             |
| tests/adr-034/bitmap-bracket-indexing-error.test.cnx                                                      | E0883                             |
| tests/adr-034/bitmap-codes-imported-direct-error.test.cnx                                                 | E0881, E0882, E0883, E0921        |
| tests/adr-034/bitmap-codes-imported-transitive-error.test.cnx                                             | E0881, E0882, E0883, E0921        |
| tests/adr-034/bitmap-codes-same-file-error.test.cnx                                                       | E0881, E0882, E0883, E0921        |
| tests/adr-034/bitmap-compound-imported-transitive-error.test.cnx                                          | E0857                             |
| tests/adr-034/bitmap-compound-same-file-error.test.cnx                                                    | E0857                             |
| tests/adr-034/bitmap-error-overflow.test.cnx                                                              | E0881                             |
| tests/adr-034/bitmap-unknown-field-error.test.cnx                                                         | E0882                             |
| tests/adr-034/bitmap-unknown-field-through-chain-error.test.cnx                                           | E0881, E0882, E0883               |
| tests/adr-035/array-count-included-error.test.cnx                                                         | E0866                             |
| tests/adr-035/array-count-transitive-error.test.cnx                                                       | E0866                             |
| tests/adr-035/array-form-error.test.cnx                                                                   | E0866, E0876                      |
| tests/adr-035/array-form-included-error.test.cnx                                                          | E0866, E0876, E0892               |
| tests/adr-035/array-form-transitive-error.test.cnx                                                        | E0866, E0876, E0892               |
| tests/adr-035/array-init-error.test.cnx                                                                   | E0866                             |
| tests/adr-035/array-init-string-concat-error.test.cnx                                                     | E0866                             |
| tests/adr-035/array-init-string-concat-sized-error.test.cnx                                               | E0866                             |
| tests/adr-035/empty-dimension-error.test.cnx                                                              | E0892                             |
| tests/adr-035/empty-dimension-included.test.cnx                                                           | E0892                             |
| tests/adr-036/array-bounds-uncovered-arms-error.test.cnx                                                  | E0854                             |
| tests/adr-036/array-shape-uncovered-arms-error.test.cnx                                                   | E0874, E0875                      |
| tests/adr-036/bounds-error.test.cnx                                                                       | E0854                             |
| tests/adr-036/c-style-error.test.cnx                                                                      | E0874                             |
| tests/adr-036/c-style-trailing-bracket-rejected.test.cnx                                                  | E0874                             |
| tests/adr-036/for-header-array-cpp-error.test.cnx                                                         | E0917                             |
| tests/adr-036/for-header-array-error.test.cnx                                                             | E0917                             |
| tests/adr-036/for-header-typedef-array-cpp-error.test.cnx                                                 | E0917                             |
| tests/adr-036/for-header-typedef-array-error.test.cnx                                                     | E0917                             |
| tests/adr-036/init-bounds-error.test.cnx                                                                  | E0854                             |
| tests/adr-036/matrix-bounds-direct-error.test.cnx                                                         | E0854                             |
| tests/adr-036/matrix-bounds-for-header-error.test.cnx                                                     | E0854                             |
| tests/adr-036/matrix-bounds-transitive-error.test.cnx                                                     | E0854                             |
| tests/adr-036/matrix-dimensions-direct-error.test.cnx                                                     | E0909, E0910                      |
| tests/adr-036/matrix-dimensions-error.test.cnx                                                            | E0909, E0910                      |
| tests/adr-036/matrix-dimensions-for-header-direct-error.test.cnx                                          | E0909, E0910                      |
| tests/adr-036/matrix-dimensions-for-header-error.test.cnx                                                 | E0909, E0910                      |
| tests/adr-036/matrix-dimensions-for-header-transitive-error.test.cnx                                      | E0909, E0910                      |
| tests/adr-036/matrix-dimensions-transitive-error.test.cnx                                                 | E0909, E0910                      |
| tests/adr-036/matrix-for-clause-direct-error.test.cnx                                                     | E0917                             |
| tests/adr-036/matrix-for-clause-error.test.cnx                                                            | E0917                             |
| tests/adr-036/matrix-for-clause-transitive-error.test.cnx                                                 | E0917                             |
| tests/adr-036/matrix-forms-direct-error.test.cnx                                                          | E0874, E0875, E0917               |
| tests/adr-036/matrix-forms-transitive-error.test.cnx                                                      | E0874, E0875, E0917               |
| tests/adr-036/matrix-scope-method-unbounded-error.test.cnx                                                | E0875                             |
| tests/adr-037/define-every-rejected-form-error.test.cnx                                                   | E0501, E0502                      |
| tests/adr-037/function-macro-error.test.cnx                                                               | E0501                             |
| tests/adr-037/nested-ifdef.test.cnx                                                                       | (uncoded)                         |
| tests/adr-037/value-define-error.test.cnx                                                                 | E0502                             |
| tests/adr-044/e0910-dimension-imported-direct.test.cnx                                                    | E0910                             |
| tests/adr-044/e0910-dimension-imported-transitive.test.cnx                                                | E0910                             |
| tests/adr-044/e0910-dimension-same-file.test.cnx                                                          | E0910                             |
| tests/adr-044/e0910-for-header-imported-direct.test.cnx                                                   | E0910                             |
| tests/adr-044/e0910-for-header-imported-transitive.test.cnx                                               | E0910                             |
| tests/adr-044/e0910-for-header-same-file.test.cnx                                                         | E0910                             |
| tests/adr-044/e0910-static-imported-direct.test.cnx                                                       | E0910                             |
| tests/adr-044/e0910-static-imported-transitive.test.cnx                                                   | E0910                             |
| tests/adr-044/e0912-imported-direct.test.cnx                                                              | E0912                             |
| tests/adr-044/e0912-imported-transitive.test.cnx                                                          | E0912                             |
| tests/adr-044/e0912-same-file.test.cnx                                                                    | E0912                             |
| tests/adr-044/static-initializer-imported-direct.test.cnx                                                 | E0909                             |
| tests/adr-044/static-initializer-imported-transitive.test.cnx                                             | E0909                             |
| tests/adr-045/string-array-init-error-mismatch.test.cnx                                                   | E0866                             |
| tests/adr-045/string-error-concat-global.test.cnx                                                         | E0863                             |
| tests/adr-045/string-error-concat-overflow.test.cnx                                                       | E0864                             |
| tests/adr-045/string-error-const-no-init.test.cnx                                                         | E0862                             |
| tests/adr-045/string-error-in-scope.test.cnx                                                              | E0864                             |
| tests/adr-045/string-error-infer-from-concat.test.cnx                                                     | E0862                             |
| tests/adr-045/string-error-init-from-stepped-source.test.cnx                                              | E0864                             |
| tests/adr-045/string-error-init-global.test.cnx                                                           | E0863                             |
| tests/adr-045/string-error-nonconst-unsized.test.cnx                                                      | E0862                             |
| tests/adr-045/string-error-overflow.test.cnx                                                              | E0864                             |
| tests/adr-045/string-error-substring-bounds.test.cnx                                                      | E0865                             |
| tests/adr-045/string-error-substring-dest.test.cnx                                                        | E0864                             |
| tests/adr-045/string-error-substring-global.test.cnx                                                      | E0863                             |
| tests/adr-045/string-error-uncovered-fit.test.cnx                                                         | E0864                             |
| tests/adr-045/string-error-uncovered-forms.test.cnx                                                       | E0862                             |
| tests/adr-045/string-fit-rules-contexts-error.test.cnx                                                    | E0865                             |
| tests/adr-045/string-fit-rules-for-header-error.test.cnx                                                  | E0864, E0865                      |
| tests/adr-045/string-fit-rules-for-header-imported-direct-error.test.cnx                                  | E0864, E0865                      |
| tests/adr-045/string-fit-rules-for-header-imported-transitive-error.test.cnx                              | E0864, E0865                      |
| tests/adr-045/string-fit-rules-imported-direct-error.test.cnx                                             | E0864, E0865                      |
| tests/adr-045/string-fit-rules-imported-transitive-error.test.cnx                                         | E0864, E0865                      |
| tests/adr-045/string-imported-direct-error.test.cnx                                                       | E0864                             |
| tests/adr-045/string-imported-global-error.test.cnx                                                       | E0863                             |
| tests/adr-045/string-imported-transitive-error.test.cnx                                                   | E0864                             |
| tests/adr-045/string-imported-transitive-global-error.test.cnx                                            | E0863                             |
| tests/adr-045/string-property-contexts-error.test.cnx                                                     | E0887                             |
| tests/adr-045/string-property-for-header-error.test.cnx                                                   | E0887                             |
| tests/adr-045/string-property-for-header-imported-direct-error.test.cnx                                   | E0887                             |
| tests/adr-045/string-property-for-header-imported-transitive-error.test.cnx                               | E0887                             |
| tests/adr-045/string-property-imported-direct-error.test.cnx                                              | E0887                             |
| tests/adr-045/string-property-imported-transitive-error.test.cnx                                          | E0887                             |
| tests/adr-045/string-storage-properties-error.test.cnx                                                    | E0887                             |
| tests/adr-045/string-syntax-rules-contexts-error.test.cnx                                                 | E0862, E0863                      |
| tests/adr-045/string-syntax-rules-imported-direct-error.test.cnx                                          | E0862, E0863                      |
| tests/adr-045/string-syntax-rules-imported-transitive-error.test.cnx                                      | E0862, E0863                      |
| tests/adr-049/atomic-const-error.test.cnx                                                                 | E0898                             |
| tests/adr-049/atomic-modifiers-imported-direct-error.test.cnx                                             | E0889, E0919                      |
| tests/adr-049/atomic-modifiers-imported-transitive-error.test.cnx                                         | E0889, E0919                      |
| tests/adr-049/atomic-mut-error.test.cnx                                                                   | E0919                             |
| tests/adr-049/atomic-mut-in-for-header-error.test.cnx                                                     | E0919                             |
| tests/adr-049/atomic-mut-in-function-error.test.cnx                                                       | E0919                             |
| tests/adr-049/atomic-mut-in-scope-method-error.test.cnx                                                   | E0919                             |
| tests/adr-049/atomic-never-written-error.test.cnx                                                         | E0899                             |
| tests/adr-049/atomic-unsized-string-error.test.cnx                                                        | E0862                             |
| tests/adr-049/atomic-volatile-error.test.cnx                                                              | E0889                             |
| tests/adr-049/atomic-volatile-in-for-header-error.test.cnx                                                | E0889                             |
| tests/adr-049/atomic-volatile-in-function-error.test.cnx                                                  | E0889                             |
| tests/adr-049/atomic-volatile-in-scope-member-error.test.cnx                                              | E0889                             |
| tests/adr-049/atomic-volatile-in-scope-method-error.test.cnx                                              | E0889                             |
| tests/adr-050/imported-direct-error.test.cnx                                                              | E0853                             |
| tests/adr-050/imported-transitive-error.test.cnx                                                          | E0853                             |
| tests/adr-050/return-in-critical-error.test.cnx                                                           | E0853                             |
| tests/adr-050/return-in-critical-scope-method-error.test.cnx                                              | E0853                             |
| tests/adr-050/return-in-critical-switch-error.test.cnx                                                    | E0853                             |
| tests/adr-051/for-header-division-imported-direct.test.cnx                                                | E0800, E0802                      |
| tests/adr-051/for-header-division-imported-transitive.test.cnx                                            | E0800, E0802                      |
| tests/adr-051/for-header-division-same-file.test.cnx                                                      | E0800, E0802                      |
| tests/adr-051/for-header-shape-imported-direct.test.cnx                                                   | E0884, E0885                      |
| tests/adr-051/for-header-shape-imported-transitive.test.cnx                                               | E0884, E0885                      |
| tests/adr-051/for-header-shape-same-file.test.cnx                                                         | E0884, E0885                      |
| tests/adr-051/safe-division-const-output-error.test.cnx                                                   | E0900                             |
| tests/adr-051/safe-division-shape-contexts.test.cnx                                                       | E0884, E0885                      |
| tests/adr-051/safe-division-shape-error.test.cnx                                                          | E0884, E0885                      |
| tests/adr-051/safe-division-shape-imported-direct.test.cnx                                                | E0884, E0885                      |
| tests/adr-051/safe-division-shape-imported-transitive.test.cnx                                            | E0884, E0885                      |
| tests/adr-058/for-header-length-imported-direct-error.test.cnx                                            | E0867, E0886                      |
| tests/adr-058/for-header-length-imported-transitive-error.test.cnx                                        | E0867, E0886                      |
| tests/adr-058/for-header-length-same-file-error.test.cnx                                                  | E0867, E0886                      |
| tests/adr-058/for-header-type-named-as-value-imported-direct-error.test.cnx                               | E0897                             |
| tests/adr-058/for-header-type-named-as-value-imported-transitive-error.test.cnx                           | E0897                             |
| tests/adr-058/for-header-type-named-as-value-same-file-error.test.cnx                                     | E0897                             |
| tests/adr-058/kinds-errors-error.test.cnx                                                                 | E0867                             |
| tests/adr-058/kinds-header-error.test.cnx                                                                 | E0867                             |
| tests/adr-058/kinds-memory-dimension-bitfield-error.test.cnx                                              | E0867                             |
| tests/adr-058/kinds-memory-dimension-error.test.cnx                                                       | E0909                             |
| tests/adr-058/kinds-removed-names-error.test.cnx                                                          | E0867, E0886                      |
| tests/adr-058/length-property-deprecated.test.cnx                                                         | E0886                             |
| tests/adr-058/length-property-imported-direct-error.test.cnx                                              | E0867                             |
| tests/adr-058/length-property-imported-transitive-error.test.cnx                                          | E0867                             |
| tests/adr-058/length-property-in-scope-error.test.cnx                                                     | E0867                             |
| tests/adr-058/length-property-literal-error.test.cnx                                                      | E0867, E0886                      |
| tests/adr-058/length-property-scope-struct-field-error.test.cnx                                           | E0886                             |
| tests/adr-058/length-property-scope-struct-imported-error.test.cnx                                        | E0867, E0886                      |
| tests/adr-058/length-property-scope-struct-transitive-error.test.cnx                                      | E0867, E0886                      |
| tests/adr-058/length-property-top-level-struct-field-error.test.cnx                                       | E0886                             |
| tests/adr-058/length-property-wrong-type-error.test.cnx                                                   | E0867                             |
| tests/adr-058/type-named-as-value-imported-direct-error.test.cnx                                          | E0897                             |
| tests/adr-058/type-named-as-value-imported-transitive-error.test.cnx                                      | E0897                             |
| tests/adr-058/type-named-as-value-same-file-error.test.cnx                                                | E0897                             |
| tests/adr-068/for-header-multi-statement-c-header-type-error.test.cnx                                     | E0715                             |
| tests/adr-068/for-header-multi-statement-error.test.cnx                                                   | E0715                             |
| tests/adr-068/for-header-multi-statement-imported-direct-error.test.cnx                                   | E0715                             |
| tests/adr-068/for-header-multi-statement-imported-transitive-error.test.cnx                               | E0715                             |
| tests/adr-068/for-header-multi-statement-in-scope-error.test.cnx                                          | E0715                             |
| tests/adr-068/forever-disguised-dowhile.test.cnx                                                          | E0707                             |
| tests/adr-068/forever-disguised-for-cond.test.cnx                                                         | E0707                             |
| tests/adr-068/forever-disguised-for-empty.test.cnx                                                        | E0707                             |
| tests/adr-068/forever-disguised-while-bool.test.cnx                                                       | E0707                             |
| tests/adr-068/forever-disguised-while-eq.test.cnx                                                         | E0707                             |
| tests/adr-068/forever-disguised-while-rel.test.cnx                                                        | E0707                             |
| tests/adr-068/forever-loops-imported-direct-error.test.cnx                                                | E0705, E0707                      |
| tests/adr-068/forever-loops-imported-transitive-error.test.cnx                                            | E0705, E0707                      |
| tests/adr-068/forever-non-void-error.test.cnx                                                             | E0705                             |
| tests/adr-068/loops-in-scope-error.test.cnx                                                               | E0705, E0707                      |
| tests/adr-071/c-callback-mut-match-error.test.cnx                                                         | E0879                             |
| tests/adr-071/c-fnptr-field-write-error.test.cnx                                                          | E0896, E0900                      |
| tests/adr-071/c-unnamed-parameter-error.test.cnx                                                          | E0900                             |
| tests/adr-071/c-variadic-write-error.test.cnx                                                             | E0896, E0900                      |
| tests/adr-071/c-void-pointer-write-error.test.cnx                                                         | E0896, E0900                      |
| tests/adr-071/c-write-imported-direct-error.test.cnx                                                      | E0896, E0900                      |
| tests/adr-071/c-write-imported-transitive-error.test.cnx                                                  | E0896, E0900                      |
| tests/adr-071/c-write-scope-method-error.test.cnx                                                         | E0896, E0900                      |
| tests/adr-071/callback-contexts-error.test.cnx                                                            | E0879                             |
| tests/adr-071/callback-contexts-imported-direct-error.test.cnx                                            | E0879                             |
| tests/adr-071/callback-contexts-imported-transitive-error.test.cnx                                        | E0879                             |
| tests/adr-071/callback-for-header-error.test.cnx                                                          | E0879                             |
| tests/adr-071/callback-for-header-imported-direct-error.test.cnx                                          | E0879                             |
| tests/adr-071/callback-for-header-imported-transitive-error.test.cnx                                      | E0879                             |
| tests/adr-071/callback-imported-direct-error.test.cnx                                                     | E0879                             |
| tests/adr-071/callback-imported-transitive-error.test.cnx                                                 | E0879                             |
| tests/adr-071/callback-mut-match-error.test.cnx                                                           | E0879                             |
| tests/adr-071/const-keyword-error.test.cnx                                                                | E0898                             |
| tests/adr-071/const-keyword-imported-error.test.cnx                                                       | E0898                             |
| tests/adr-071/const-keyword-imported-use-direct-error.test.cnx                                            | E0898                             |
| tests/adr-071/const-keyword-imported-use-transitive-error.test.cnx                                        | E0898                             |
| tests/adr-071/cpp-callee-write-error.test.cnx                                                             | E0900                             |
| tests/adr-071/cpp-method-receiver-error.test.cnx                                                          | E0900                             |
| tests/adr-071/opaque-handle-copy-error.test.cnx                                                           | E0900                             |
| tests/adr-071/unused-mut-error.test.cnx                                                                   | E0899                             |
| tests/adr-071/unused-mut-for-header-imported-direct-error.test.cnx                                        | E0899                             |
| tests/adr-071/unused-mut-for-header-imported-transitive-error.test.cnx                                    | E0899                             |
| tests/adr-071/unused-mut-imported-direct-error.test.cnx                                                   | E0899                             |
| tests/adr-071/unused-mut-imported-transitive-error.test.cnx                                               | E0899                             |
| tests/adr-071/write-every-kind-error.test.cnx                                                             | E0900                             |
| tests/adr-071/write-for-header-error.test.cnx                                                             | E0900                             |
| tests/adr-071/write-for-header-imported-direct-error.test.cnx                                             | E0900                             |
| tests/adr-071/write-for-header-imported-transitive-error.test.cnx                                         | E0900                             |
| tests/adr-071/write-imported-direct-error.test.cnx                                                        | E0900                             |
| tests/adr-071/write-imported-transitive-error.test.cnx                                                    | E0900                             |
| tests/analysis/division-by-const-zero.test.cnx                                                            | E0800                             |
| tests/analysis/division-by-zero.test.cnx                                                                  | E0800                             |
| tests/analysis/float-array-index.test.cnx                                                                 | E0851                             |
| tests/analysis/float-modulo.test.cnx                                                                      | E0804                             |
| tests/analysis/identifier-consecutive-underscore.test.cnx                                                 | E0201                             |
| tests/analysis/identifier-reserved-prefix-uppercase.test.cnx                                              | E0202                             |
| tests/analysis/identifier-reserved-prefix.test.cnx                                                        | E0202                             |
| tests/analysis/identifier-trailing-underscore.test.cnx                                                    | E0201                             |
| tests/analysis/misra-3-1-nested-block-comment.test.cnx                                                    | MISRA-3.1                         |
| tests/analysis/misra-3-1-nested-line-comment.test.cnx                                                     | MISRA-3.1                         |
| tests/analysis/misra-3-2-line-splice.test.cnx                                                             | MISRA-3.2                         |
| tests/analysis/modulo-by-zero.test.cnx                                                                    | E0802                             |
| tests/analysis/non-string-to-string.test.cnx                                                              | E0923                             |
| tests/analysis/reserved-parameter-name.test.cnx                                                           | E0227                             |
| tests/analysis/return-value-discarded.test.cnx                                                            | E0708                             |
| tests/analysis/self-recursion.test.cnx                                                                    | E0423                             |
| tests/analysis/signed-arithmetic-index.test.cnx                                                           | E0850                             |
| tests/analysis/signed-array-index.test.cnx                                                                | E0850                             |
| tests/analysis/signed-bit-index.test.cnx                                                                  | E0850                             |
| tests/analysis/string-arm-to-integer.test.cnx                                                             | E0914                             |
| tests/analysis/string-literal-to-integer.test.cnx                                                         | E0914                             |
| tests/analysis/string-literal-to-named-scalar.test.cnx                                                    | E0914                             |
| tests/analysis/string-literal-to-scalar.test.cnx                                                          | E0914                             |
| tests/analysis/string-variable-to-integer.test.cnx                                                        | E0914                             |
| tests/analysis/undefined-function.test.cnx                                                                | E0422                             |
| tests/analysis/uninitialized-variable.test.cnx                                                            | E0381                             |
| tests/arithmetic/division-by-const-zero.test.cnx                                                          | E0800                             |
| tests/arithmetic/division-by-zero-literal.test.cnx                                                        | E0800                             |
| tests/arithmetic/division-const-zero-formats.test.cnx                                                     | E0800                             |
| tests/arithmetic/modulo-by-const-zero.test.cnx                                                            | E0802                             |
| tests/arithmetic/modulo-by-zero-literal.test.cnx                                                          | E0802                             |
| tests/atomic/atomic-struct-member.test.cnx                                                                | (uncoded)                         |
| tests/bitmap/bitmap-error-bits.test.cnx                                                                   | E0893                             |
| tests/bitwise/i16-compound-shift-assign.test.cnx                                                          | E0805                             |
| tests/bitwise/i16-shift-ops.test.cnx                                                                      | E0805                             |
| tests/bitwise/i32-compound-shift-assign.test.cnx                                                          | E0805                             |
| tests/bitwise/i32-shift-ops.test.cnx                                                                      | E0805                             |
| tests/bitwise/i64-compound-shift-assign.test.cnx                                                          | E0805                             |
| tests/bitwise/i64-shift-ops.test.cnx                                                                      | E0805                             |
| tests/bitwise/i8-compound-right-shift-assign.test.cnx                                                     | E0805                             |
| tests/bitwise/i8-compound-shift-assign.test.cnx                                                           | E0805                             |
| tests/bitwise/i8-shift-ops.test.cnx                                                                       | E0805                             |
| tests/bitwise/shift-beyond-width-u16-error.test.cnx                                                       | E0873                             |
| tests/bitwise/shift-beyond-width-u32-error.test.cnx                                                       | E0873                             |
| tests/bitwise/shift-beyond-width-u64-error.test.cnx                                                       | E0873                             |
| tests/bitwise/shift-beyond-width-u8-error.test.cnx                                                        | E0873                             |
| tests/bitwise/shift-negative-error.test.cnx                                                               | E0873                             |
| tests/bitwise/shift-width-uncovered-arms-error.test.cnx                                                   | E0873                             |
| tests/bitwise/struct-member-compound-shift.test.cnx                                                       | E0805                             |
| tests/bugs/issue-1019-scope-member-string-init/read-before-init.test.cnx                                  | E0381                             |
| tests/bugs/issue-1040-all-paths-return/bare-return-nonvoid.test.cnx                                       | E0704                             |
| tests/bugs/issue-1040-all-paths-return/if-else-missing-branch.test.cnx                                    | E0704                             |
| tests/bugs/issue-1040-all-paths-return/if-without-else.test.cnx                                           | E0704                             |
| tests/bugs/issue-1040-all-paths-return/no-return.test.cnx                                                 | E0704                             |
| tests/bugs/issue-1040-all-paths-return/switch-no-default.test.cnx                                         | E0704                             |
| tests/bugs/issue-1040-all-paths-return/while-only.test.cnx                                                | E0704                             |
| tests/bugs/issue-1042-bare-bool-condition/bare-bool-local.test.cnx                                        | E0701                             |
| tests/bugs/issue-1042-bare-bool-condition/bare-bool-logical-and.test.cnx                                  | E0701                             |
| tests/bugs/issue-1042-bare-bool-condition/bare-bool-member.test.cnx                                       | E0701                             |
| tests/bugs/issue-1042-bare-bool-condition/bare-bool-negation.test.cnx                                     | E0701                             |
| tests/bugs/issue-1042-bare-bool-condition/bare-bool-param.test.cnx                                        | E0701                             |
| tests/bugs/issue-1090-braced-bodies/nested-bodies.test.cnx                                                | E0716                             |
| tests/bugs/issue-1090-braced-bodies/unbraced-bodies.test.cnx                                              | E0716                             |
| tests/bugs/issue-1090-braced-bodies/unbraced-declaration.test.cnx                                         | E0716                             |
| tests/bugs/issue-1133-guard-collision-diagnostic/guard-collision.test.cnx                                 | E0203                             |
| tests/bugs/issue-1145-atomic-bool-clamp-helper/atomic-bool-compound.test.cnx                              | E0806                             |
| tests/bugs/issue-1147-irq-fallback/critical-esp32.test.cnx                                                | E0916                             |
| tests/bugs/issue-1147-irq-fallback/critical-host.test.cnx                                                 | E0916                             |
| tests/bugs/issue-1159-dimension-notation-bounds/binary-dimension-bounds.test.cnx                          | E0854                             |
| tests/bugs/issue-1159-dimension-notation-bounds/hex-dimension-bounds.test.cnx                             | E0854                             |
| tests/bugs/issue-1175-constant-dimensions/const-cause.test.cnx                                            | E0909                             |
| tests/bugs/issue-1175-constant-dimensions/cross-file-variable-direct.test.cnx                             | E0909                             |
| tests/bugs/issue-1175-constant-dimensions/cross-file-variable-transitive.test.cnx                         | E0909                             |
| tests/bugs/issue-1175-constant-dimensions/dimension-missing-member.test.cnx                               | E0909                             |
| tests/bugs/issue-1175-constant-dimensions/dimension-zero-divisor.test.cnx                                 | E0800                             |
| tests/bugs/issue-1175-constant-dimensions/enum-missing-member.test.cnx                                    | E0909                             |
| tests/bugs/issue-1175-constant-dimensions/enum-zero-divisor.test.cnx                                      | E0800                             |
| tests/bugs/issue-1175-constant-dimensions/foreign-condition.test.cnx                                      | E0909                             |
| tests/bugs/issue-1175-constant-dimensions/overflow-dimension.test.cnx                                     | E0910                             |
| tests/bugs/issue-1175-constant-dimensions/property-bounds.test.cnx                                        | E0854                             |
| tests/bugs/issue-1175-constant-dimensions/stage-order.test.cnx                                            | E0909                             |
| tests/bugs/issue-1175-constant-dimensions/typed-literal-and-comparison.test.cnx                           | E0910                             |
| tests/bugs/issue-1175-constant-dimensions/variable-dimension-global.test.cnx                              | E0909                             |
| tests/bugs/issue-1175-constant-dimensions/variable-dimension-local.test.cnx                               | E0909                             |
| tests/bugs/issue-1183-bool-operand/bool-array-element-compound.test.cnx                                   | E0806                             |
| tests/bugs/issue-1183-bool-operand/bool-compound-right-hand-side.test.cnx                                 | E0807                             |
| tests/bugs/issue-1183-bool-operand/bool-division.test.cnx                                                 | E0807                             |
| tests/bugs/issue-1183-bool-operand/bool-multidimensional-array.test.cnx                                   | E0807                             |
| tests/bugs/issue-1183-bool-operand/bool-postfix-operand.test.cnx                                          | E0807                             |
| tests/bugs/issue-1183-bool-operand/bool-returning-call-operand.test.cnx                                   | E0807                             |
| tests/bugs/issue-1183-bool-operand/bool-returning-scope-call-operand.test.cnx                             | E0807                             |
| tests/bugs/issue-1183-bool-operand/bool-struct-field-compound.test.cnx                                    | E0806                             |
| tests/bugs/issue-1183-bool-operand/bool-ternary-operand.test.cnx                                          | E0807                             |
| tests/bugs/issue-1183-bool-operand/bool-valued-expression-operand.test.cnx                                | E0807                             |
| tests/bugs/issue-1190-cross-file-private-member/cross-file-private-const.test.cnx                         | E0436                             |
| tests/bugs/issue-1190-cross-file-private-member/transitive-private-const.test.cnx                         | E0436                             |
| tests/bugs/issue-1191-non-scalar-operand/array-operand.test.cnx                                           | E0925                             |
| tests/bugs/issue-1191-non-scalar-operand/enum-operand.test.cnx                                            | E0925                             |
| tests/bugs/issue-1191-non-scalar-operand/float-bitwise-operand.test.cnx                                   | E0925                             |
| tests/bugs/issue-1191-non-scalar-operand/rule-10-1-before-10-4.test.cnx                                   | E0925                             |
| tests/bugs/issue-1191-non-scalar-operand/string-relational.test.cnx                                       | E0925                             |
| tests/bugs/issue-1191-non-scalar-operand/struct-operand.test.cnx                                          | E0925                             |
| tests/bugs/issue-1195-parenthesized-comparison/bracketed-call-operand-error.test.cnx                      | E0702                             |
| tests/bugs/issue-1195-parenthesized-comparison/parenthesized-bare-bool-error.test.cnx                     | E0701                             |
| tests/bugs/issue-1195-parenthesized-comparison/parenthesized-call-error.test.cnx                          | E0702                             |
| tests/bugs/issue-1195-parenthesized-comparison/parenthesized-literal-loop-error.test.cnx                  | E0707                             |
| tests/bugs/issue-1203-non-addressable-mut-argument/direct-import-error.test.cnx                           | E0915                             |
| tests/bugs/issue-1203-non-addressable-mut-argument/for-header-direct-import-error.test.cnx                | E0915                             |
| tests/bugs/issue-1203-non-addressable-mut-argument/for-header-error.test.cnx                              | E0915                             |
| tests/bugs/issue-1203-non-addressable-mut-argument/for-header-transitive-import-error.test.cnx            | E0915                             |
| tests/bugs/issue-1203-non-addressable-mut-argument/header-constant-error.test.cnx                         | E0915                             |
| tests/bugs/issue-1203-non-addressable-mut-argument/initializer-error.test.cnx                             | E0915                             |
| tests/bugs/issue-1203-non-addressable-mut-argument/non-addressable-mut-argument-error.test.cnx            | E0915                             |
| tests/bugs/issue-1203-non-addressable-mut-argument/scope-method-error.test.cnx                            | E0915                             |
| tests/bugs/issue-1203-non-addressable-mut-argument/transitive-import-error.test.cnx                       | E0915                             |
| tests/bugs/issue-1220-analyzer-cross-file-symbols/boolean-operand-imported-direct.test.cnx                | E0807                             |
| tests/bugs/issue-1220-analyzer-cross-file-symbols/boolean-operand-imported-transitive.test.cnx            | E0807                             |
| tests/bugs/issue-1220-analyzer-cross-file-symbols/boolean-operand-same-file.test.cnx                      | E0807                             |
| tests/bugs/issue-1220-analyzer-cross-file-symbols/division-by-zero-imported-direct.test.cnx               | E0800, E0802                      |
| tests/bugs/issue-1220-analyzer-cross-file-symbols/division-by-zero-imported-transitive.test.cnx           | E0800, E0802                      |
| tests/bugs/issue-1220-analyzer-cross-file-symbols/division-by-zero-same-file.test.cnx                     | E0800, E0802                      |
| tests/bugs/issue-1220-analyzer-cross-file-symbols/float-modulo-imported-direct.test.cnx                   | E0804                             |
| tests/bugs/issue-1220-analyzer-cross-file-symbols/float-modulo-imported-transitive.test.cnx               | E0804                             |
| tests/bugs/issue-1220-analyzer-cross-file-symbols/float-modulo-same-file.test.cnx                         | E0804                             |
| tests/bugs/issue-1220-analyzer-cross-file-symbols/mixed-category-imported-direct.test.cnx                 | E0810                             |
| tests/bugs/issue-1220-analyzer-cross-file-symbols/mixed-category-imported-transitive.test.cnx             | E0810                             |
| tests/bugs/issue-1220-analyzer-cross-file-symbols/mixed-category-same-file.test.cnx                       | E0810                             |
| tests/bugs/issue-1220-analyzer-cross-file-symbols/signed-shift-imported-direct.test.cnx                   | E0805                             |
| tests/bugs/issue-1220-analyzer-cross-file-symbols/signed-shift-imported-transitive.test.cnx               | E0805                             |
| tests/bugs/issue-1220-analyzer-cross-file-symbols/signed-shift-same-file.test.cnx                         | E0805                             |
| tests/bugs/issue-1257-string-value-forms/string-field-non-string-error.test.cnx                           | E0923                             |
| tests/bugs/issue-1257-string-value-forms/string-value-forms-error.test.cnx                                | E0864                             |
| tests/bugs/issue-1268-qualified-zero-const/float-cast-index.test.cnx                                      | E0854                             |
| tests/bugs/issue-1268-qualified-zero-const/float-cast-shift.test.cnx                                      | E0873                             |
| tests/bugs/issue-1268-qualified-zero-const/float-to-integer-cast.test.cnx                                 | E0800, E0802                      |
| tests/bugs/issue-1268-qualified-zero-const/float-zero-forms.test.cnx                                      | E0800                             |
| tests/bugs/issue-1268-qualified-zero-const/length-property-divisor-imported.test.cnx                      | E0800                             |
| tests/bugs/issue-1268-qualified-zero-const/length-property-divisor.test.cnx                               | E0800                             |
| tests/bugs/issue-1268-qualified-zero-const/qualified-zero-const-imported.test.cnx                         | E0800, E0802                      |
| tests/bugs/issue-1268-qualified-zero-const/qualified-zero-const.test.cnx                                  | E0800, E0802                      |
| tests/bugs/issue-1268-qualified-zero-const/typed-cast-divisor.test.cnx                                    | E0800                             |
| tests/bugs/issue-1268-qualified-zero-const/unknown-type-cast-divisor.test.cnx                             | E0426                             |
| tests/bugs/issue-1283-adr029-init-at-declaration/callback-array-read-before-assign.test.cnx               | E0381                             |
| tests/bugs/issue-1283-adr029-init-at-declaration/callback-read-before-assign.test.cnx                     | E0381                             |
| tests/bugs/issue-1283-adr029-init-at-declaration/int16-macro-dimension.test.cnx                           | E0359                             |
| tests/bugs/issue-1283-adr029-init-at-declaration/macro-index-bounds.test.cnx                              | E0854                             |
| tests/bugs/issue-1283-adr029-init-at-declaration/non-callback-field-read.test.cnx                         | E0381                             |
| tests/bugs/issue-1283-adr029-init-at-declaration/unreadable-macro-size.test.cnx                           | E0359                             |
| tests/bugs/issue-1306-nested-scope-diagnostic/cross-file-nested.test.cnx                                  | E0430                             |
| tests/bugs/issue-1307-external-identifier-significance/colliding-scope-members.test.cnx                   | E0204                             |
| tests/bugs/issue-1307-external-identifier-significance/cross-file-collision.test.cnx                      | E0204                             |
| tests/bugs/issue-1312-undefined-type-position/order-consumer-first.test.cnx                               | E0426                             |
| tests/bugs/issue-1312-undefined-type-position/order-lib-first.test.cnx                                    | E0426                             |
| tests/bugs/issue-1312-undefined-type-position/undefined-type-same-file.test.cnx                           | E0426                             |
| tests/bugs/issue-1312-undefined-type-position/undefined-type-sibling.test.cnx                             | E0426                             |
| tests/bugs/issue-1320-whole-program-analysis/two-files-two-diagnostics.test.cnx                           | E0427, E0800                      |
| tests/bugs/issue-1322-scoped-const-collision/bounds-big-first-error.test.cnx                              | E0854                             |
| tests/bugs/issue-1322-scoped-const-collision/bounds-small-first-error.test.cnx                            | E0854                             |
| tests/bugs/issue-1322-scoped-struct-field-type/scoped-struct-bool-operand.test.cnx                        | E0807                             |
| tests/bugs/issue-1322-shadowed-rooted-spellings/global-shadowed-bounds.test.cnx                           | E0854                             |
| tests/bugs/issue-1322-shadowed-rooted-spellings/global-shadowed-string.test.cnx                           | E0857                             |
| tests/bugs/issue-1322-shadowed-rooted-spellings/this-shadowed-bit-access.test.cnx                         | E0856                             |
| tests/bugs/issue-1322-shadowed-rooted-spellings/this-shadowed-const.test.cnx                              | E0900                             |
| tests/bugs/issue-1333-scope-reopening/duplicate-member-reopened.test.cnx                                  | E0425                             |
| tests/bugs/issue-1334-scope-declaration-sites/conflict-across-files.test.cnx                              | E0425                             |
| tests/bugs/issue-1334-scope-declaration-sites/cross-language-conflict.test.cnx                            | E0425                             |
| tests/bugs/issue-1336-register-in-type-position/register-in-type-position.test.cnx                        | E0429                             |
| tests/bugs/issue-1353-undeclared-value-position/undeclared-value-same-file.test.cnx                       | E0427                             |
| tests/bugs/issue-1353-undeclared-value-position/undeclared-value-sibling-consumer-first.test.cnx          | E0427                             |
| tests/bugs/issue-1353-undeclared-value-position/undeclared-value-sibling-source-first.test.cnx            | E0427                             |
| tests/bugs/issue-1358-declare-idempotence/differing-signature-rejected.test.cnx                           | E0425                             |
| tests/bugs/issue-1360-read-path-bounds/cross-file-macro-dimension.test.cnx                                | E0854                             |
| tests/bugs/issue-1360-read-path-bounds/read-path-array-param.test.cnx                                     | E0854                             |
| tests/bugs/issue-1360-read-path-bounds/read-path-bounds.test.cnx                                          | E0854                             |
| tests/bugs/issue-1360-read-path-bounds/read-path-multidim.test.cnx                                        | E0854                             |
| tests/bugs/issue-1360-read-path-bounds/read-path-negative-index.test.cnx                                  | E0854                             |
| tests/bugs/issue-1360-read-path-bounds/read-path-scope-member.test.cnx                                    | E0854                             |
| tests/bugs/issue-1430-e0427-order-dependence/consumer-first.test.cnx                                      | E0427                             |
| tests/bugs/issue-1430-e0427-order-dependence/source-first.test.cnx                                        | E0427                             |
| tests/bugs/issue-1458-qualified-define-before-use/global-forward.test.cnx                                 | E0426                             |
| tests/bugs/issue-1458-qualified-define-before-use/global-self.test.cnx                                    | E0426                             |
| tests/bugs/issue-1458-qualified-define-before-use/global-to-scope.test.cnx                                | E0426                             |
| tests/bugs/issue-1458-qualified-define-before-use/scope-mutual.test.cnx                                   | E0426                             |
| tests/bugs/issue-1458-qualified-define-before-use/scope-to-scope.test.cnx                                 | E0426                             |
| tests/bugs/issue-1458-qualified-define-before-use/this-forward.test.cnx                                   | E0426                             |
| tests/bugs/issue-1458-qualified-define-before-use/this-mutual.test.cnx                                    | E0426                             |
| tests/bugs/issue-1458-qualified-define-before-use/this-self.test.cnx                                      | E0426                             |
| tests/bugs/issue-1472-scope-function-as-type/undefined-still-rejected.test.cnx                            | E0422                             |
| tests/bugs/issue-1514-cross-file-bitmap-register/cross-file-bitmap-register-bracket-error.test.cnx        | E0883                             |
| tests/bugs/issue-1514-cross-file-bitmap-register/cross-file-bitmap-register-out-of-closure-error.test.cnx | E0426                             |
| tests/bugs/issue-1531-declaration-rejections/cross-file-bitmap.test.cnx                                   | E0893                             |
| tests/bugs/issue-1531-declaration-rejections/cross-file-enum.test.cnx                                     | E0894                             |
| tests/bugs/issue-1582-undeclared-write-target/undeclared-read-through-root.test.cnx                       | E0427                             |
| tests/bugs/issue-1582-undeclared-write-target/undeclared-write-sibling-consumer-first.test.cnx            | E0427                             |
| tests/bugs/issue-1582-undeclared-write-target/undeclared-write-sibling-source-first.test.cnx              | E0427                             |
| tests/bugs/issue-1582-undeclared-write-target/undeclared-write-target.test.cnx                            | E0427                             |
| tests/bugs/issue-1618-conversion-positions/c-source-positions-rejected.test.cnx                           | E0869                             |
| tests/bugs/issue-1618-conversion-positions/literal-positions-rejected.test.cnx                            | E0868, E0910                      |
| tests/bugs/issue-1618-conversion-positions/narrowing-positions-rejected.test.cnx                          | E0869                             |
| tests/bugs/issue-1618-conversion-positions/sign-positions-rejected.test.cnx                               | E0869                             |
| tests/bugs/issue-1618-conversion-positions/static-ternary-owned.test.cnx                                  | E0910                             |
| tests/bugs/issue-1624-variable-above-declaration/variable-above-declaration.test.cnx                      | E0427                             |
| tests/bugs/issue-1629-case-label-undeclared/case-label-duplicate-spelling.test.cnx                        | E0713                             |
| tests/bugs/issue-1629-case-label-undeclared/case-label-undeclared.test.cnx                                | E0427                             |
| tests/bugs/issue-1632-break-assignment/break-assignment.test.cnx                                          | E0703                             |
| tests/bugs/issue-1643-self-referential-initializer/concatenation-local.test.cnx                           | E0427                             |
| tests/bugs/issue-1643-self-referential-initializer/constructor-arg-below.test.cnx                         | E0433                             |
| tests/bugs/issue-1643-self-referential-initializer/constructor-undeclared-self.test.cnx                   | E0433                             |
| tests/bugs/issue-1643-self-referential-initializer/for-header.test.cnx                                    | E0427                             |
| tests/bugs/issue-1643-self-referential-initializer/global-variable.test.cnx                               | E0427                             |
| tests/bugs/issue-1643-self-referential-initializer/integer-local.test.cnx                                 | E0427                             |
| tests/bugs/issue-1643-self-referential-initializer/parameter-function.test.cnx                            | E0427                             |
| tests/bugs/issue-1643-self-referential-initializer/scope-member.test.cnx                                  | E0427                             |
| tests/bugs/issue-1643-self-referential-initializer/substring-local.test.cnx                               | E0427                             |
| tests/bugs/issue-1664-const-binding/clamped-const-not-folded.test.cnx                                     | E0910                             |
| tests/bugs/issue-1664-const-shadow/local-bound-error.test.cnx                                             | E0854                             |
| tests/bugs/issue-1668-foreign-operands/c-typedef-declaration-error.test.cnx                               | E0810                             |
| tests/bugs/issue-1668-foreign-operands/c-typedef-narrowing-error.test.cnx                                 | E0869                             |
| tests/bugs/issue-1668-foreign-operands/cpp-members-error.test.cnx                                         | E0810                             |
| tests/bugs/issue-1668-foreign-operands/declared-function-pointer-field-error.test.cnx                     | E0810                             |
| tests/bugs/issue-1668-foreign-operands/declared-function-pointer-member-error.test.cnx                    | E0810                             |
| tests/bugs/issue-1668-foreign-operands/function-pointer-field-error.test.cnx                              | E0810                             |
| tests/bugs/issue-1668-foreign-operands/global-header-name-error.test.cnx                                  | E0810                             |
| tests/bugs/issue-1668-int-float-clamp/foreign-float-rejected-cpp.test.cnx                                 | E0810                             |
| tests/bugs/issue-1668-int-float-clamp/foreign-float-rejected.test.cnx                                     | E0810                             |
| tests/bugs/issue-1668-int-float-clamp/mixed-category-chained-rejected.test.cnx                            | E0810                             |
| tests/bugs/issue-1668-int-float-clamp/mixed-category-compound-rejected.test.cnx                           | E0810                             |
| tests/bugs/issue-1668-int-float-clamp/mixed-category-wrapped-level.test.cnx                               | E0810                             |
| tests/bugs/issue-1668-int-float-clamp/mixed-int-float-imported-direct.test.cnx                            | E0810                             |
| tests/bugs/issue-1668-int-float-clamp/mixed-int-float-imported-transitive.test.cnx                        | E0810                             |
| tests/bugs/issue-1668-int-float-clamp/mixed-int-float-rejected.test.cnx                                   | E0810                             |
| tests/bugs/issue-1668-int-float-clamp/postfix-operands-rejected.test.cnx                                  | E0810                             |
| tests/bugs/issue-1668-operand-typing/bit-subscript-sites.test.cnx                                         | E0856                             |
| tests/bugs/issue-1668-operand-typing/bitmap-field-sites.test.cnx                                          | E0881                             |
| tests/bugs/issue-1668-operand-typing/bool-for-header-compound.test.cnx                                    | E0806, E0807                      |
| tests/bugs/issue-1668-operand-typing/c-integer-categories.test.cnx                                        | E0810                             |
| tests/bugs/issue-1668-operand-typing/callback-assign-sites.test.cnx                                       | E0879                             |
| tests/bugs/issue-1668-operand-typing/compound-assign-sites.test.cnx                                       | E0857                             |
| tests/bugs/issue-1668-operand-typing/enum-assign-sites.test.cnx                                           | E0428                             |
| tests/bugs/issue-1668-operand-typing/float-modulo-shapes.test.cnx                                         | E0804                             |
| tests/bugs/issue-1668-operand-typing/integer-conversion-sources.test.cnx                                  | E0869                             |
| tests/bugs/issue-1668-operand-typing/register-write-sites.test.cnx                                        | E0871                             |
| tests/bugs/issue-1668-operand-typing/rule-10-4-categories.test.cnx                                        | E0810                             |
| tests/bugs/issue-1668-operand-typing/shift-operand-shapes.test.cnx                                        | E0805, E0873                      |
| tests/bugs/issue-1668-operand-typing/slice-assign-sites.test.cnx                                          | E0860, E0861                      |
| tests/bugs/issue-1668-param-dimension/hex-param-bounds.test.cnx                                           | E0854                             |
| tests/bugs/issue-1668-subscript-typing/string-element-float-error.test.cnx                                | E0925                             |
| tests/bugs/issue-1668-targets/conflicting-pragmas.test.cnx                                                | E0511                             |
| tests/bugs/issue-1668-targets/inline-bad-values.test.cnx                                                  | E0513                             |
| tests/bugs/issue-1668-targets/inline-incomplete.test.cnx                                                  | E0514                             |
| tests/bugs/issue-1668-targets/pio-ambiguous/pio-ambiguous.test.cnx                                        | E0511                             |
| tests/bugs/issue-1668-targets/pio-unknown-board/pio-unknown-board.test.cnx                                | E0510                             |
| tests/bugs/issue-1668-targets/pragma-bad-value.test.cnx                                                   | E0513                             |
| tests/bugs/issue-1668-targets/pragma-unknown-key.test.cnx                                                 | E0512                             |
| tests/bugs/issue-1668-targets/target-and-inline.test.cnx                                                  | E0511                             |
| tests/bugs/issue-1668-targets/target-required/no-target.test.cnx                                          | E0515                             |
| tests/bugs/issue-1668-targets/unknown-pragma.test.cnx                                                     | E0510                             |
| tests/bugs/issue-1668-ternary-arms/arms.test.cnx                                                          | E0810                             |
| tests/bugs/issue-1668-ternary-arms/transitive/transitive.test.cnx                                         | E0810                             |
| tests/bugs/issue-1669-enum-member-values/value-call.test.cnx                                              | E0909                             |
| tests/bugs/issue-1669-enum-member-values/value-header-macro.test.cnx                                      | E0909                             |
| tests/bugs/issue-1669-enum-member-values/value-i32-range.test.cnx                                         | E0911                             |
| tests/bugs/issue-1669-enum-member-values/value-negative-hex.test.cnx                                      | E0894                             |
| tests/bugs/issue-1669-enum-member-values/value-overflow.test.cnx                                          | E0910                             |
| tests/bugs/issue-1669-enum-member-values/value-self-later.test.cnx                                        | E0909                             |
| tests/bugs/issue-1669-enum-member-values/value-variable.test.cnx                                          | E0909                             |
| tests/bugs/issue-1688-float-macro/char-macro-error.test.cnx                                               | E0810, E0811                      |
| tests/bugs/issue-1688-float-macro/comment-glob-error.test.cnx                                             | E0810                             |
| tests/bugs/issue-1688-float-macro/float-macro-error.test.cnx                                              | E0810                             |
| tests/bugs/issue-1688-float-macro/system-macro-error.test.cnx                                             | E0810                             |
| tests/bugs/issue-1688-float-macro/unreadable-macro-error.test.cnx                                         | E0810, E0811, E0812               |
| tests/bugs/issue-1692-suffixed-float-div0/suffixed-float-div0.test.cnx                                    | E0800                             |
| tests/bugs/issue-1694-e0850-scoped-name/signed-then-loop.test.cnx                                         | E0850                             |
| tests/bugs/issue-1698-bare-scope-call/mix-error.test.cnx                                                  | E0810                             |
| tests/bugs/issue-1698-bare-scope-call/narrow-error.test.cnx                                               | E0869                             |
| tests/bugs/issue-1698-bare-scope-call/scope-wins-error.test.cnx                                           | E0869                             |
| tests/bugs/issue-1699-this-reopened-scope/bounds-error.test.cnx                                           | E0854                             |
| tests/bugs/issue-1699-this-reopened-scope/mix-error.test.cnx                                              | E0810                             |
| tests/bugs/issue-1699-this-reopened-scope/narrow-error.test.cnx                                           | E0869                             |
| tests/bugs/issue-1702-declaration-position/after-inner-error.test.cnx                                     | E0810                             |
| tests/bugs/issue-1702-declaration-position/cv-fn-error.test.cnx                                           | E0869                             |
| tests/bugs/issue-1702-declaration-position/fl-fn-error.test.cnx                                           | E0810                             |
| tests/bugs/issue-1724-sibling-scope-type-not-included/frames-see-own-closure-error.test.cnx               | E0810                             |
| tests/bugs/issue-1724-sibling-scope-type-not-included/typer-sees-own-closure-error.test.cnx               | E0428                             |
| tests/bugs/issue-1728-leading-zero/leading-zero.test.cnx                                                  | E0912                             |
| tests/bugs/issue-1735-static-initializer-arithmetic/static-not-constant.test.cnx                          | E0909                             |
| tests/bugs/issue-1735-static-initializer-arithmetic/static-overflow-arithmetic.test.cnx                   | E0910                             |
| tests/bugs/issue-1735-static-initializer-arithmetic/static-overflow.test.cnx                              | E0910                             |
| tests/bugs/issue-1740-reopened-scope-this-call/this-call-undeclared.test.cnx                              | E0422                             |
| tests/bugs/issue-1745-include-directive-agreement/commented-out-header-error.test.cnx                     | E0422                             |
| tests/bugs/issue-1745-include-directive-agreement/commented-out-include-error.test.cnx                    | E0426                             |
| tests/bugs/issue-1755-system-headers/fgets-read-only-cortex-m7-error.test.cnx                             | E0896, E0900                      |
| tests/bugs/issue-1755-system-headers/fgets-read-only-error.test.cnx                                       | E0896, E0900                      |
| tests/bugs/issue-1755-system-headers/strlen-narrow-error.test.cnx                                         | E0869                             |
| tests/bugs/issue-1755-system-headers/strlen-signed-error.test.cnx                                         | E0810                             |
| tests/bugs/issue-1755-system-headers/typedef-chain-mismatch-error.test.cnx                                | E0895                             |
| tests/bugs/issue-1768-variable-dimension/header-variable.test.cnx                                         | E0909                             |
| tests/bugs/issue-1768-variable-dimension/variable-dimension.test.cnx                                      | E0909                             |
| tests/bugs/issue-1770-compound-division-zero/compound-division-zero-imported.test.cnx                     | E0800, E0802                      |
| tests/bugs/issue-1770-compound-division-zero/compound-division-zero-scoped.test.cnx                       | E0800, E0802                      |
| tests/bugs/issue-1770-compound-division-zero/compound-division-zero.test.cnx                              | E0800, E0802                      |
| tests/bugs/issue-1782-whole-array-assignment/compound-error.test.cnx                                      | E0857                             |
| tests/bugs/issue-1782-whole-array-assignment/for-clause-error.test.cnx                                    | E0917                             |
| tests/bugs/issue-1782-whole-array-assignment/non-list-error.test.cnx                                      | E0866                             |
| tests/bugs/issue-1782-whole-array-assignment/transitive-error.test.cnx                                    | E0866                             |
| tests/bugs/issue-1800-float-to-integer/for-header-rejected.test.cnx                                       | E0868, E0869, E0891               |
| tests/bugs/issue-1800-float-to-integer/implicit-rejected.test.cnx                                         | E0891                             |
| tests/bugs/issue-1800-float-to-integer/positions-rejected.test.cnx                                        | E0891                             |
| tests/bugs/issue-1802-struct-initializer-target/header-scalar.test.cnx                                    | E0358                             |
| tests/bugs/issue-1802-struct-initializer-target/non-struct-targets.test.cnx                               | E0358                             |
| tests/bugs/issue-1802-struct-initializer-target/pointer-and-function-types.test.cnx                       | E0358                             |
| tests/bugs/issue-1802-struct-initializer-target/whole-array-positions.test.cnx                            | E0866                             |
| tests/bugs/issue-1808-bit-index-width/bit-index-width-error.test.cnx                                      | E0920                             |
| tests/bugs/issue-1833-miscased-cnx-extension/miscased-include-error.test.cnx                              | E0518                             |
| tests/bugs/issue-1866-scope-member-is-not-external/bare-call-outside-scope.test.cnx                       | E0422                             |
| tests/bugs/issue-1866-scope-member-is-not-external/global-call-to-scope-member.test.cnx                   | E0422                             |
| tests/bugs/issue-1866-scope-member-is-not-external/included-member-from-file-scope.test.cnx               | E0422                             |
| tests/bugs/issue-1866-scope-member-is-not-external/included-member-from-other-scope.test.cnx              | E0422                             |
| tests/bugs/issue-1866-scope-member-is-not-external/later-member-bare-call.test.cnx                        | E0422                             |
| tests/bugs/issue-1867-length-reads-no-value/element-read-uninit-error.test.cnx                            | E0381                             |
| tests/bugs/issue-1874-dimension-range/dimension-range.test.cnx                                            | E0913                             |
| tests/bugs/issue-1879-constant-expression-div0/div-constant-expression.test.cnx                           | E0800                             |
| tests/bugs/issue-1963-define-before-use/global-and-local.test.cnx                                         | E0426                             |
| tests/bugs/issue-1963-define-before-use/struct-field.test.cnx                                             | E0426                             |
| tests/bugs/issue-1975-header-struct-byte-length/case-label-length-error.test.cnx                          | E0713, E0717                      |
| tests/bugs/issue-1975-header-struct-byte-length/cpp-class-layout-error.test.cnx                           | E0867                             |
| tests/bugs/issue-1975-header-struct-byte-length/header-layout-error.test.cnx                              | E0867                             |
| tests/bugs/issue-1975-header-struct-byte-length/header-pointer-field-error.test.cnx                       | E0867                             |
| tests/bugs/issue-1975-header-struct-byte-length/type-named-as-value-error.test.cnx                        | E0897                             |
| tests/bugs/issue-1975-type-length-across-includes/type-length-across-includes-error.test.cnx              | E0897                             |
| tests/bugs/issue-1977-struct-to-c-byte-pointer/struct-to-c-byte-pointer-error.test.cnx                    | E0895, E0896, E0900               |
| tests/bugs/issue-1980-enum-read-before-assign/enum-read-before-assign.test.cnx                            | E0381                             |
| tests/bugs/issue-1981-struct-cycle/direct.test.cnx                                                        | E0426                             |
| tests/bugs/issue-1981-struct-cycle/mutual.test.cnx                                                        | E0426                             |
| tests/bugs/issue-1991-for-header-enum-assign/for-header-enum-assign.test.cnx                              | E0428                             |
| tests/bugs/issue-1991-form-error-halts-run/form-error-halts-run.test.cnx                                  | E0201                             |
| tests/bugs/issue-1991-form-error-halts-run/form-errors-source-order.test.cnx                              | E0202, E0912                      |
| tests/bugs/issue-2001-qualified-write-initializes-local/global-write-local-shadow.test.cnx                | E0381                             |
| tests/bugs/issue-2001-qualified-write-initializes-local/global-write-scope-member.test.cnx                | E0381                             |
| tests/bugs/issue-2001-qualified-write-initializes-local/local-write-scope-member.test.cnx                 | E0381                             |
| tests/bugs/issue-2001-qualified-write-initializes-local/parameter-write-scope-member.test.cnx             | E0381                             |
| tests/bugs/issue-2001-qualified-write-initializes-local/this-write-local-shadow.test.cnx                  | E0381                             |
| tests/bugs/issue-2004-initialization-binds-through-1-4/for-variable-write-reader-after.test.cnx           | E0381                             |
| tests/bugs/issue-2004-initialization-binds-through-1-4/for-variable-write-reader-before.test.cnx          | E0381                             |
| tests/bugs/issue-2011-redeclaration-in-one-scope/local-redeclares-parameter.test.cnx                      | E0425                             |
| tests/bugs/issue-2011-redeclaration-in-one-scope/local-redeclares-shadowing-parameter.test.cnx            | E0425                             |
| tests/bugs/issue-2011-redeclaration-in-one-scope/two-locals-one-block.test.cnx                            | E0425                             |
| tests/bugs/issue-2019-header-unclosed-name/clamp-forward.test.cnx                                         | E0427                             |
| tests/bugs/issue-2019-header-unclosed-name/concatenation-self.test.cnx                                    | E0427                             |
| tests/bugs/issue-2019-header-unclosed-name/self-local.test.cnx                                            | E0427                             |
| tests/bugs/issue-2019-header-unclosed-name/substring-self.test.cnx                                        | E0427                             |
| tests/bugs/issue-2027-register-field-zero/register-field-zero.test.cnx                                    | E0872                             |
| tests/bugs/issue-2046-duplicate-case-value/duplicate-by-value.test.cnx                                    | E0713                             |
| tests/bugs/issue-2051-case-label-not-constant/case-label-not-constant.test.cnx                            | E0717                             |
| tests/bugs/issue-2073-for-header-forms/for-header-forms-cpp-error.test.cnx                                | E0917                             |
| tests/bugs/issue-2073-for-header-forms/for-header-forms-error.test.cnx                                    | E0917                             |
| tests/bugs/issue-2076-header-struct-dimension/header-pointer-dimension-error.test.cnx                     | E0909                             |
| tests/bugs/issue-2096-inactive-header-branch/inactive-branch-error.test.cnx                               | E0422                             |
| tests/bugs/issue-2157-array-parameter-list/non-array-argument-error.test.cnx                              | E0866                             |
| tests/bugs/issue-2157-array-parameter-list/transitive-argument-error.test.cnx                             | E0866                             |
| tests/bugs/issue-2186-bitmap-array-field/bitmap-array-field.test.cnx                                      | E0921                             |
| tests/bugs/issue-2191-assignment-capacity/assignment-capacity-every-target-error.test.cnx                 | E0864                             |
| tests/bugs/issue-2194-array-argument-shape/shape-error.test.cnx                                           | E0866                             |
| tests/bugs/issue-2195-array-row-slot/row-slot-declaration-error.test.cnx                                  | E0866                             |
| tests/bugs/issue-2195-array-row-slot/row-slot-error.test.cnx                                              | E0866                             |
| tests/bugs/issue-2196-macro-fill-all/fill-declaration-error.test.cnx                                      | E0866                             |
| tests/bugs/issue-2196-macro-fill-all/fill-error.test.cnx                                                  | E0866                             |
| tests/bugs/issue-2209-array-argument-element/element-error.test.cnx                                       | E0866                             |
| tests/bugs/issue-2236-string-field-initializer/string-field-initializer-error.test.cnx                    | E0863, E0864                      |
| tests/bugs/issue-2239-string-argument-build/string-argument-capacity-error.test.cnx                       | E0864                             |
| tests/bugs/issue-2240-substring-constant-length/substring-runtime-length-error.test.cnx                   | E0922                             |
| tests/bugs/issue-2251-bitmap-field-bit-index/field-bit-index-wo-zero-error.test.cnx                       | E0872                             |
| tests/bugs/issue-2254-volatile-not-inlined/volatile-dimension-error.test.cnx                              | E0909                             |
| tests/bugs/issue-2332-short-circuit-built-initializer/loop-condition-nested-call-error.test.cnx           | E0702                             |
| tests/bugs/issue-2341-included-scope-type-bare-use/no-scope-type.test.cnx                                 | E0426                             |
| tests/bugs/issue-847-misra-17-7-lowering/bare-intra-scope-discard.test.cnx                                | E0708                             |
| tests/bugs/issue-847-misra-17-7-lowering/cross-file-scope-discard.test.cnx                                | E0708                             |
| tests/bugs/issue-847-misra-17-7-lowering/external-c-discard.test.cnx                                      | E0708                             |
| tests/bugs/issue-847-misra-17-7-lowering/external-cpp-discard.test.cnx                                    | E0708                             |
| tests/bugs/issue-847-misra-17-7-lowering/scope-method-imported-discard.test.cnx                           | E0708                             |
| tests/bugs/issue-847-misra-17-7-lowering/transitive-function-discard.test.cnx                             | E0708                             |
| tests/bugs/issue-847-misra-17-7-lowering/transitive-scope-method-discard.test.cnx                         | E0708                             |
| tests/c-interop/cpp14-header/crc32.test.cnx                                                               | E0859                             |
| tests/c-interop/use-c-union-basic.test.cnx                                                                | (uncoded)                         |
| tests/c-interop/use-c-union-typedef.test.cnx                                                              | (uncoded)                         |
| tests/casting/mixed-category-arithmetic.test.cnx                                                          | E0810                             |
| tests/comments/comment-in-condition-message-error.test.cnx                                                | E0702                             |
| tests/comments/comment-in-negative-literal-error.test.cnx                                                 | E0868                             |
| tests/comments/misra-3-1-nested-block.test.cnx                                                            | MISRA-3.1                         |
| tests/comments/misra-3-2-backslash.test.cnx                                                               | MISRA-3.2                         |
| tests/compound-assign/bit-index-compound.test.cnx                                                         | E0857                             |
| tests/compound-assign/bitmap-field-compound-unknown-field.test.cnx                                        | E0882                             |
| tests/compound-assign/bitmap-field-compound.test.cnx                                                      | E0857                             |
| tests/compound-assign/struct-field-bit-index-compound.test.cnx                                            | E0857                             |
| tests/constructor-syntax/error-literal-arg.test.cnx                                                       | (uncoded)                         |
| tests/constructor-syntax/error-non-const-arg.test.cnx                                                     | E0432                             |
| tests/constructor-syntax/error-undeclared-arg.test.cnx                                                    | E0433                             |
| tests/enum/enum-error-negative.test.cnx                                                                   | E0894                             |
| tests/external-types/cpp-class-global-error.test.cnx                                                      | E0508                             |
| tests/external-types/cpp-class-scope-member-error.test.cnx                                                | E0508                             |
| tests/floats/float-const-zero-error.test.cnx                                                              | E0800                             |
| tests/floats/float-division-by-literal-zero.test.cnx                                                      | E0800                             |
| tests/floats/float-division-by-zero.test.cnx                                                              | E0800                             |
| tests/floats/float-modulo-error.test.cnx                                                                  | E0804                             |
| tests/floats/float-modulo-f64-error.test.cnx                                                              | E0804                             |
| tests/floats/float-modulo-literal-error.test.cnx                                                          | E0804                             |
| tests/floats/float-modulo-param-error.test.cnx                                                            | E0804                             |
| tests/forward-declarations/bare-undeclared-function-error.test.cnx                                        | E0422                             |
| tests/forward-declarations/call-before-define-error.test.cnx                                              | E0422                             |
| tests/forward-declarations/global-undeclared-function-error.test.cnx                                      | E0422                             |
| tests/forward-declarations/global-unknown-function-error.test.cnx                                         | E0422                             |
| tests/forward-declarations/multiple-undefined-error.test.cnx                                              | E0422                             |
| tests/forward-declarations/recursive-call-error.test.cnx                                                  | E0423                             |
| tests/forward-declarations/scope-member-undefined-error.test.cnx                                          | E0422                             |
| tests/forward-declarations/stdlib-without-include-error.test.cnx                                          | E0422                             |
| tests/forward-declarations/this-undefined-method-error.test.cnx                                           | E0422                             |
| tests/forward-declarations/undefined-function-error.test.cnx                                              | E0422                             |
| tests/include/cnx-alternative-error-angle.test.cnx                                                        | E0504                             |
| tests/include/cnx-alternative-error-hpp.test.cnx                                                          | E0504                             |
| tests/include/cnx-alternative-error-quoted.test.cnx                                                       | E0504                             |
| tests/include/cpp-syntax-undeclared.test.cnx                                                              | E0507                             |
| tests/include/cpp-transitive-undeclared.test.cnx                                                          | E0507                             |
| tests/include/cpp-undeclared.test.cnx                                                                     | E0507                             |
| tests/include/missing-cnx-include-error.test.cnx                                                          | E0506                             |
| tests/initialization/compound-assign-all-ops.test.cnx                                                     | E0381                             |
| tests/initialization/compound-assign-struct-field.test.cnx                                                | E0381                             |
| tests/initialization/compound-assign-use-before-init.test.cnx                                             | E0381                             |
| tests/initialization/if-else-branches.test.cnx                                                            | E0381                             |
| tests/initialization/partial-branch-init-error.test.cnx                                                   | E0381                             |
| tests/initialization/use-before-init.test.cnx                                                             | E0381                             |
| tests/null-check/e0908-basic.test.cnx                                                                     | E0908                             |
| tests/null-check/e0908-reassignment.test.cnx                                                              | E0908                             |
| tests/null-check/forbidden-fopen.test.cnx                                                                 | E0901                             |
| tests/null-check/invalid-c-prefix-int.test.cnx                                                            | E0906                             |
| tests/null-check/invalid-null-usage.test.cnx                                                              | E0903                             |
| tests/null-check/missing-c-prefix.test.cnx                                                                | E0905                             |
| tests/null-check/missing-null-check.test.cnx                                                              | E0901                             |
| tests/null-check/null-comparison-no-prefix.test.cnx                                                       | E0907                             |
| tests/null-check/null-in-ternary.test.cnx                                                                 | (uncoded)                         |
| tests/null-check/null-neq-check.test.cnx                                                                  | E0905, E0907                      |
| tests/null-check/valid-fgetc-check.test.cnx                                                               | E0905                             |
| tests/overflow-modifiers/clamp-wide-literal-rejected.test.cnx                                             | E0868                             |
| tests/preprocessor/include-impl-file-error.test.cnx                                                       | E0503                             |
| tests/register/register-bits-syntax-error.test.cnx                                                        | (uncoded)                         |
| tests/scope/nested-scope-error.test.cnx                                                                   | E0430                             |
| tests/scope/param-prefix-naming-error.test.cnx                                                            | E0227                             |
| tests/scope/param-prefix-naming-scope-error.test.cnx                                                      | E0227                             |
| tests/static-allocation/aligned-alloc-error.test.cnx                                                      | E0902                             |
| tests/static-allocation/calloc-error.test.cnx                                                             | E0902                             |
| tests/static-allocation/free-error.test.cnx                                                               | E0902                             |
| tests/static-allocation/import-in-declaration.test.cnx                                                    | E0902                             |
| tests/static-allocation/import-vendor-wrapper.test.cnx                                                    | E0902                             |
| tests/static-allocation/import-without-include.test.cnx                                                   | E0902                             |
| tests/static-allocation/malloc-error.test.cnx                                                             | E0902                             |
| tests/static-allocation/realloc-error.test.cnx                                                            | E0902                             |
| tests/string-assignment/string-assign-error-compound.test.cnx                                             | E0857                             |
| tests/string-assignment/string-assign-error-struct-compound.test.cnx                                      | E0857                             |
| tests/string-assignment/string-assign-error-this-compound.test.cnx                                        | E0857                             |
| tests/ternary/ternary-error-no-parens.test.cnx                                                            | (uncoded)                         |
