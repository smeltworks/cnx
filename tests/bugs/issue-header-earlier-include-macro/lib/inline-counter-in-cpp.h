#ifndef INLINE_COUNTER_IN_CPP_H
#define INLINE_COUNTER_IN_CPP_H
#include <stdint.h>
#ifndef NO_CPP_API_IN_C
class InlineCounter { public: uint8_t data[4]; };
static InlineCounter inlineCounter;
#endif
#endif
