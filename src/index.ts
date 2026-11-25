#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

type Value = string | number;

type TokenType =
  | "number"
  | "string"
  | "identifier"
  | "symbol"
  | "newline"
  | "eof";

interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

class LzynxError extends Error {
  constructor(message: string, token: Token) {
    super(`LZYNX error at ${token.line}:${token.column}: ${message}`);
    this.name = "LzynxError";
  }
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  let line = 1;
  let column = 1;

  const add = (type: TokenType, value: string, tokenLine = line, tokenColumn = column) => {
    tokens.push({ type, value, line: tokenLine, column: tokenColumn });
  };

  while (index < source.length) {
    const char = source[index];

    if (char === " " || char === "\t" || char === "\r") {
      index++;
      column++;
      continue;
    }

    if (char === "\n") {
      add("newline", "\\n");
      index++;
      line++;
      column = 1;
      continue;
    }

    if (char === "#") {
      while (index < source.length && source[index] !== "\n") {
        index++;
        column++;
      }
      continue;
    }

    if (/[0-9]/.test(char)) {
      const start = index;
      const startColumn = column;
      while (index < source.length && /[0-9]/.test(source[index])) {
        index++;
        column++;
      }
      if (source[index] === "." && /[0-9]/.test(source[index + 1] ?? "")) {
        index++;
        column++;
        while (index < source.length && /[0-9]/.test(source[index])) {
          index++;
          column++;
        }
      }
      add("number", source.slice(start, index), line, startColumn);
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      const startLine = line;
      const startColumn = column;
      index++;
      column++;
      let value = "";
      let closed = false;

      while (index < source.length) {
        const current = source[index];
        if (current === quote) {
          index++;
          column++;
          closed = true;
          break;
        }
        if (current === "\n") {
          throw new LzynxError("Text strings cannot cross lines.", {
            type: "string",
            value,
            line: startLine,
            column: startColumn
          });
        }
        if (current === "\\") {
          const escaped = source[index + 1];
          const escapes: Record<string, string> = {
            n: "\n",
            t: "\t",
            r: "\r",
            "\\": "\\",
            '"': '"',
            "'": "'"
          };
          if (escaped === undefined) {
            throw new LzynxError("Incomplete escape sequence.", {
              type: "string",
              value,
              line,
              column
            });
          }
          value += escapes[escaped] ?? escaped;
          index += 2;
          column += 2;
          continue;
        }
        value += current;
        index++;
        column++;
      }

      if (!closed) {
        throw new LzynxError("Unclosed text string.", {
          type: "string",
          value,
          line: startLine,
          column: startColumn
        });
      }
      add("string", value, startLine, startColumn);
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const start = index;
      const startColumn = column;
      while (index < source.length && /[A-Za-z0-9_]/.test(source[index])) {
        index++;
        column++;
      }
      add("identifier", source.slice(start, index), line, startColumn);
      continue;
    }

    if ("=+-*/(),".includes(char)) {
      add("symbol", char);
      index++;
      column++;
      continue;
    }

    throw new LzynxError(`Unexpected character "${char}".`, {
      type: "symbol",
      value: char,
      line,
      column
    });
  }

  tokens.push({ type: "eof", value: "", line, column });
  return tokens;
}

class Interpreter {
  private position = 0;
  private readonly variables = new Map<string, Value>();

  constructor(private readonly tokens: Token[]) {}

  run(): void {
    while (!this.isAtEnd()) {
      if (this.match("newline")) continue;
      this.statement();
      if (!this.isAtEnd() && !this.check("newline")) {
        throw new LzynxError("Expected a new line after this statement.", this.peek());
      }
    }
  }

  private statement(): void {
    const name = this.consume("identifier", "Expected a command or variable name.");

    if (name.value === "say" && this.matchSymbol("(")) {
      const value = this.expression();
      this.consumeSymbol(")", 'Expected ")" after the value.');
      console.log(this.stringify(value));
      return;
    }

    if (this.matchSymbol("=")) {
      const value = this.expression();
      this.variables.set(name.value, value);
      return;
    }

    throw new LzynxError(
      `Unknown command "${name.value}". In version 0.1.0, use say(...) or variable = value.`,
      name
    );
  }

  private expression(): Value {
    return this.addition();
  }

  private addition(): Value {
    let value = this.multiplication();

    while (this.matchSymbol("+") || this.matchSymbol("-")) {
      const operator = this.previous().value;
      const right = this.multiplication();

      if (operator === "+" && (typeof value === "string" || typeof right === "string")) {
        value = this.stringify(value) + this.stringify(right);
      } else {
        this.requireNumbers(value, right, this.previous());
        value = operator === "+"
          ? (value as number) + (right as number)
          : (value as number) - (right as number);
      }
    }

    return value;
  }

  private multiplication(): Value {
    let value = this.primary();

    while (this.matchSymbol("*") || this.matchSymbol("/")) {
      const operator = this.previous().value;
      const right = this.primary();
      this.requireNumbers(value, right, this.previous());

      if (operator === "/" && right === 0) {
        throw new LzynxError("Cannot divide by zero.", this.previous());
      }

      value = operator === "*"
        ? (value as number) * (right as number)
        : (value as number) / (right as number);
    }

    return value;
  }

  private primary(): Value {
    if (this.match("number")) return Number(this.previous().value);
    if (this.match("string")) return this.previous().value;

    if (this.matchSymbol("(")) {
      const value = this.expression();
      this.consumeSymbol(")", 'Expected ")" after the expression.');
      return value;
    }

    if (this.match("identifier")) {
      const token = this.previous();
      const value = this.variables.get(token.value);
      if (value === undefined) {
        throw new LzynxError(`Variable "${token.value}" does not exist.`, token);
      }
      return value;
    }

    throw new LzynxError("Expected a number, text, variable, or expression.", this.peek());
  }

  private requireNumbers(left: Value, right: Value, token: Token): void {
    if (typeof left !== "number" || typeof right !== "number") {
      throw new LzynxError("This math operation only accepts numbers.", token);
    }
  }

  private stringify(value: Value): string {
    return String(value);
  }

  private match(type: TokenType): boolean {
    if (!this.check(type)) return false;
    this.advance();
    return true;
  }

  private matchSymbol(symbol: string): boolean {
    if (!this.check("symbol") || this.peek().value !== symbol) return false;
    this.advance();
    return true;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new LzynxError(message, this.peek());
  }

  private consumeSymbol(symbol: string, message: string): Token {
    if (this.matchSymbol(symbol)) return this.previous();
    throw new LzynxError(message, this.peek());
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.position++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === "eof";
  }

  private peek(): Token {
    return this.tokens[this.position];
  }

  private previous(): Token {
    return this.tokens[this.position - 1];
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] === "run" ? args[0] : "run";
  const file = args[0] === "run" ? args[1] : args[0];

  if (args[0] === "--version" || args[0] === "-v") {
    console.log("LZYNX 0.2.0");
    return;
  }

  if (!file || args[0] === "--help" || args[0] === "-h") {
    console.log("LZYNX 0.2.0");
    console.log("");
    console.log("Commands:");
    console.log("  lzn run <file.lzn>   Execute a LZYNX program");
    console.log("  lzn --version        Show version");
    console.log("");
    console.log("Example: lzn run examples/hello.lzn");
    if (!file && args.length > 0) process.exitCode = 1;
    return;
  }

  try {
    const source = await readFile(resolve(file), "utf8");
    const interpreter = new Interpreter(tokenize(source));
    interpreter.run();
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error("An unknown error occurred.");
    }
    process.exitCode = 1;
  }
}

await main();
