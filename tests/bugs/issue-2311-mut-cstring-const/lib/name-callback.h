#ifndef NAME_CALLBACK_H
#define NAME_CALLBACK_H
typedef const char* name_text_t;
typedef name_text_t (*name_fn)(void);
static inline unsigned int name_length(name_fn f) {
    const char* text = f();
    unsigned int length = 0U;
    while (text[length] != '\0') {
        length++;
    }
    return length;
}
#endif
