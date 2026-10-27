/**
 * #2116: 1.3 spells each written `Scope.T` / `Ns.T` once, and stores it on
 * the file's symbols for every later layer to read.
 */
import { describe, expect, it } from "vitest";
import ProgramLowering from "../../../2-Parse/ProgramLowering";
import parse from "./testHelpers";
import CnxResolver from "../index";
import SymbolRegistry from "../../SymbolRegistry";

const namesOf = (
  code: string,
  isCppScopeHead: (name: string) => boolean = () => false,
): ReadonlyMap<string, string> =>
  CnxResolver.resolve(
    ProgramLowering.program(parse(code), null),
    "test.cnx",
    new SymbolRegistry(),
    isCppScopeHead,
  ).qualifiedTypeNames;

describe("QualifiedTypeNames", () => {
  it("spells a cnx scope member's path as its C name", () => {
    const names = namesOf(
      `scope Motor { public struct Config { u8 a; } }\nMotor.Config c;`,
    );
    expect(names.get("Motor.Config")).toBe("Motor__Config");
  });

  it("spells a path whose head is a C++ namespace with ::", () => {
    const names = namesOf(`TestNS.MyClass obj;`, (name) => name === "TestNS");
    expect(names.get("TestNS.MyClass")).toBe("TestNS::MyClass");
  });

  it("records an array's element type", () => {
    const names = namesOf(
      `TestNS.MyClass objs[2];`,
      (name) => name === "TestNS",
    );
    expect(names.get("TestNS.MyClass")).toBe("TestNS::MyClass");
  });

  it("records nothing for a bare or primitive type", () => {
    expect(namesOf(`u8 x;`).size).toBe(0);
  });
});
