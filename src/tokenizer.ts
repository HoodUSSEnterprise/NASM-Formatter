/**
 * NASM 词法分析器模块
 *
 * 将 NASM 汇编源代码逐行拆分为词法单元（Token）序列。
 * 采用逐字符扫描的有限状态自动机实现，完整支持 NASM 语法元素。
 */

import { isWhitespace, isAlpha, isDigit, isAlphanumeric } from './utils';

/**
 * 词法单元类型枚举
 *
 * 定义了 NASM 源代码中所有可能的词法元素类型。
 */
export enum TokenType {
    /** 空白字符（空格、制表符） */
    Whitespace = 'Whitespace',
    /** 注释（分号开头到行尾） */
    Comment = 'Comment',
    /** 字符串字面量（单引号或双引号括起） */
    String = 'String',
    /** 整数数值字面量（十进制、十六进制、八进制、二进制等） */
    Number = 'Number',
    /** 浮点数/科学计数法数值字面量（1e-6, 2.5, 3.14e+8 等） */
    NumberLiteral = 'NumberLiteral',
    /** 单词（标识符、指令助记符、寄存器名、标签名等） */
    Word = 'Word',
    /** 操作符（算术、逻辑、移位等） */
    Operator = 'Operator',
    /** 逗号（操作数分隔符） */
    Comma = 'Comma',
    /** 冒号（标签定义符） */
    Colon = 'Colon',
    /** 左方括号（内存地址起始） */
    OpenBracket = 'OpenBracket',
    /** 右方括号（内存地址结束） */
    CloseBracket = 'CloseBracket',
    /** 宏或预处理相关（百分号开头） */
    Macro = 'Macro',
    /** 当前地址（$） */
    CurrentAddress = 'CurrentAddress',
    /** 节起始地址（$$） */
    SectionStart = 'SectionStart',
    /** 未知字符 */
    Unknown = 'Unknown',
}

/**
 * 词法单元接口
 *
 * 包含词法单元的类型和在源代码中的原始值。
 */
export interface Token {
    /** 词法单元类型 */
    type: TokenType;
    /** 词法单元的原始文本值 */
    value: string;
}

/**
 * NASM 词法分析器
 *
 * 将 NASM 汇编源代码按行进行词法分析，生成结构化的词法单元序列。
 * 支持 NASM 特有的语法元素：
 *   - 单引号和双引号字符串，支持双写转义（如 'it''s'）
 *   - 多种数值格式：十六进制（0x.../...h）、八进制（0o.../...o/...q）、
 *     二进制（0b.../...b）、十进制
 *   - 科学计数法（1e-6, 2.5e+8 等）作为完整 NumberLiteral
 *   - 当前地址（$）和节起始（$$）
 *   - 预处理指令（%define、%macro 等）和宏局部标签（%%label）
 *   - 多字符操作符（<<、>>、//、&&、|| 等）
 *   - 标识符中允许的特殊字符（.、_、$、?、#、@）
 */
export class Tokenizer {
    private source: string;

    /**
     * @param source - 待分析的 NASM 汇编源代码
     */
    constructor(source: string) {
        this.source = source;
    }

    /**
     * 对源代码进行逐行词法分析
     *
     * 将源代码按换行符拆分为行，对每一行独立进行词法分析。
     *
     * @returns 每行对应的词法单元数组，每一行是一个 Token 数组
     */
    tokenizeLineByLine(): Token[][] {
        const lines: Token[][] = [];
        const sourceLines = this.source.split('\n');

        for (let i = 0; i < sourceLines.length; i++) {
            const tokens = this.tokenizeLine(sourceLines[i]);
            lines.push(tokens);
        }

        return lines;
    }

