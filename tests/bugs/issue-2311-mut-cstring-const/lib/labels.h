#ifndef LABELS_H
#define LABELS_H
#include <stdint.h>
#include <string.h>
typedef char* (*label_fn)(void);
typedef const char* (*label_view_fn)(void);
static inline uint32_t label_length(label_fn make) { return (uint32_t) strlen(make()); }
static inline uint32_t label_view_length(label_view_fn make) { return (uint32_t) strlen(make()); }
typedef struct { char* name; const char* tag; int id; } Customer;
#endif
