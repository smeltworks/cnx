#ifndef CONSTRAINT_API_H
#define CONSTRAINT_API_H

/* A type whose name begins with the letters `const`, and no const anywhere */
typedef struct { int v; } constraint_t;
typedef void (*Cb)(constraint_t *c);

static Cb registered;

static inline void register_cb(Cb cb) {
    registered = cb;
}

static inline void run_cb(constraint_t *c) {
    registered(c);
}

#endif
