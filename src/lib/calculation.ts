export type CalculationResult = {
  value: number | null;
  warnings: string[];
};

const TOKEN_REGEX = /{{\s*(\d+)\s*}}/g;
const ALLOWED_CHARS = /^[0-9+\-*/().\s]+$/;

export function extractFormulaFieldIds(formula: string) {
  const ids: number[] = [];
  for (const match of formula.matchAll(TOKEN_REGEX)) {
    const id = Number(match[1]);
    if (!Number.isNaN(id)) ids.push(id);
  }
  return ids;
}

export function validateFormulaSyntax(formula: string) {
  if (!formula.trim()) return "계산식을 입력해주세요.";
  const replaced = formula.replace(TOKEN_REGEX, "1");
  if (!ALLOWED_CHARS.test(replaced)) {
    return "계산식에는 숫자, 사칙연산, 괄호, {{필드ID}}만 사용할 수 있습니다.";
  }
  return null;
}

type Token =
  | { type: "number"; value: number }
  | { type: "operator"; value: string }
  | { type: "paren"; value: "(" | ")" };

function tokenize(expression: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expression.length) {
    const char = expression[i];
    if (char === " " || char === "\t" || char === "\n") {
      i += 1;
      continue;
    }

    if ("()+-*/".includes(char)) {
      if (char === "(" || char === ")") {
        tokens.push({ type: "paren", value: char });
      } else {
        tokens.push({ type: "operator", value: char });
      }
      i += 1;
      continue;
    }

    if (char >= "0" && char <= "9" || char === ".") {
      let numStr = char;
      i += 1;
      while (i < expression.length) {
        const next = expression[i];
        if ((next >= "0" && next <= "9") || next === ".") {
          numStr += next;
          i += 1;
        } else {
          break;
        }
      }
      const value = Number(numStr);
      if (Number.isNaN(value)) return null;
      tokens.push({ type: "number", value });
      continue;
    }

    return null;
  }
  return tokens;
}

function toRpn(tokens: Token[]): Token[] | null {
  const output: Token[] = [];
  const stack: Token[] = [];
  const precedence: Record<string, number> = {
    "u-": 3,
    "*": 2,
    "/": 2,
    "+": 1,
    "-": 1,
  };

  let prevType: Token["type"] | "start" = "start";

  for (const token of tokens) {
    if (token.type === "number") {
      output.push(token);
      prevType = "number";
      continue;
    }

    if (token.type === "operator") {
      let op = token.value;
      if (op === "-" && (prevType === "start" || prevType === "operator" || prevType === "paren")) {
        op = "u-";
      }
      while (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top.type !== "operator") break;
        if (precedence[top.value] >= precedence[op]) {
          output.push(stack.pop() as Token);
        } else {
          break;
        }
      }
      stack.push({ type: "operator", value: op });
      prevType = "operator";
      continue;
    }

    if (token.type === "paren") {
      if (token.value === "(") {
        stack.push(token);
        prevType = "paren";
      } else {
        while (stack.length > 0) {
          const top = stack.pop() as Token;
          if (top.type === "paren" && top.value === "(") {
            break;
          }
          output.push(top);
        }
      }
    }
  }

  while (stack.length > 0) {
    const top = stack.pop() as Token;
    if (top.type === "paren") return null;
    output.push(top);
  }

  return output;
}

function evalRpn(tokens: Token[]): CalculationResult {
  const stack: number[] = [];
  for (const token of tokens) {
    if (token.type === "number") {
      stack.push(token.value);
      continue;
    }
    if (token.type === "operator") {
      if (token.value === "u-") {
        const value = stack.pop();
        if (value === undefined) return { value: null, warnings: [] };
        stack.push(-value);
        continue;
      }
      const right = stack.pop();
      const left = stack.pop();
      if (right === undefined || left === undefined) {
        return { value: null, warnings: [] };
      }
      if (token.value === "/" && right === 0) {
        return { value: null, warnings: ["0으로 나누어 결과를 저장하지 않았습니다."] };
      }
      switch (token.value) {
        case "+":
          stack.push(left + right);
          break;
        case "-":
          stack.push(left - right);
          break;
        case "*":
          stack.push(left * right);
          break;
        case "/":
          stack.push(left / right);
          break;
        default:
          return { value: null, warnings: [] };
      }
    }
  }

  if (stack.length !== 1) return { value: null, warnings: [] };
  return { value: stack[0], warnings: [] };
}

export function evaluateFormula(
  formula: string,
  values: Record<number, number | null>
): CalculationResult {
  const referencedIds = extractFormulaFieldIds(formula);
  for (const id of referencedIds) {
    const value = values[id];
    if (value === null || value === undefined) {
      return { value: null, warnings: [] };
    }
  }

  const replaced = formula.replace(TOKEN_REGEX, (_, idValue) => {
    const id = Number(idValue);
    const value = values[id];
    return value === null || value === undefined ? "0" : String(value);
  });

  if (!ALLOWED_CHARS.test(replaced)) {
    return { value: null, warnings: [] };
  }

  const tokens = tokenize(replaced);
  if (!tokens) return { value: null, warnings: [] };

  const rpn = toRpn(tokens);
  if (!rpn) return { value: null, warnings: [] };

  return evalRpn(rpn);
}
