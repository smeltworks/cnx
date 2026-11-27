#ifndef TAGGED_HPP
#define TAGGED_HPP
#include <stdint.h>
/* A class or a namespace names nothing a bound reads */
class LANE_COUNT {
public:
    uint8_t unused;
};
namespace SLOT_COUNT {
}
#define LANE_COUNT 2
#define SLOT_COUNT 5
static uint8_t lanes[LANE_COUNT];
static uint8_t spots5[SLOT_COUNT];
#endif
