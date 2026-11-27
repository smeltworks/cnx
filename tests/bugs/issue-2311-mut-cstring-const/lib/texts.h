#ifndef TEXTS_H
#define TEXTS_H
#include <stdint.h>
#include <string.h>
static char texts_buffer[16] = "hello";
static inline char* texts_get(void) { return texts_buffer; }
static inline void texts_upper(char* text) { text[0] = (char)(text[0] - 32); }
static inline void texts_keep(void* text) { (void)text; }
static inline uint32_t texts_length(const char* text) { return (uint32_t) strlen(text); }
#endif
