#ifndef FRAME_A_HPP
#define FRAME_A_HPP
#include <stdint.h>
/* A Frame with its own enum constant FN, which only frame-reader.cnx's
   compile reads */
struct Frame {
    enum { FN = 3 } kind;
    uint8_t tag;
};
static Frame frameA;
#endif
