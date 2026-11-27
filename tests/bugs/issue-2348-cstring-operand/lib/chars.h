#ifndef CHARS_H
#define CHARS_H
static inline void chars_upper(char* text) { text[0] = (char)(text[0] - 32); }
static inline int chars_first(const char* text) { return (int) text[0]; }
#endif
