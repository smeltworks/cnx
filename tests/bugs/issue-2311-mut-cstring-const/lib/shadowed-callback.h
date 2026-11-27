#ifndef SHADOWED_CALLBACK_H
#define SHADOWED_CALLBACK_H
#include <stdint.h>
#include <string.h>
typedef char* (*writable_get)(void);
typedef struct { char* (*get)(void); int id; } WritableHolder;
static char shadowed_buffer[4] = "abc";
static inline char* writable_name(void) { return shadowed_buffer; }
static inline uint32_t holder_len(const WritableHolder* h) { return (uint32_t) strlen(h->get()); }
#endif
