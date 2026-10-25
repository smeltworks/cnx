#ifndef HEADER_CLASS_OPERATOR_HPP
#define HEADER_CLASS_OPERATOR_HPP

struct Vec2 {
    float x;
    float y;
    Vec2 operator+(const Vec2& other) const {
        Vec2 r = {x + other.x, y + other.y};
        return r;
    }
    bool operator<(const Vec2& other) const { return x < other.x; }
};

#endif
