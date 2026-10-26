import { describe, it, expect, vi } from "vitest";
import PostfixChainBuilder from "../PostfixChainBuilder";
import type TMemberStep from "../../types/TMemberStep";
import IPostfixOperation from "../../types/IPostfixOperation";
import IPostfixChainDeps from "../../types/IPostfixChainDeps";

describe("PostfixChainBuilder", () => {
  /**
   * #1652: an operation carries a COUNT and a THUNK now, not parse nodes. The
   * thunk is `vi.fn()` so the cases can still assert that a member access
   * renders nothing -- which is the ordering property the thunk exists for.
   */
  /** `appliesToRoot` is the chain head's decision (#1994), given here */
  const memberOp = (
    memberName: string,
    appliesToRoot = false,
  ): IPostfixOperation => ({
    memberName,
    appliesToRoot,
    indexCount: 0,
    renderIndexes: vi.fn(() => []),
  });

  const subscriptOp = (...indexes: string[]): IPostfixOperation => ({
    memberName: null,
    appliesToRoot: false,
    indexCount: indexes.length,
    renderIndexes: vi.fn(() => indexes),
  });

  const createMockDeps = (
    overrides: Partial<IPostfixChainDeps> = {},
  ): IPostfixChainDeps => ({
    memberStep: vi.fn((): TMemberStep => ({ kind: "access", separator: "." })),
    ...overrides,
  });

  describe("build", () => {
    it("should return base result when no operations", () => {
      const deps = createMockDeps();
      const result = PostfixChainBuilder.build("foo", "foo", [], deps);
      expect(result).toBe("foo");
    });

    it("should handle single member access", () => {
      const deps = createMockDeps();
      const ops: IPostfixOperation[] = [memberOp("bar", true)];

      const result = PostfixChainBuilder.build("foo", "foo", ops, deps);

      expect(result).toBe("foo.bar");
      expect(deps.memberStep).toHaveBeenCalledWith(true, ["foo", "bar"]);
    });

    it("reads the root from the op, not from its position (#1994)", () => {
      const deps = createMockDeps();
      const ops: IPostfixOperation[] = [memberOp("bar"), memberOp("baz", true)];

      PostfixChainBuilder.build("foo", "foo", ops, deps);

      expect(deps.memberStep).toHaveBeenNthCalledWith(1, false, ["foo", "bar"]);
      expect(deps.memberStep).toHaveBeenNthCalledWith(2, true, [
        "foo",
        "bar",
        "baz",
      ]);
    });

    it("should handle multiple member accesses", () => {
      const deps = createMockDeps();
      const ops: IPostfixOperation[] = [memberOp("bar", true), memberOp("baz")];

      const result = PostfixChainBuilder.build("foo", "foo", ops, deps);

      expect(result).toBe("foo.bar.baz");
      expect(deps.memberStep).toHaveBeenCalledTimes(2);
      // First call is first op
      expect(deps.memberStep).toHaveBeenNthCalledWith(1, true, ["foo", "bar"]);
      // Second call is not first op
      expect(deps.memberStep).toHaveBeenNthCalledWith(2, false, [
        "foo",
        "bar",
        "baz",
      ]);
    });

    it("never renders an index for a member access (#1652)", () => {
      // The reason `renderIndexes` is a thunk. Rendering an index queues a
      // pending temp declaration, so a chain of pure member accesses must
      // queue none -- which an eager `string[]` field could not promise.
      const deps = createMockDeps();
      const ops: IPostfixOperation[] = [memberOp("a", true), memberOp("b")];

      PostfixChainBuilder.build("obj", "obj", ops, deps);

      expect(ops[0].renderIndexes).not.toHaveBeenCalled();
      expect(ops[1].renderIndexes).not.toHaveBeenCalled();
    });

    it("should handle single array subscript", () => {
      const deps = createMockDeps();
      const ops: IPostfixOperation[] = [subscriptOp("0")];

      const result = PostfixChainBuilder.build("arr", "arr", ops, deps);

      expect(result).toBe("arr[0]");
      // #1652: the render is the operation's now, not a dep's.
      expect(ops[0].renderIndexes).toHaveBeenCalledTimes(1);
    });

    it("should handle bit range subscript", () => {
      const deps = createMockDeps();
      const ops: IPostfixOperation[] = [subscriptOp("0", "4")];

      const result = PostfixChainBuilder.build("flags", "flags", ops, deps);

      expect(result).toBe("flags[0, 4]");
      // One call yielding both indexes, not one call per index.
      expect(ops[0].renderIndexes).toHaveBeenCalledTimes(1);
    });

    it("should handle mixed member access and subscript", () => {
      const deps = createMockDeps();
      const ops: IPostfixOperation[] = [
        memberOp("items", true),
        subscriptOp("0"),
        memberOp("value"),
      ];

      const result = PostfixChainBuilder.build("obj", "obj", ops, deps);

      expect(result).toBe("obj.items[0].value");
    });

    it("should use arrow separator for struct params", () => {
      const deps = createMockDeps({
        memberStep: vi.fn(
          (isFirst: boolean): TMemberStep => ({
            kind: "access",
            separator: isFirst ? "->" : ".",
          }),
        ),
      });
      const ops: IPostfixOperation[] = [memberOp("x", true), memberOp("y")];

      const result = PostfixChainBuilder.build("point", "point", ops, deps);

      expect(result).toBe("point->x.y");
    });

    it("joins a scope member through the encoder", () => {
      const deps = createMockDeps({
        memberStep: vi.fn((): TMemberStep => ({ kind: "scope-member" })),
      });
      const ops: IPostfixOperation[] = [memberOp("speed", true)];

      const result = PostfixChainBuilder.build("Motor", "Motor", ops, deps);

      expect(result).toBe("Motor__speed");
    });

    it("should handle empty expressions array gracefully", () => {
      const deps = createMockDeps();
      const ops: IPostfixOperation[] = [subscriptOp()];

      const result = PostfixChainBuilder.build("arr", "arr", ops, deps);

      // No expressions means no subscript added
      expect(result).toBe("arr");
    });
  });
});
