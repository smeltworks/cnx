#ifndef PACKET_HPP
#define PACKET_HPP
#include <stdint.h>
/* g++ reads each bound's N as its enum constant (3), not the later macro (8):
   Packet's own, then the file-scope one */
struct Packet {
    enum { N = 3 } kind;
    uint8_t data[N];
};
namespace wire {
enum { WIRE_N = 3 };
}
enum { TOP_N = 3 };
static uint8_t table[TOP_N];
static uint8_t wired[wire::WIRE_N];
#define N 8
#define TOP_N 8
extern Packet packet;
#endif
