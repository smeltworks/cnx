#pragma once
#include <stdint.h>

namespace Dev {
struct Reading {
    uint32_t value;
};
Reading read();
extern Reading cfg;
namespace Inner {
extern Reading deep;
}
class Box {
public:
    static Reading shared;
};
enum class Mode { A, B };
}
