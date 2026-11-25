#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { resolve } from "node:path";

type Value = string | number | boolean;
type TokenType = "number" | "string" | "identifier" | "symbol" | "newline" | "indent" | "dedent" | "eof";
interface Token { type: TokenType; value: string; line: number; column: number; }

class LzynxError extends Error {
  constructor(message: string, token: Token) {
    super("LZYNX error at " + token.line + ":" + token.column + ": " + message);
    this.name = "LzynxError";
  }
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const indents = [0];
  let i = 0, line = 1, column = 1, lineStart = true;
  const add = (type: TokenType, value: string, ln = line, col = column) =>
    tokens.push({ type, value, line: ln, column: col });

  while (i < source.length) {
    if (lineStart) {
      let width = 0;
      while (source[i] === " " || source[i] === "\t") {
        width += source[i] === "\t" ? 4 : 1;
        i++; column++;
      }
      if (source[i] === "\n") {
        add("newline", "\\n");
        i++; line++; column = 1;
        continue;
      }
      if (source[i] === "#") {
        while (i < source.length && source[i] !== "\n") { i++; column++; }
        continue;
      }
      if (i >= source.length) break;
      const current = indents[indents.length - 1];
      if (width > current) {
        indents.push(width);
        add("indent", "", line, 1);
      } else if (width < current) {
        while (indents.length > 1 && width < indents[indents.length - 1]) {
          indents.pop();
          add("dedent", "", line, 1);
        }
        if (width !== indents[indents.length - 1]) {
          throw new LzynxError("Indentation does not match an outer block.", { type: "symbol", value: "", line, column: 1 });
        }
      }
      lineStart = false;
    }

    const ch = source[i];
    if (ch === " " || ch === "\t" || ch === "\r") { i++; column++; continue; }
    if (ch === "\n") {
      add("newline", "\\n");
      i++; line++; column = 1; lineStart = true;
      continue;
    }
    if (ch === "#") {
      while (i < source.length && source[i] !== "\n") { i++; column++; }
      continue;
    }
    if (/[0-9]/.test(ch)) {
      const start = i, startCol = column;
      while (/[0-9]/.test(source[i] ?? "")) { i++; column++; }
      if (source[i] === "." && /[0-9]/.test(source[i + 1] ?? "")) {
        i++; column++;
        while (/[0-9]/.test(source[i] ?? "")) { i++; column++; }
      }
      add("number", source.slice(start, i), line, startCol);
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch, startLine = line, startCol = column;
      i++; column++;
      let value = "", closed = false;
      while (i < source.length) {
        const c = source[i];
        if (c === quote) { i++; column++; closed = true; break; }
        if (c === "\n") throw new LzynxError("Text strings cannot cross lines.", { type: "string", value, line: startLine, column: startCol });
        if (c === "\\") {
          const next = source[i + 1];
          if (next === undefined) throw new LzynxError("Incomplete escape sequence.", { type: "string", value, line, column });
          const map: Record<string, string> = { n: "\n", t: "\t", r: "\r", "\\": "\\", '"': '"', "'": "'" };
          value += map[next] ?? next; i += 2; column += 2; continue;
        }
        value += c; i++; column++;
      }
      if (!closed) throw new LzynxError("Unclosed text string.", { type: "string", value, line: startLine, column: startCol });
      add("string", value, startLine, startCol);
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const start = i, startCol = column;
      while (/[A-Za-z0-9_]/.test(source[i] ?? "")) { i++; column++; }
      add("identifier", source.slice(start, i), line, startCol);
      continue;
    }
    const two = source.slice(i, i + 2);
    if ([">=", "<=", "==", "!="].includes(two)) {
      add("symbol", two); i += 2; column += 2; continue;
    }
    if ("=+-*/(),:><.".includes(ch)) {
      add("symbol", ch); i++; column++; continue;
    }
    throw new LzynxError('Unexpected character "' + ch + '".', { type: "symbol", value: ch, line, column });
  }
  while (indents.length > 1) { indents.pop(); add("dedent", "", line, column); }
  tokens.push({ type: "eof", value: "", line, column });
  return tokens;
}

interface UIElement { kind: "title" | "text" | "button"; value: string; url?: string; }

class Interpreter {
  private position = 0;
  private readonly variables = new Map<string, Value>();
  readonly uiElements: UIElement[] = [];
  constructor(private readonly tokens: Token[], private readonly visualMode = false) {}

  run(): void {
    while (!this.isAtEnd()) {
      if (this.match("newline")) continue;
      this.statement(true);
      if (!this.isAtEnd() && !this.check("newline") && !this.check("dedent")) {
        throw new LzynxError("Expected a new line after this statement.", this.peek());
      }
    }
  }

