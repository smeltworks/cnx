#ifndef CONST_POINTER_CB_H
#define CONST_POINTER_CB_H

#include <stdint.h>

/* The pointer is const, the byte it points to is not */
typedef void (*fill_cb_t)(uint8_t* const buf);

static fill_cb_t fill_cb;

static inline void set_fill(fill_cb_t cb) {
    fill_cb = cb;
}

static inline void run_fill(uint8_t* buf) {
    fill_cb(buf);
}

#endif
