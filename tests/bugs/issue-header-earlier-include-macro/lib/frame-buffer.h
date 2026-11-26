#ifndef FRAME_BUFFER_H
#define FRAME_BUFFER_H
#include <stdint.h>
#ifdef FRAME_WIDE
extern uint8_t frame[8];
#else
extern uint8_t frame[4];
#endif
#endif