    /**
     * 对单行 NASM 代码进行词法分析
     *
     * @param line - 单行 NASM 代码
     * @returns 该行的词法单元数组
     */
    private tokenizeLine(line: string): Token[] {
        const tokens: Token[] = [];
        let i = 0;

        while (i < line.length) {
            const ch = line[i];

            // --- 空白字符 ---
            if (isWhitespace(ch)) {
                let ws = '';
                while (i < line.length && isWhitespace(line[i])) {
                    ws += line[i];
                    i++;
                }
                tokens.push({ type: TokenType.Whitespace, value: ws });
                continue;
            }

            // --- 注释（分号开头到行尾） ---
            if (ch === ';') {
                tokens.push({ type: TokenType.Comment, value: line.substring(i) });
                break;
            }

            // --- 字符串字面量 ---
            if (ch === "'" || ch === '"') {
                const quote = ch;
                let str = quote;
                i++;
                while (i < line.length) {
                    if (line[i] === quote) {
                        str += quote;
                        i++;
                        if (i < line.length && line[i] === quote) {
                            str += quote;
                            i++;
                        } else {
                            break;
                        }
                    } else {
                        str += line[i];
                        i++;
                    }
                }
                tokens.push({ type: TokenType.String, value: str });
                continue;
            }

            // --- 逗号 ---
            if (ch === ',') {
                tokens.push({ type: TokenType.Comma, value: ',' });
                i++;
                continue;
            }

            // --- 冒号 ---
            if (ch === ':') {
                tokens.push({ type: TokenType.Colon, value: ':' });
                i++;
                continue;
            }

            // --- 左方括号 ---
            if (ch === '[') {
                tokens.push({ type: TokenType.OpenBracket, value: '[' });
                i++;
                continue;
            }

            // --- 右方括号 ---
            if (ch === ']') {
                tokens.push({ type: TokenType.CloseBracket, value: ']' });
                i++;
                continue;
            }

            // --- 当前地址（$）和节起始（$$） ---
            if (ch === '$') {
                i++;
                if (i < line.length && line[i] === '$') {
                    tokens.push({ type: TokenType.SectionStart, value: '$$' });
                    i++;
                } else {
                    tokens.push({ type: TokenType.CurrentAddress, value: '$' });
                }
                continue;
            }

            // --- 操作符及特殊符号 ---
            if ('+-*/%&|^~<>!='.includes(ch)) {
                let op = ch;
                i++;
                if (i < line.length) {
                    const next = line[i];
                    if (
                        (ch === '<' && next === '<') ||
                        (ch === '>' && next === '>') ||
                        (ch === '/' && next === '/') ||
                        (ch === '%' && next === '%') ||
                        (ch === '!' && next === '=') ||
                        (ch === '=' && next === '=') ||
                        (ch === '&' && next === '&') ||
                        (ch === '|' && next === '|') ||
                        (ch === '^' && next === '^') ||
                        (ch === '<' && next === '=') ||
                        (ch === '>' && next === '=')
                    ) {
                        op += next;
                        i++;
                    }
                }
                tokens.push({ type: TokenType.Operator, value: op });
                continue;
            }

            // --- 数值字面量（包括科学计数法） ---
            if (isDigit(ch) || (ch === '.' && i + 1 < line.length && isDigit(line[i + 1]))) {
                // 以小数点开头（如 .5）→ 作为 NumberLiteral
                const startsWithDot = ch === '.';
                if (startsWithDot) {
                    const result = this.readFloatOrSci(i, line);
                    if (result) {
                        tokens.push({ type: TokenType.NumberLiteral, value: result.value });
                        i = result.end;
                        continue;
                    }
                }

                // 0x/0b/0o 前缀 → 整数 Number（不可能有科学计数法）
                if (ch === '0' && i + 1 < line.length) {
                    const next = line[i + 1];
                    if (next === 'x' || next === 'X') {
                        let num = '0x';
                        i += 2;
                        while (i < line.length && /[0-9a-fA-F]/.test(line[i])) {
                            num += line[i];
                            i++;
                        }
                        tokens.push({ type: TokenType.Number, value: num });
                        continue;
                    }
                    if (next === 'b' || next === 'B') {
                        let num = '0b';
                        i += 2;
                        while (i < line.length && /[01]/.test(line[i])) {
                            num += line[i];
                            i++;
                        }
                        tokens.push({ type: TokenType.Number, value: num });
                        continue;
                    }
                    if (next === 'o' || next === 'O') {
                        let num = '0o';
                        i += 2;
                        while (i < line.length && /[0-7]/.test(line[i])) {
                            num += line[i];
                            i++;
                        }
                        tokens.push({ type: TokenType.Number, value: num });
                        continue;
                    }
                }

                // 一般数字：尝试读取包含科学计数法和浮点数
                const result = this.readNumberOrSci(i, line);
                if (result.type === TokenType.NumberLiteral) {
                    tokens.push({ type: TokenType.NumberLiteral, value: result.value });
                } else {
                    tokens.push({ type: TokenType.Number, value: result.value });
                }
                i = result.end;
                continue;
            }

            // --- 百分号（宏相关） ---
            if (ch === '%') {
                let pct = '%';
                i++;
                if (i < line.length && line[i] === '%') {
                    pct += '%';
                    i++;
                }
                if (i < line.length && isAlpha(line[i])) {
                    while (i < line.length && isAlphanumeric(line[i])) {
                        pct += line[i];
                        i++;
                    }
                }
                tokens.push({ type: TokenType.Macro, value: pct });
                continue;
            }

            // --- 单词（标识符、指令、寄存器、标签等） ---
            if (isAlpha(ch) || ch === '.' || ch === '@' || ch === '?') {
                let word = '';
                while (i < line.length && /[a-zA-Z0-9_.$?#@]/.test(line[i])) {
                    word += line[i];
                    i++;
                }
                tokens.push({ type: TokenType.Word, value: word });
                continue;
            }

            // --- 未知字符（跳过） ---
            tokens.push({ type: TokenType.Unknown, value: ch });
            i++;
        }

        return tokens;
    }

    /**
     * 从当前位置读取数字（可能为浮点数或科学计数法）
     *
     * 支持格式：
     *   - 123       普通整数
     *   - 123.456   浮点数
     *   - 1e-6      科学计数法
     *   - 2.5e+8    科学计数法浮点
     *   - 123h      十六进制后缀
     *
     * @param start - 起始位置（指向第一个数字字符）
     * @param line - 当前行文本
     * @returns 解析结果（类型、值、结束位置）
     */
    private readNumberOrSci(
        start: number,
        line: string
    ): { type: TokenType; value: string; end: number } {
        let i = start;
        let num = '';

        // 读取整数部分
        while (i < line.length && isDigit(line[i])) {
            num += line[i];
            i++;
        }

        let isFloat = false;

        // 检查小数点（但排除后面是 'e' 的情况）
        if (i < line.length && line[i] === '.') {
            // 保存状态，尝试读小数
            const dotPos = i;
            i++;
            if (i < line.length && isDigit(line[i])) {
                num += '.';
                isFloat = true;
                while (i < line.length && isDigit(line[i])) {
                    num += line[i];
                    i++;
                }
            } else {
                // 小数点后没有数字 → 这不是浮点数，回退
                i = dotPos;
                // 对于纯整数，继续检查后缀
            }
        }

        // 检查科学计数法 e/E
        const sciSave = i;
        if (i < line.length && (line[i] === 'e' || line[i] === 'E')) {
            i++;
            let expSign = '';
            if (i < line.length && (line[i] === '+' || line[i] === '-')) {
                expSign = line[i];
                i++;
            }
            if (i < line.length && isDigit(line[i])) {
                // 确认是科学计数法
                let sciNum = num + (line[sciSave] === 'e' ? 'e' : 'E') + expSign;
                while (i < line.length && isDigit(line[i])) {
                    sciNum += line[i];
                    i++;
                }
                return { type: TokenType.NumberLiteral, value: sciNum, end: i };
            } else {
                // e/E 后面没有有效指数 → 回退
                i = sciSave;
            }
        }

        if (isFloat) {
            // 已经是浮点数但没有 e → NumberLiteral
            return { type: TokenType.NumberLiteral, value: num, end: i };
        }

        // 纯整数 - 检查 NASM 基数后缀
        if (i < line.length && /[hHoOqQbBdD]/.test(line[i])) {
            const suffix = line[i];
            if (
                (suffix === 'h' || suffix === 'H') ||
                (suffix === 'o' || suffix === 'O') ||
                (suffix === 'q' || suffix === 'Q') ||
                (suffix === 'b' || suffix === 'B') ||
                (suffix === 'd' || suffix === 'D')
            ) {
                num += line[i];
                i++;
            }
        }

        return { type: TokenType.Number, value: num, end: i };
    }

    /**
     * 读取以小数点开头的浮点数/科学计数法（如 .5e-3）
     */
    private readFloatOrSci(
        start: number,
        line: string
    ): { value: string; end: number } | null {
        let i = start;

        if (line[i] !== '.') return null;
        i++;

        if (i >= line.length || !isDigit(line[i])) return null;

        let num = '.';
        while (i < line.length && isDigit(line[i])) {
            num += line[i];
            i++;
        }

        // 检查科学计数法
        const sciSave = i;
        if (i < line.length && (line[i] === 'e' || line[i] === 'E')) {
            i++;
            let expSign = '';
            if (i < line.length && (line[i] === '+' || line[i] === '-')) {
                expSign = line[i];
                i++;
            }
            if (i < line.length && isDigit(line[i])) {
                let sciNum = num + (line[sciSave] === 'e' ? 'e' : 'E') + expSign;
                while (i < line.length && isDigit(line[i])) {
                    sciNum += line[i];
                    i++;
                }
                return { value: sciNum, end: i };
            }
            i = sciSave;
        }

        return { value: num, end: i };
    }
}
