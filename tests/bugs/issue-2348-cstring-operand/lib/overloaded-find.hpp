#ifndef OVERLOADED_FIND_HPP
#define OVERLOADED_FIND_HPP
#include <stdint.h>
#include <string.h>
// One overload returns a pointer, but takes two arguments
inline const char* find(const char* text, const char* part) { return strstr(text, part); }
inline uint32_t find(const char* text) { return (uint32_t) strlen(text); }
#endif
