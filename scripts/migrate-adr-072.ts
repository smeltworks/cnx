/**
 * ADR-072 Part 1 migration (#2449): rewrite the ADR-004 register form
 *
 *   register GPIO @ 0x40000000 {
 *       DR: u32 rw @ 0x00,
 *   }
 *
 * into a register type and an instance that keeps the old name, so the
 * generated C (`GPIO__DR`) does not change:
 *
 *   register GpioPort {
 *       0x00 rw u32 DR,
 *   }
 *
 *   GpioPort GPIO(0x40000000);
 *
 * Type names are hand-picked (TYPE_NAMES); an unmapped register is reported
 * and its file left alone.
 *
 * Usage: npx tsx scripts/migrate-adr-072.ts [--check] <file-or-dir>...
 * (`.cnx` sources and `.md` docs)
 */
// cspell:ignore Regs PERIPH OWNREG LREG
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TYPE_NAMES: Record<string, string> = {
  GPIO: "GpioPort",
  GPIO7: "GpioPort",
  GPIOA: "GpioPort",
  GPIOB: "GpioPort",
  Gpio: "GpioPort",
  Port: "PortPins",
  PORT: "PortPins",
  Pins: "PortPins",
  G: "GpioPort",
  UART: "UartPort",
  TIMER: "Timer",
  TIMER64: "Timer64",
  SysTick: "SysTickTimer",
  STATUS_REG: "StatusBlock",
  STATUS: "StatusBlock",
  Regs: "RegisterBlock",
  REG32: "Register32",
  R: "Peripheral",
  PWM: "PwmChannel",
  PERIPH: "Peripheral",
  OWNREG: "OwnedBlock",
  OREG: "OutputBlock",
  MOTOR: "MotorController",
  LREG: "LoopBlock",
  LOOP_REG: "LoopBlock",
  INT: "InterruptController",
  HW: "Hardware",
  EXPR: "ExprBlock",
  DREG: "DeviceBlock",
  DEV: "Device",
  Control: "ControlBlock",
  CTRL: "ControlBlock",
  CONTROL_REG: "ControlBlock",
  CONFIG: "ConfigBlock",
  NVIC: "NVIC_Type",
  Leds: "LedBank",
  VectorTable: "VectorTableLayout",
  NVIC_IPR: "NvicPriority",
  MOTOR_REG: "MotorController",
  RCC: "RCC_Type",
};

const REGISTER =
  /^([ \t]*)((?:public|private)[ \t]+)?register[ \t]+([A-Za-z_]\w*)[ \t]*@[ \t]*([^{\n]+?)[ \t]*\{([\s\S]*?)^\1\}/gm;
const MEMBER =
  /^([ \t]*)([A-Za-z_]\w*)[ \t]*:[ \t]*([^\s@]+(?:<[^>]*>)?)[ \t]+(rw|ro|wo|w1c|w1s)[ \t]*@[ \t]*([^,\n]+?)[ \t]*(,?)([ \t]*\/\/[^\n]*)?$/gm;

class MigrateAdr072 {
  static files(paths: string[]): string[] {
    return paths.flatMap((path) =>
      statSync(path).isDirectory()
        ? MigrateAdr072.files(
            readdirSync(path).map((entry) => join(path, entry)),
          )
        : path.endsWith(".cnx") || path.endsWith(".md")
          ? [path]
          : [],
    );
  }

  static rewrite(source: string, unmapped: Set<string>): string {
    const layouts = new Map<string, string>();
    return source.replace(
      REGISTER,
      (
        whole,
        indent: string,
        visibility: string | undefined,
        name: string,
        address: string,
        body: string,
      ) => {
        const shown = visibility ?? "";
        const type = TYPE_NAMES[name];
        if (type === undefined) {
          unmapped.add(name);
          return whole;
        }
        const members = body.replace(
          MEMBER,
          (_m, pad, member, memberType, access, offset, comma, comment) =>
            `${pad}${offset} ${access} ${memberType} ${member}${comma}${comment ?? ""}`,
        );
        const instance = `${indent}${shown}${type} ${name}(${address});`;
        // Only a file-level type is shared; a scope declares its own
        const seen = indent === "" ? layouts.get(type) : undefined;
        if (seen === members) return instance;
        if (seen !== undefined) {
          unmapped.add(`${name} (layout differs from another ${type})`);
          return whole;
        }
        layouts.set(type, members);
        return `${indent}${shown}register ${type} {${members}${indent}}\n\n${instance}`;
      },
    );
  }

  static main(argv: string[]): void {
    const check = argv.includes("--check");
    const paths = argv.filter((arg) => arg !== "--check");
    const unmapped = new Map<string, string[]>();
    for (const file of MigrateAdr072.files(paths)) {
      const source = readFileSync(file, "utf8");
      const missing = new Set<string>();
      // Each fenced block of a doc is its own program
      const migrated = file.endsWith(".md")
        ? source
            .split(/(^```.*$)/m)
            .map((block) => MigrateAdr072.rewrite(block, missing))
            .join("")
        : MigrateAdr072.rewrite(source, missing);
      for (const name of missing) {
        unmapped.set(name, [...(unmapped.get(name) ?? []), file]);
      }
      if (!check && missing.size === 0 && migrated !== source) {
        writeFileSync(file, migrated);
      }
    }
    for (const [name, files] of unmapped) {
      console.log(`unmapped ${name}: ${files.join(" ")}`);
    }
  }
}

MigrateAdr072.main(process.argv.slice(2));
