#ifndef LOG_BUFFER_H
#define LOG_BUFFER_H
#include <stdint.h>
#ifdef LOG_WIDE
extern uint8_t log_buffer[8];
#else
extern uint8_t log_buffer[4];
#endif
#endif
