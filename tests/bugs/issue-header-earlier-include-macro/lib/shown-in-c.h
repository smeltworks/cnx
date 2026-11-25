#ifndef SHOWN_IN_C_H
#define SHOWN_IN_C_H
#include <stdint.h>
typedef void (*count_fn)(uint32_t value);
static inline void apply_count(count_fn fn) {
    fn(7);
}
#ifndef HIDE_IN_CPP
class ShownInC {
public:
    int x;
};
#endif
#endif
