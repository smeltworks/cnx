#pragma once
typedef char* (*writable_make)(void);
typedef const char* (*const_make)(void);
inline unsigned int text_measure(char* t) { t[0] = 'X'; return 0U; }
inline unsigned int text_measure(const char* t) {
    unsigned int n = 0U;
    while (t[n] != '\0') {
        n++;
    }
    return n;
}
inline unsigned int make_measure(writable_make make) { make()[0] = 'X'; return 0U; }
inline unsigned int make_measure(const_make make) { return text_measure(make()); }
