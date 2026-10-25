/**
 * Unit tests for CommentExtractor
 * ADR-043: Comment extraction and MISRA validation
 */
import { describe, it, expect, vi } from "vitest";
import { Token } from "antlr4ng";
import CommentExtractor from "../CommentExtractor";
import CommentScanner from "../../../PARSE/2-Parse/CommentScanner";
import { CnxLexer } from "../../../PARSE/2-Parse/grammar/CnxLexer";
import ECommentType from "../../../types/ECommentType";

// Mock token factory
const createToken = (opts: {
  type: number;
  text: string;
  line: number;
  column: number;
  tokenIndex: number;
  channel?: number;
}) => ({
  type: opts.type,
  text: opts.text,
  line: opts.line,
  column: opts.column,
  tokenIndex: opts.tokenIndex,
  channel: opts.channel ?? Token.HIDDEN_CHANNEL,
});

// Mock CommonTokenStream factory - type matches what CommentScanner expects.
//
// #1445: derived from `CommentScanner`, which is what these tests actually
// construct. It was derived from `CommentExtractor` while that class also took
// a stream, so the two agreed by coincidence; `CommentExtractor` now takes the
// comments themselves, and the scanner is threaded explicitly below -- which is
// the #1322 split stated in the test rather than assumed.
type MockStream = ConstructorParameters<typeof CommentScanner>[0];

const createMockStream = (
  tokens: ReturnType<typeof createToken>[],
): MockStream => {
  return {
    fill: vi.fn(),
    size: tokens.length,
    get: (i: number) => tokens[i],
    getHiddenTokensToLeft: vi.fn((idx: number) => {
      const result = [];
      for (let i = idx - 1; i >= 0; i--) {
        if (tokens[i].channel === Token.HIDDEN_CHANNEL) {
          result.unshift(tokens[i]);
        } else {
          break;
        }
      }
      return result.length > 0 ? result : null;
    }),
  } as unknown as MockStream;
};

