#ifndef WBASED_HPP
#define WBASED_HPP
#include <stdint.h>
/* g++ reads each width below as its base's enum constant (3), not the later
   macro (4): a base enumerator, a class-template base's, a nested class's */
struct WLimits {
    enum { BW = 3 };
};
struct WBased : WLimits {
    uint32_t mode : BW;
};
template <int K>
struct TWLimits {
    enum { TW = K };
};
struct TWBased : TWLimits<3> {
    uint32_t mode : TW;
};
struct WOuter {
    struct Inner {
        enum { IW = 3 };
    };
};
struct IWBased : WOuter::Inner {
    uint32_t mode : IW;
};
#define BW 4
#define TW 4
#define IW 4
extern WBased wbased;
extern TWBased twbased;
extern IWBased iwbased;
#endif
