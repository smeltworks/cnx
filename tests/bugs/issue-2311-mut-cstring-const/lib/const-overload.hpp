#pragma once
inline unsigned int text_measure(char* t) { t[0] = 'X'; return 0U; }
inline unsigned int text_measure(const char* t) {
    unsigned int n = 0U;
    while (t[n] != '\0') {
        n++;
    }
    return n;
}
