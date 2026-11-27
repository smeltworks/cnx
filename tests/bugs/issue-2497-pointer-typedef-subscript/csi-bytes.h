/* Helper for pointer-typedef-subscript.test.cnx (#2497): C typedefs that name
   a pointer, with no `*` where cnx spells them. */
#ifndef CSI_BYTES_H
#define CSI_BYTES_H
#include <stdint.h>
typedef const uint8_t *CsiBytes;
typedef CsiBytes CsiBytesAlias; /* a typedef OF a pointer typedef */
typedef uint8_t *CsiMutBytes;
typedef uint32_t csi_reg_t; /* control: an integer typedef keeps its bits */

/* control: a header struct's pointer field, which was already an element */
typedef struct {
    CsiBytes data;
    const uint8_t *raw;
} CsiRecord;

/* a pointer typedef of a struct, whose element has fields */
typedef struct {
    uint8_t x;
    uint8_t y;
} CsiPt;
typedef CsiPt *CsiPtPtr;

static const uint8_t csi_frame_bytes[4] = {0x10U, 0x21U, 0x32U, 0x43U};
static uint8_t csi_scratch_bytes[4];
static CsiPt csi_pts[2] = {{1U, 2U}, {3U, 4U}};

static inline CsiBytes csi_frame(void) { return csi_frame_bytes; }
static inline CsiMutBytes csi_scratch(void) { return csi_scratch_bytes; }
static inline CsiPtPtr csi_points(void) { return csi_pts; }
static inline CsiRecord csi_record(void) {
    CsiRecord r = {csi_frame_bytes, csi_frame_bytes};
    return r;
}
#endif
