#ifndef CSTRING_PLACES_H
#define CSTRING_PLACES_H
#include <string.h>
#include <stdint.h>
typedef char* text_ptr;
typedef struct { char* name; int id; } Customer;
typedef struct { char* names[2]; int id; } Names;
typedef struct { char* (*get)(void); int id; } Getter;
static char* (*g_make)(void);
static char* (*g_makers[2])(void);
static char* g_name;
static char* g_names[2];
static inline uint32_t name_length(void) { return g_name ? (uint32_t) strlen(g_name) : 0U; }
static inline uint32_t names_length(void) { return g_names[0] ? (uint32_t) strlen(g_names[0]) : 0U; }
static inline uint32_t ptr_len(text_ptr t) { return (uint32_t) strlen(t); }
static inline uint32_t call_len(char* (*make)(void)) { return (uint32_t) strlen(make()); }
static inline uint32_t getter_len(const Getter* g) { return (uint32_t) strlen(g->get()); }
#endif
