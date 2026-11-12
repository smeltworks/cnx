#pragma once
#include <stdint.h>
#include <stddef.h>

// ============================================================================
// SECTION 1: NAMESPACES
// ============================================================================
namespace hw {
    void init();
    void shutdown();
    constexpr int VERSION = 1;
    constexpr int MAX_DEVICES = 8;

    namespace nested {
        void configure();
        constexpr int BUFFER_SIZE = 64;
    }
}

namespace utils {
    int clamp(int val, int min, int max);
}

// ============================================================================
// SECTION 2: ENUMS (All Variations)
// ============================================================================
// C++11 enum class with explicit underlying type
enum class EMode : uint8_t {
    OFF = 0,
    ON = 1,
    AUTO = 2,
    MANUAL = 3
};

// C++11 enum class without explicit type
enum class EColor { RED, GREEN, BLUE, ALPHA };

// C++11 typed enum (not class)
enum EFlags : uint16_t {
    FLAG_NONE = 0,
    FLAG_READ = 1,
    FLAG_WRITE = 2,
    FLAG_EXEC = 4
};

// Traditional C-style enum
enum ELegacy { LEGACY_A, LEGACY_B, LEGACY_C };

// ============================================================================
// SECTION 3: CLASSES WITH STATIC METHODS
// ============================================================================
class CommandHandler {
public:
    static bool execute(uint8_t cmd);
    static int getStatus();
    static void reset();
    static CommandHandler* getInstance();

    // Static factory method returning struct
    struct StatusInfo { int code; bool valid; };
    static StatusInfo getStatusInfo();

private:
    static int _status;
    static CommandHandler* _instance;
};

class MathUtils {
public:
    static constexpr int PI_INT = 3;
    static int abs(int x);
    static int min(int a, int b);
    static int max(int a, int b);

    // Static method with enum parameter
    static EMode computeMode(uint8_t flags);
};

// ============================================================================
// SECTION 4: STRUCTS WITH CONSTRUCTORS
// ============================================================================
struct Result {
    int code;
    const char* message;
    uint8_t data[32];
    size_t dataLen;

    // Default constructor
    Result() : code(0), message(nullptr), data{}, dataLen(0) {}

    // Parameterized constructor
    Result(int c) : code(c), message(nullptr), data{}, dataLen(0) {}

    // Full constructor
    Result(int c, const char* msg) : code(c), message(msg), data{}, dataLen(0) {}

    // Static factory method
    static Result success();
    static Result error(int code);
};

// POD struct (trivial)
struct Point {
    int x;
    int y;
};

// Struct with default member initializers (C++11)
struct Settings {
    bool enabled = false;
    int timeout = 1000;
    EMode mode = EMode::OFF;
};

// ============================================================================
// SECTION 5: TEMPLATES
// ============================================================================
// Simple template class
template<typename T>
class Container {
public:
    T value;
    void set(T v) { value = v; }
    T get() const { return value; }
};

// Template with type and size parameters
template<typename T, int SIZE>
class Buffer {
public:
    T data[SIZE];
    void clear();
    T& get(int idx);
    void set(int idx, T val);
    static constexpr int capacity() { return SIZE; }
};

// Template with multiple non-type parameters (like FlexCAN_T4)
template<int A, int B, int C>
class TripleParam {
public:
    void init();
    void begin();
    void end();
    static constexpr int getA() { return A; }
};

// Common pattern: CAN bus style
constexpr int CAN1 = 1;
constexpr int CAN2 = 2;
constexpr int RX_SIZE_256 = 256;
constexpr int TX_SIZE_16 = 16;

template<int BUS, int RX_SIZE, int TX_SIZE>
class FlexCAN_T4 {
public:
    void begin();
    void end();
    bool write(uint32_t id, const uint8_t* data, uint8_t len);
    bool read(uint32_t& id, uint8_t* data, uint8_t& len);
};

// ============================================================================
// SECTION 6: INHERITANCE AND POLYMORPHISM
// ============================================================================
class Base {
public:
    Base() = default;
    virtual ~Base() = default;
    virtual void process();
    virtual int getValue() const;

protected:
    int value = 0;
};

class Derived : public Base {
public:
    void process() override;
    int getValue() const override;
    void extra();

private:
    int extraValue = 0;
};

// ============================================================================
// SECTION 7: NESTED TYPES
// ============================================================================
class Outer {
public:
    enum class InnerEnum { X, Y, Z };

    struct InnerStruct {
        int val;
        InnerEnum type;
    };

    static InnerStruct create();
    static InnerEnum getDefaultType();

    // Using nested types in method signatures
    void process(InnerEnum e, const InnerStruct& s);
};

// ============================================================================
// SECTION 8: CONSTEXPR AND COMPILE-TIME CONSTANTS
// ============================================================================
constexpr int MAX_SIZE = 256;
constexpr int MIN_SIZE = 16;
constexpr int DEFAULT_TIMEOUT = 5000;
constexpr uint32_t MAGIC_NUMBER = 0xDEADBEEF;

