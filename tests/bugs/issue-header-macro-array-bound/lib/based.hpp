#ifndef BASED_HPP
#define BASED_HPP
#include <stdint.h>
/* g++ reads each bound below as its base's enum constant (3), not the later
   macro (8): a base enumerator, a class-template base's, a nested class's */
struct Limits {
    enum { BN = 3 };
};
struct Based : Limits {
    uint8_t data[BN];
};
template <int K>
struct TLimits {
    enum { TN = K };
};
struct TBased : TLimits<3> {
    uint8_t data[TN];
};
struct Outer {
    struct Inner {
        enum { IN = 3 };
    };
};
struct IBased : Outer::Inner {
    uint8_t data[IN];
};
/* A base that declares nothing leaves the macro as C reads it: 8 */
#define PN 8
struct Plain {
    uint8_t tag;
};
struct PBased : Plain {
    uint8_t data[PN];
};
#define BN 8
#define TN 8
#define IN 8
extern Based based;
extern TBased tbased;
extern IBased ibased;
extern PBased pbased;
#endif
