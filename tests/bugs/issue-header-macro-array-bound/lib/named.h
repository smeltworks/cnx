#ifndef NAMED_H
#define NAMED_H
#include <stdint.h>
typedef uint32_t word_t;
/* A cast of +3: C reads 3 */
static uint8_t casted[(word_t)+3];
struct Packet {
    enum { PACKET_N = 3 } kind;
};
/* In C an enumerator written inside a struct has file scope: C reads 3 */
static uint8_t packets[PACKET_N];
#define word_t 2
#define PACKET_N 8
#endif
