#ifndef CPP_OPS_HPP
#define CPP_OPS_HPP
class Ops {
public:
    int op(int a, int b = 0);
    void op();
    template <typename T> void op(T a, T b, T c) {}
};
#endif
