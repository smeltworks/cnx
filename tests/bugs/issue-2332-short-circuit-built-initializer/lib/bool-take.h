#ifndef BOOL_TAKE_H
#define BOOL_TAKE_H

#include <stdbool.h>
#include <stdint.h>

static inline uint32_t take(bool b) {
    return b ? 1U : 2U;
}

#endif