  private statement(execute: boolean): void {
    const name = this.consume("identifier", "Expected a command or variable name.");
    if (name.value === "if") { this.ifStatement(execute); return; }
    if (name.value === "else") throw new LzynxError('Unexpected "else". It must follow an if block.', name);
    if (["title", "text", "button"].includes(name.value) && this.matchSymbol("(")) {
      const label = this.expression();
      this.consumeSymbol(")", 'Expected ")" after the visual element text.');
      if (typeof label !== "string") throw new LzynxError("Visual elements require text inside quotes.", name);
      let url: string | undefined;
      if (name.value === "button" && this.matchSymbol(".")) {
        const method = this.consume("identifier", 'Expected "open" after the button.');
        if (method.value !== "open") throw new LzynxError('Unknown button method "' + method.value + '".', method);
        this.consumeSymbol("(", 'Expected "(" after button.open.');
        const destination = this.expression();
        this.consumeSymbol(")", 'Expected ")" after the button link.');
        if (typeof destination !== "string") throw new LzynxError("The button link must be text inside quotes.", method);
        url = destination;
      }
      if (execute && this.visualMode) this.uiElements.push({ kind: name.value as UIElement["kind"], value: label, url });
      return;
    }
    if (name.value === "say" && this.matchSymbol("(")) {
      const value = this.expression();
      this.consumeSymbol(")", 'Expected ")" after the value.');
      if (execute) console.log(this.stringify(value));
      return;
    }
    if (this.matchSymbol("=")) {
      const value = this.expression();
      if (execute) this.variables.set(name.value, value);
      return;
    }
    throw new LzynxError('Unknown command "' + name.value + '". Use say(...), variable = value, or if.', name);
  }

  private ifStatement(execute: boolean): void {
    const conditionToken = this.peek();
    const condition = this.expression();
    if (typeof condition !== "boolean") {
      throw new LzynxError("An if condition must use a comparison such as age >= 18.", conditionToken);
    }
    this.consumeSymbol(":", 'Expected ":" after the if condition.');
    const runThen = execute && condition;
    this.block(runThen);
    this.skipNewlines();
    if (this.check("identifier") && this.peek().value === "else") {
      this.advance();
      this.consumeSymbol(":", 'Expected ":" after else.');
      this.block(execute && !condition);
    }
  }

  private block(execute: boolean): void {
    this.consume("newline", "Expected a new line after ':'.");
    this.skipNewlines();
    this.consume("indent", "Expected an indented block after ':'.");
    while (!this.check("dedent") && !this.isAtEnd()) {
      if (this.match("newline")) continue;
      this.statement(execute);
      if (!this.check("newline") && !this.check("dedent") && !this.isAtEnd()) {
        throw new LzynxError("Expected a new line inside this block.", this.peek());
      }
    }
    this.consume("dedent", "Expected the end of the indented block.");
  }

  private skipNewlines(): void { while (this.match("newline")) { /* skip blank lines */ } }

  private expression(): Value { return this.comparison(); }

  private comparison(): Value {
    let left = this.addition();
    while (["==", "!=", ">", "<", ">=", "<="].some(op => this.checkSymbol(op))) {
      const op = this.advance().value;
      const right = this.addition();
      if (op === "==" || op === "!=") {
        const equal = typeof left === typeof right && left === right;
        left = op === "==" ? equal : !equal;
      } else {
        if (typeof left === "number" && typeof right === "number") {
          if (op === ">") left = left > right;
          else if (op === "<") left = left < right;
          else if (op === ">=") left = left >= right;
          else left = left <= right;
        } else if (typeof left === "string" && typeof right === "string") {
          if (op === ">") left = left > right;
          else if (op === "<") left = left < right;
          else if (op === ">=") left = left >= right;
          else left = left <= right;
        } else {
          throw new LzynxError("Comparison requires two numbers or two text values.", this.previous());
        }
      }
    }
    return left;
  }

  private addition(): Value {
    let value = this.multiplication();
    while (this.matchSymbol("+") || this.matchSymbol("-")) {
      const op = this.previous().value, right = this.multiplication();
      if (op === "+" && (typeof value === "string" || typeof right === "string")) value = this.stringify(value) + this.stringify(right);
      else {
        this.requireNumbers(value, right, this.previous());
        value = op === "+" ? (value as number) + (right as number) : (value as number) - (right as number);
      }
    }
    return value;
  }

  private multiplication(): Value {
    let value = this.primary();
    while (this.matchSymbol("*") || this.matchSymbol("/")) {
      const op = this.previous().value, right = this.primary();
      this.requireNumbers(value, right, this.previous());
      if (op === "/" && right === 0) throw new LzynxError("Cannot divide by zero.", this.previous());
      value = op === "*" ? (value as number) * (right as number) : (value as number) / (right as number);
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
      if (token.value === "true") return true;
      if (token.value === "false") return false;
      const value = this.variables.get(token.value);
      if (value === undefined) throw new LzynxError('Variable "' + token.value + '" does not exist.', token);
      return value;
    }
    throw new LzynxError("Expected a number, text, variable, or expression.", this.peek());
  }

