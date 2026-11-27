#ifndef OVERLOADED_SEARCH_HPP
#define OVERLOADED_SEARCH_HPP
#include <string.h>
// Both overloads take two arguments, and both return a pointer
inline const char* find_in(const char* text, const char* part) { return strstr(text, part); }
inline const char* find_in(const char* text, char part) { return strchr(text, part); }
#endif