describe("CommentExtractor", () => {
  // ========================================================================
  // extractAll
  // ========================================================================

  describe("extractAll", () => {
    it("should extract line comments", () => {
      const tokens = [
        createToken({
          type: CnxLexer.LINE_COMMENT,
          text: "// hello world",
          line: 1,
          column: 0,
          tokenIndex: 0,
        }),
      ];
      const stream = createMockStream(tokens);
      const extractor = new CommentScanner(stream);

      const comments = extractor.extractAll();

      expect(comments).toHaveLength(1);
      expect(comments[0].type).toBe(ECommentType.Line);
      expect(comments[0].content).toBe(" hello world");
      expect(comments[0].line).toBe(1);
    });

    it("should extract block comments", () => {
      const tokens = [
        createToken({
          type: CnxLexer.BLOCK_COMMENT,
          text: "/* block comment */",
          line: 1,
          column: 0,
          tokenIndex: 0,
        }),
      ];
      const stream = createMockStream(tokens);
      const extractor = new CommentScanner(stream);

      const comments = extractor.extractAll();

      expect(comments).toHaveLength(1);
      expect(comments[0].type).toBe(ECommentType.Block);
      expect(comments[0].content).toBe(" block comment ");
    });

    it("should extract doc comments", () => {
      const tokens = [
        createToken({
          type: CnxLexer.DOC_COMMENT,
          text: "/// Documentation",
          line: 1,
          column: 0,
          tokenIndex: 0,
        }),
      ];
      const stream = createMockStream(tokens);
      const extractor = new CommentScanner(stream);

      const comments = extractor.extractAll();

      expect(comments).toHaveLength(1);
      expect(comments[0].type).toBe(ECommentType.Doc);
      expect(comments[0].content).toBe("Documentation");
    });

    it("should cache results on subsequent calls", () => {
      const tokens = [
        createToken({
          type: CnxLexer.LINE_COMMENT,
          text: "// test",
          line: 1,
          column: 0,
          tokenIndex: 0,
        }),
      ];
      const stream = createMockStream(tokens);
      const extractor = new CommentScanner(stream);

      const first = extractor.extractAll();
      const second = extractor.extractAll();

      expect(first).toBe(second); // Same reference
      expect(stream.fill).toHaveBeenCalledTimes(1);
    });

    it("should skip non-comment tokens", () => {
      const tokens = [
        createToken({
          type: CnxLexer.WS, // Whitespace
          text: "   ",
          line: 1,
          column: 0,
          tokenIndex: 0,
        }),
        createToken({
          type: CnxLexer.LINE_COMMENT,
          text: "// actual comment",
          line: 1,
          column: 3,
          tokenIndex: 1,
        }),
      ];
      const stream = createMockStream(tokens);
      const extractor = new CommentScanner(stream);

      const comments = extractor.extractAll();

      expect(comments).toHaveLength(1);
      expect(comments[0].content).toBe(" actual comment");
    });

    it("should skip tokens not on hidden channel", () => {
      const tokens = [
        createToken({
          type: CnxLexer.LINE_COMMENT,
          text: "// visible",
          line: 1,
          column: 0,
          tokenIndex: 0,
          channel: Token.DEFAULT_CHANNEL, // Not hidden
        }),
      ];
      const stream = createMockStream(tokens);
      const extractor = new CommentScanner(stream);

      const comments = extractor.extractAll();

      expect(comments).toHaveLength(0);
    });
  });

  // ========================================================================
  // getCommentsBefore
  // ========================================================================

  describe("getCommentsBefore", () => {
    it("should get comments before a token", () => {
      const tokens = [
        createToken({
          type: CnxLexer.DOC_COMMENT,
          text: "/// Function docs",
          line: 1,
          column: 0,
          tokenIndex: 0,
        }),
        createToken({
          type: CnxLexer.IDENTIFIER,
          text: "function",
          line: 2,
          column: 0,
          tokenIndex: 1,
          channel: Token.DEFAULT_CHANNEL,
        }),
      ];
      const stream = createMockStream(tokens);
      const extractor = new CommentScanner(stream);

      const comments = extractor.getCommentsBefore(1);

      expect(comments).toHaveLength(1);
      expect(comments[0].content).toBe("Function docs");
    });

    it("should return empty array when no comments before", () => {
      const tokens = [
        createToken({
          type: CnxLexer.IDENTIFIER,
          text: "x",
          line: 1,
          column: 0,
          tokenIndex: 0,
          channel: Token.DEFAULT_CHANNEL,
        }),
      ];
      const stream = createMockStream(tokens);
      (stream as { getHiddenTokensToLeft: unknown }).getHiddenTokensToLeft =
        vi.fn(() => null);
      const extractor = new CommentScanner(stream);

      const comments = extractor.getCommentsBefore(0);

      expect(comments).toHaveLength(0);
    });

    it("should filter out non-comment hidden tokens (whitespace)", () => {
      const tokens = [
        createToken({
          type: CnxLexer.WS,
          text: "   ",
          line: 1,
          column: 0,
          tokenIndex: 0,
        }),
        createToken({
          type: CnxLexer.IDENTIFIER,
          text: "x",
          line: 1,
          column: 3,
          tokenIndex: 1,
          channel: Token.DEFAULT_CHANNEL,
        }),
      ];
      const stream = createMockStream(tokens);
      const extractor = new CommentScanner(stream);

      const comments = extractor.getCommentsBefore(1);

      // Whitespace token on hidden channel should be filtered out
      expect(comments).toHaveLength(0);
    });
  });

  // ========================================================================
  // validate - MISRA C:2012 Rules 3.1 and 3.2
  // ========================================================================

  describe("validate", () => {
    describe("MISRA Rule 3.1 - nested comment markers", () => {
      it("should detect nested /* in block comment", () => {
        const tokens = [
          createToken({
            type: CnxLexer.BLOCK_COMMENT,
            text: "/* outer /* nested */",
            line: 1,
            column: 0,
            tokenIndex: 0,
          }),
        ];
        const stream = createMockStream(tokens);
        const extractor = new CommentExtractor(
          new CommentScanner(stream).extractAll(),
        );

        const errors = extractor.validate();

        expect(errors).toHaveLength(1);
        expect(errors[0].rule).toBe("3.1");
        expect(errors[0].message).toContain("/*");
      });

      it("should detect nested // in block comment", () => {
        const tokens = [
          createToken({
            type: CnxLexer.BLOCK_COMMENT,
            text: "/* test // nested */",
            line: 1,
            column: 0,
            tokenIndex: 0,
          }),
        ];
        const stream = createMockStream(tokens);
        const extractor = new CommentExtractor(
          new CommentScanner(stream).extractAll(),
        );

        const errors = extractor.validate();

        expect(errors).toHaveLength(1);
        expect(errors[0].rule).toBe("3.1");
        expect(errors[0].message).toContain("//");
      });

      it("should allow :// (URI pattern) in comments", () => {
        const tokens = [
          createToken({
            type: CnxLexer.LINE_COMMENT,
            text: "// See https://example.com",
            line: 1,
            column: 0,
            tokenIndex: 0,
          }),
        ];
        const stream = createMockStream(tokens);
        const extractor = new CommentExtractor(
          new CommentScanner(stream).extractAll(),
        );

        const errors = extractor.validate();

        expect(errors).toHaveLength(0);
      });

      it("should detect nested /* in line comment", () => {
        const tokens = [
          createToken({
            type: CnxLexer.LINE_COMMENT,
            text: "// TODO /* fix this */",
            line: 1,
            column: 0,
            tokenIndex: 0,
          }),
        ];
        const stream = createMockStream(tokens);
        const extractor = new CommentExtractor(
          new CommentScanner(stream).extractAll(),
        );

        const errors = extractor.validate();

        expect(errors).toHaveLength(1);
        expect(errors[0].rule).toBe("3.1");
      });

      it("should detect nested /* in doc comment", () => {
        const tokens = [
          createToken({
            type: CnxLexer.DOC_COMMENT,
            text: "/// /* documentation */",
            line: 1,
            column: 0,
            tokenIndex: 0,
          }),
        ];
        const stream = createMockStream(tokens);
        const extractor = new CommentExtractor(
          new CommentScanner(stream).extractAll(),
        );

        const errors = extractor.validate();

        expect(errors).toHaveLength(1);
        expect(errors[0].rule).toBe("3.1");
      });
    });

    describe("MISRA Rule 3.2 - line-splice in comments", () => {
      it("should detect line ending with backslash in line comment", () => {
        const tokens = [
          createToken({
            type: CnxLexer.LINE_COMMENT,
            text: "// continued \\",
            line: 4,
            column: 12,
            tokenIndex: 0,
          }),
        ];
        const stream = createMockStream(tokens);
        const extractor = new CommentExtractor(
          new CommentScanner(stream).extractAll(),
        );

        const errors = extractor.validate();

        expect(errors).toHaveLength(1);
        expect(errors[0].rule).toBe("3.2");
        expect(errors[0].message).toContain("line-splice");
        // The error points at the comment, not at its trailing backslash
        expect(errors[0].span).toEqual({
          line: 4,
          column: 12,
          endLine: 4,
          endColumn: 26,
        });
      });

      it("should detect line ending with backslash in doc comment", () => {
        const tokens = [
          createToken({
            type: CnxLexer.DOC_COMMENT,
            text: "/// docs \\",
            line: 1,
            column: 0,
            tokenIndex: 0,
          }),
        ];
        const stream = createMockStream(tokens);
        const extractor = new CommentExtractor(
          new CommentScanner(stream).extractAll(),
        );

        const errors = extractor.validate();

        expect(errors).toHaveLength(1);
        expect(errors[0].rule).toBe("3.2");
      });

      it("should not flag block comments for Rule 3.2", () => {
        const tokens = [
          createToken({
            type: CnxLexer.BLOCK_COMMENT,
            text: "/* ends with backslash \\ */",
            line: 1,
            column: 0,
            tokenIndex: 0,
          }),
        ];
        const stream = createMockStream(tokens);
        const extractor = new CommentExtractor(
          new CommentScanner(stream).extractAll(),
        );

        const errors = extractor.validate();

        // Block comments can have backslash, Rule 3.2 only applies to line comments
        expect(errors.filter((e) => e.rule === "3.2")).toHaveLength(0);
      });

      it("should allow backslash in middle of line comment", () => {
        const tokens = [
          createToken({
            type: CnxLexer.LINE_COMMENT,
            text: "// path\\to\\file is fine",
            line: 1,
            column: 0,
            tokenIndex: 0,
          }),
        ];
        const stream = createMockStream(tokens);
        const extractor = new CommentExtractor(
          new CommentScanner(stream).extractAll(),
        );

        const errors = extractor.validate();

        expect(errors).toHaveLength(0);
      });
    });

    describe("multiple errors", () => {
      it("should report multiple violations", () => {
        const tokens = [
          createToken({
            type: CnxLexer.LINE_COMMENT,
            text: "// /* nested */ \\",
            line: 1,
            column: 0,
            tokenIndex: 0,
          }),
        ];
        const stream = createMockStream(tokens);
        const extractor = new CommentExtractor(
          new CommentScanner(stream).extractAll(),
        );

        const errors = extractor.validate();

        expect(errors).toHaveLength(2);
        expect(errors.map((e) => e.rule).sort()).toEqual(["3.1", "3.2"]);
      });
    });
  });

  // ========================================================================
  // Edge cases
  // ========================================================================

  describe("edge cases", () => {
    it("should handle empty token text", () => {
      const tokens = [
        {
          type: CnxLexer.LINE_COMMENT,
          text: null,
          line: 1,
          column: 0,
          tokenIndex: 0,
          channel: Token.HIDDEN_CHANNEL,
        } as unknown as ReturnType<typeof createToken>,
      ];
      const stream = createMockStream(tokens);
      const extractor = new CommentScanner(stream);

      const comments = extractor.extractAll();

      expect(comments).toHaveLength(0);
    });

    it("should handle multiple comments", () => {
      const tokens = [
        createToken({
          type: CnxLexer.DOC_COMMENT,
          text: "/// Line 1",
          line: 1,
          column: 0,
          tokenIndex: 0,
        }),
        createToken({
          type: CnxLexer.DOC_COMMENT,
          text: "/// Line 2",
          line: 2,
          column: 0,
          tokenIndex: 1,
        }),
        createToken({
          type: CnxLexer.LINE_COMMENT,
          text: "// Regular",
          line: 3,
          column: 0,
          tokenIndex: 2,
        }),
      ];
      const stream = createMockStream(tokens);
      const extractor = new CommentScanner(stream);

      const comments = extractor.extractAll();

      expect(comments).toHaveLength(3);
      expect(comments[0].type).toBe(ECommentType.Doc);
      expect(comments[1].type).toBe(ECommentType.Doc);
      expect(comments[2].type).toBe(ECommentType.Line);
    });
  });
});
