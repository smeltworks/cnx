#ifndef CONST_POINTER_CB_H
#define CONST_POINTER_CB_H

#include <stdint.h>

/* The pointer is const, the byte it points to is not */
typedef void (*fill_cb_t)(uint8_t* const buf);

static inline void set_fill(fill_cb_t cb) {
    (void)cb;
}

#endif