  private requireNumbers(a: Value, b: Value, token: Token): void {
    if (typeof a !== "number" || typeof b !== "number") throw new LzynxError("This math operation only accepts numbers.", token);
  }
  private stringify(value: Value): string { return String(value); }
  private match(type: TokenType): boolean { if (!this.check(type)) return false; this.advance(); return true; }
  private matchSymbol(value: string): boolean { if (!this.checkSymbol(value)) return false; this.advance(); return true; }
  private checkSymbol(value: string): boolean { return this.check("symbol") && this.peek().value === value; }
  private consume(type: TokenType, message: string): Token { if (this.check(type)) return this.advance(); throw new LzynxError(message, this.peek()); }
  private consumeSymbol(value: string, message: string): Token { if (this.matchSymbol(value)) return this.previous(); throw new LzynxError(message, this.peek()); }
  private check(type: TokenType): boolean { return this.peek().type === type; }
  private advance(): Token { if (!this.isAtEnd()) this.position++; return this.previous(); }
  private isAtEnd(): boolean { return this.peek().type === "eof"; }
  private peek(): Token { return this.tokens[this.position]; }
  private previous(): Token { return this.tokens[this.position - 1]; }
}


function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}

function renderHtml(elements: UIElement[], sourceName: string): string {
  const pageTitle = elements.find((element) => element.kind === "title")?.value ?? sourceName;
  const body = elements.map((element) => {
    const value = escapeHtml(element.value);
    if (element.kind === "title") return "<h1>" + value + "</h1>";
    if (element.kind === "text") return "<p>" + value + "</p>";
    if (element.url) return '<a class="button" href="' + escapeHtml(element.url) + '" target="_blank" rel="noopener noreferrer">' + value + "</a>";
    return '<button type="button">' + value + "</button>";
  }).join("\n    ");
  return [
    "<!doctype html>",
    '<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>" + escapeHtml(pageTitle) + "</title>",
    "<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:48px 20px;background:#100b1c;color:#f7f2ff;font-family:system-ui,sans-serif}main{width:min(100%,720px);margin:0 auto;padding:32px;border:1px solid #392653;border-radius:20px;background:#1a1228}h1{margin:0 0 18px;color:#c9a7ff;font-size:clamp(28px,6vw,42px)}p{color:#ded4eb;line-height:1.7}button,.button{display:inline-block;margin:8px 8px 0 0;padding:12px 20px;border:0;border-radius:12px;background:#7c3aed;color:white;font:inherit;font-weight:650;text-decoration:none;cursor:pointer}button:hover,.button:hover{background:#9258f4}</style>",
    "</head><body><main>",
    body,
    "</main></body></html>"
  ].join("\n");
}

async function createFile(name: string): Promise<void> {
  if (!name.trim()) {
    console.error("Informe o nome do arquivo. Exemplo: create.file hello");
    process.exitCode = 1;
    return;
  }

  const fileName = name.endsWith(".lzn") ? name : name + ".lzn";
  const filePath = resolve(fileName);
  const lines: string[] = [];
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "lzn > "
  });

  console.log("Editor LZYNX — " + fileName);
  console.log("Digite seu código. Comandos: :save para salvar | :cancel para cancelar");
  terminal.prompt();

  let shouldSave = false;
  for await (const line of terminal) {
    if (line.trim() === ":save") {
      shouldSave = true;
      break;
    }
    if (line.trim() === ":cancel") break;
    lines.push(line);
    terminal.prompt();
  }
  terminal.close();

  if (!shouldSave) {
    console.log("Criação cancelada. Nenhum arquivo foi salvo.");
    return;
  }

  try {
    await writeFile(filePath, lines.length ? lines.join("\n") + "\n" : "", { encoding: "utf8", flag: "wx" });
    console.log("Arquivo criado: " + fileName);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
      console.error("Esse arquivo já existe. Nada foi sobrescrito.");
    } else {
      console.error(error instanceof Error ? error.message : "Não foi possível salvar o arquivo.");
    }
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === "--version" || args[0] === "-v") { console.log("LZYNX 0.0.4"); return; }
  if (args[0] === "--help" || args[0] === "-h" || args.length === 0) {
    console.log("LZYNX 0.0.4");
    console.log("Usage: lzn run <file.lzn>");
    console.log("       lzn build <file.lzn>");
    console.log("       lzn <file.lzn>");
    console.log("       create.file <file name>");
    console.log("       lzn --version");
    if (args.length === 0) process.exitCode = 1;
    return;
  }
  const invokedAsCreateFile = process.argv[1]?.split(/[\\/]/).pop() === "create.file";
  if (invokedAsCreateFile) { await createFile(args.join(" ")); return; }
  if (args[0] === "create.file") { await createFile(args.slice(1).join(" ")); return; }
  const buildMode = args[0] === "build";
  const file = (args[0] === "run" || buildMode) ? args[1] : args[0];
  if (!file) { console.error("Missing program file. Usage: lzn run <file.lzn>"); process.exitCode = 1; return; }
  try {
    const source = await readFile(resolve(file), "utf8");
    const interpreter = new Interpreter(tokenize(source), buildMode);
    interpreter.run();
    if (buildMode) {
      const output = resolve(file.replace(/\.lzn$/i, "") + ".html");
      const sourceName = file.split(/[\\/]/).pop()?.replace(/\.lzn$/i, "") ?? "LZYNX App";
      await writeFile(output, renderHtml(interpreter.uiElements, sourceName), "utf8");
      console.log("Visual criado: " + output);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "An unknown error occurred.");
    process.exitCode = 1;
  }
}
await main();
