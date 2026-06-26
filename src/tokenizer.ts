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
    /** 数值字面量（十进制、十六进制、八进制、二进制等） */
    Number = 'Number',
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
                        // NASM 字符串转义：双写引号（如 'it''s' 表示 it's）
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
                // 多字符操作符
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

            // --- 数值字面量 ---
            if (isDigit(ch)) {
                let num = '';

                // 0x/0X 开头：十六进制
                if (ch === '0' && i + 1 < line.length && (line[i + 1] === 'x' || line[i + 1] === 'X')) {
                    num = '0x';
                    i += 2;
                    while (i < line.length && /[0-9a-fA-F]/.test(line[i])) {
                        num += line[i];
                        i++;
                    }
                    tokens.push({ type: TokenType.Number, value: num });
                    continue;
                }

                // 0b/0B 开头：二进制
                if (ch === '0' && i + 1 < line.length && (line[i + 1] === 'b' || line[i + 1] === 'B')) {
                    num = '0b';
                    i += 2;
                    while (i < line.length && /[01]/.test(line[i])) {
                        num += line[i];
                        i++;
                    }
                    tokens.push({ type: TokenType.Number, value: num });
                    continue;
                }

                // 0o/0O 开头：八进制
                if (ch === '0' && i + 1 < line.length && (line[i + 1] === 'o' || line[i + 1] === 'O')) {
                    num = '0o';
                    i += 2;
                    while (i < line.length && /[0-7]/.test(line[i])) {
                        num += line[i];
                        i++;
                    }
                    tokens.push({ type: TokenType.Number, value: num });
                    continue;
                }

                // 一般数字（以数字开头）
                while (i < line.length && isDigit(line[i])) {
                    num += line[i];
                    i++;
                }

                // NASM 的基数后缀：h=十六进制, o/q=八进制, b=二进制, d=十进制
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
                tokens.push({ type: TokenType.Number, value: num });
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
                // 百分号后跟字母 => 预处理指令
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
            // 允许以字母、下划线、点号、@、? 开头
            if (isAlpha(ch) || ch === '.' || ch === '@' || ch === '?') {
                let word = '';
                // NASM 标识符允许的字符范围
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
}
