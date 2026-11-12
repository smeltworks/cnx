#ifndef WIDGET_H
#define WIDGET_H
#include <stdint.h>

typedef struct _widget_t {
    int32_t dummy;  // Make it a concrete type for testing
} widget_t;

typedef struct {
    int32_t x1, y1, x2, y2;
} rect_t;

typedef void (*flush_cb_t)(widget_t *w, const rect_t *area, uint8_t *buf);

// Test state variables
static flush_cb_t registered_cb = 0;
static widget_t *last_widget = 0;
static const void *last_data = 0;
static int32_t last_x1 = 0, last_y1 = 0, last_x2 = 0, last_y2 = 0;

// Inline test implementations
static inline void register_flush(flush_cb_t cb) {
    registered_cb = cb;
}

static inline void flush_ready(widget_t *w) {
    last_widget = w;
}

static inline void draw_bitmap(void *handle, int32_t x1, int32_t y1, int32_t x2, int32_t y2, const void *data) {
    (void)handle;
    last_x1 = x1;
    last_y1 = y1;
    last_x2 = x2;
    last_y2 = y2;
    last_data = data;
}

// #2117: whether the callback forwarded this widget, since cnx has no `&`
static inline int32_t was_last_widget(const widget_t *w) {
    return last_widget == w ? 1 : 0;
}

// Helper to invoke the registered callback
static inline int32_t invoke_registered_cb(widget_t *w, const rect_t *area, uint8_t *buf) {
    if (registered_cb == 0) return 0;
    registered_cb(w, area, buf);
    return 1;
}
#endif
