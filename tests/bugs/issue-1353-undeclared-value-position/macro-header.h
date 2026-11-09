/* Helper for the #1399 review regression. The macro is the point: a `#define`
   never reaches the symbol table, so E0427 has no external view to fall back
   on for it, unlike the typedef beside it. */
#ifndef ISSUE_1353_MACRO_HEADER_H
#define ISSUE_1353_MACRO_HEADER_H
#define SHARED_LIMIT_MACRO 42

typedef struct {
  int x;
  int y;
} shared_point_t;
#endif