extern const char* const APP_NAME;
extern const char* const VERSION_STRING;

// Constexpr function (C++14)
constexpr int square(int x) { return x * x; }
constexpr int factorial(int n) { return n <= 1 ? 1 : n * factorial(n - 1); }

// ============================================================================
// SECTION 9: FUNCTION OVERLOADS
// ============================================================================
int process(int x);
int process(int x, int y);
float process(float x);
double process(double x);
Result process(const char* str);

// ============================================================================
// SECTION 10: REFERENCES AND POINTERS
// ============================================================================
void modifyRef(int& ref);
void readRef(const int& ref);
void modifyPtr(int32_t* ptr);
void readPtr(const int32_t* ptr);

// ============================================================================
// SECTION 11: COMPLEX STRUCT MEMBERS
// ============================================================================
struct SensorConfig {
    bool enabled;
    EMode mode;
    uint8_t flags;
    EFlags permissions;
};

struct DeviceConfig {
    SensorConfig sensors[4];
    Settings settings;
};

struct Message {
    uint32_t id;
    uint8_t data[8];
    uint8_t length;
    EFlags flags;
    Result result;
};

// ============================================================================
// SECTION 12: SINGLETON AND STATIC MEMBERS
// ============================================================================
class Singleton {
public:
    static Singleton& instance();

    int getValue() const { return value; }
    void setValue(int v) { value = v; }

private:
    Singleton() = default;
    Singleton(const Singleton&) = delete;
    Singleton& operator=(const Singleton&) = delete;

    int value = 0;
};

class Registry {
public:
    static void registerHandler(int id, void(*handler)());
    static void unregisterHandler(int id);
    static void callHandler(int id);
    static int getHandlerCount();

private:
    static int handlerCount;
};

// ============================================================================
// SECTION 13: CALLBACKS
// ============================================================================
using Callback = void(*)();
using IntCallback = void(*)(int);
using ResultCallback = void(*)(const Result&);

void registerCallback(Callback cb);
void registerIntCallback(IntCallback cb);
void registerResultCallback(ResultCallback cb);

// ============================================================================
// SECTION 14: OPERATOR OVERLOADING
// ============================================================================
struct Vector2 {
    float x, y;

    Vector2 operator+(const Vector2& other) const;
    Vector2 operator-(const Vector2& other) const;
    Vector2 operator*(float scalar) const;
    bool operator==(const Vector2& other) const;
    bool operator!=(const Vector2& other) const;
};

// ============================================================================
// SECTION 15: EXPLICIT CONSTRUCTORS AND CONVERSIONS
// ============================================================================
class ExplicitType {
public:
    explicit ExplicitType(int val);
    explicit operator bool() const;
    explicit operator int() const;

private:
    int value;
};

// ============================================================================
// SECTION 16: DELETED AND DEFAULTED FUNCTIONS
// ============================================================================
class NonCopyable {
public:
    NonCopyable() = default;
    ~NonCopyable() = default;
    NonCopyable(const NonCopyable&) = delete;
    NonCopyable& operator=(const NonCopyable&) = delete;
    NonCopyable(NonCopyable&&) = default;
    NonCopyable& operator=(NonCopyable&&) = default;
};

// ============================================================================
// SECTION 17: STRICT INITIALIZATION (Issue #304.3)
// ============================================================================
// These types FAIL with {0} but work with {} - tests correct initialization

// Type with explicit constructor - {0} fails, {} works
struct StrictResult {
    int code;
    const char* message;

    StrictResult() : code(0), message(nullptr) {}
    explicit StrictResult(int c) : code(c), message(nullptr) {}

    static StrictResult success() { return StrictResult(); }
    static StrictResult error(int c) { return StrictResult(c); }
};

// Type requiring multiple constructor args - {0} fails, {} works
struct CommandResult {
    int errorCode;
    const char* errorMessage;
    uint8_t responseData[32];
    size_t responseLen;

    // Only constructor requires 2 args - {0} cannot match
    CommandResult(int code, const char* msg)
        : errorCode(code), errorMessage(msg), responseData{}, responseLen(0) {}

    // Default constructor for {} initialization
    CommandResult() : errorCode(0), errorMessage(nullptr), responseData{}, responseLen(0) {}

    static CommandResult ok() { return CommandResult(); }
    static CommandResult fail(int code, const char* msg) { return CommandResult(code, msg); }
};

// ============================================================================
// SECTION 18: ARRAY PARAMETERS (Issue #304.4)
// ============================================================================
// Functions taking array parameters - tests spurious & detection

// Takes pointer to array data (common embedded pattern)
void sendData(int channel, int errorCode, const uint8_t* data, size_t len);
void receiveData(int channel, uint8_t* data, size_t* len);

// Struct with array that gets passed to functions
struct ResponsePacket {
    int statusCode;
    uint8_t payload[64];
    size_t payloadLen;

    ResponsePacket() : statusCode(0), payload{}, payloadLen(0) {}
};
