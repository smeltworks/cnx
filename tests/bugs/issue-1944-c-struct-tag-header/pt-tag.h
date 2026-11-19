/* Helper for struct-tag-header.test.cnx (#1944): a C struct declared with no
   typedef, so C must write `struct Point`. */
#pragma once
#include <stdint.h>
struct Point {
    int32_t x;
    int32_t y;
};
