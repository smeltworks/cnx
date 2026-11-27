#ifndef TEXT_LENGTH_H
#define TEXT_LENGTH_H
#include <stdint.h>
#include <string.h>
typedef const char* text_view_t;
static inline uint32_t view_length(text_view_t text) { return (uint32_t) strlen(text); }
static inline uint32_t array_length(const char text[]) { return (uint32_t) strlen(text); }
#endif
