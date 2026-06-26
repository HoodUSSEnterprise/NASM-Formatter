/**
 * 格式化规则模块
 *
 * 实现了 NASM 代码格式化的具体规则，包括：
 *   - 操作数间距（逗号、括号、操作符）
 *   - 注释对齐
 *   - 指令大小写转换
 *   - 缩进计算
 */

import { Token, TokenType } from './tokenizer';
import { ParsedLine, LineType } from './parser';
import { FormatterOptions } from './options';
import { applyCase, spaces, paddingToColumn } from './utils';

/**
 * 格式化操作数部分
 *
 * 根据配置对指令的操作数部分进行格式化，主要处理：
 *   - 逗号后的空格
 *   - 地址表达式中操作符周围空格
 *   - 括号内外空格
 *
 * @param tokens - 操作数部分的词法单元序列
 * @param options - 格式化选项
 * @returns 格式化后的操作数字符串
 */
export function formatOperands(tokens: Token[], options: FormatterOptions): string {
    let result = '';
    let inBracket = false;
    /** 标记下一个 token 前是否需要添加空格（用于分隔连续的操作数 token） */
    let needsSpace = false;
    let i = 0;

    while (i < tokens.length) {
        const token = tokens[i];

        switch (token.type) {
            case TokenType.Whitespace:
                i++;
                continue;

            case TokenType.Comma:
                result += options.spaceAfterComma ? ', ' : ',';
                needsSpace = false;
                i++;
                break;

            case TokenType.OpenBracket:
                result += '[';
                inBracket = true;
                needsSpace = false;
                i++;
                break;

            case TokenType.CloseBracket:
                inBracket = false;
                // 移除右括号前的多余空格
                result = result.replace(/ +$/, '');
                result += ']';
                needsSpace = true;
                i++;
                break;

            case TokenType.Operator: {
                if (inBracket && options.spaceInsideAddress) {
                    // 地址表达式内：操作符前后添加空格
                    result = result.replace(/ +$/, '');
                    result += ` ${token.value} `;
                } else {
                    // 表达式中的二元操作符前后添加空格
                    // 一元操作符（负号、正号、取反）不加空格
                    const isUnary = (token.value === '-' || token.value === '+' || token.value === '~') &&
                        (result.length === 0 || /[\s,([\]]$/.test(result));
                    if (isUnary) {
                        result += token.value;
                    } else {
                        result = result.replace(/ +$/, '');
                        result += ` ${token.value} `;
                    }
                }
                needsSpace = false;
                i++;
                break;
            }

            case TokenType.Macro: {
                if (inBracket && options.spaceInsideAddress) {
                    result = result.replace(/ +$/, '');
                    result += ` ${token.value} `;
                } else {
                    const isUnary = (token.value === '%') &&
                        (result.length === 0 || /[\s,([\]]$/.test(result));
                    if (isUnary) {
                        result += token.value;
                    } else {
                        result = result.replace(/ +$/, '');
                        result += ` ${token.value} `;
                    }
                }
                needsSpace = false;
                i++;
                break;
            }

            default:
                // Word, Number, String, CurrentAddress, SectionStart 等
                // 连续的操作数 token 之间需要空格分隔
                if (needsSpace) {
                    result += ' ';
                }
                result += token.value;
                needsSpace = true;
                i++;
                break;
        }
    }

    // 移除首尾空格
    return result.replace(/^ +/, '').replace(/ +$/, '');
}

/**
 * 格式化注释文本
 *
 * 处理注释文本，确保分号后有一个空格。
 *
 * @param commentText - 原始注释文本（含前导分号）
 * @returns 格式化后的注释文本
 */
export function formatCommentText(commentText: string): string {
    if (!commentText || commentText === ';') {
        return commentText || '';
    }

    // 分号后确保有一个空格
    if (commentText.length > 1 && commentText[0] === ';') {
        const afterSemicolon = commentText.substring(1);
        if (afterSemicolon.length > 0 && afterSemicolon[0] !== ' ') {
            return '; ' + afterSemicolon;
        }
        return commentText;
    }

    return commentText;
}

/**
 * 格式化指令行内容
 *
 * 对指令行（instruction）进行格式化：
 *   1. 提取指令助记符并进行大小写转换
 *   2. 格式化操作数部分
 *
 * @param tokens - 该行的完整词法单元序列（不含注释）
 * @param options - 格式化选项
 * @returns 格式化后的指令行内容字符串
 */
export function formatInstructionLine(
    tokens: Token[],
    options: FormatterOptions
): string {
    let result = '';
    let i = 0;

    // 跳过前导空白
    while (i < tokens.length && tokens[i].type === TokenType.Whitespace) i++;

    // 提取指令助记符（第一个 Word）
    if (i < tokens.length && tokens[i].type === TokenType.Word) {
        const mnemonic = tokens[i].value;
        result += applyCase(mnemonic, options.uppercaseInstruction, options.lowercaseInstruction);
        i++;
    } else {
        // 没有助记符（理论上不会发生），返回原始内容
        return tokens.map(t => t.value).join('');
    }

    // 跳过助记符后的空白
    while (i < tokens.length && tokens[i].type === TokenType.Whitespace) i++;

    // 如果还有后续内容（操作数），添加空格后格式化操作数
    if (i < tokens.length) {
        result += ' ';

        // 收集操作数部分的词法单元
        const operandTokens: Token[] = [];
        while (i < tokens.length) {
            operandTokens.push(tokens[i]);
            i++;
        }

        result += formatOperands(operandTokens, options);
    }

    // 移除首尾多余空格
    return result.replace(/ +$/, '');
}

/**
 * 格式化标签行内容
 *
 * 标签行格式化为 "label:" 形式。
 *
 * @param tokens - 该行的词法单元序列
 * @param labelName - 标签名
 * @returns 格式化后的标签行内容
 */
export function formatLabelLine(tokens: Token[], labelName: string): string {
    // 标签名后跟冒号
    return `${labelName}:`;
}

/**
 * 格式化伪指令行内容
 *
 * 伪指令行保持左对齐，对内容进行基本格式化。
 *
 * @param tokens - 该行的词法单元序列（不含注释）
 * @param options - 格式化选项
 * @returns 格式化后的伪指令行内容
 */
export function formatDirectiveLine(
    tokens: Token[],
    options: FormatterOptions
): string {
    let result = '';
    let i = 0;

    // 跳过前导空白
    while (i < tokens.length && tokens[i].type === TokenType.Whitespace) i++;

    // 指令名
    if (i < tokens.length && tokens[i].type === TokenType.Word) {
        const directive = tokens[i].value;
        result += directive.toLowerCase();
        i++;
    }

    // 跳过空白
    while (i < tokens.length && tokens[i].type === TokenType.Whitespace) i++;

    // 操作数部分（保持原样或使用相同的操作数格式化）
    if (i < tokens.length) {
        result += ' ';
        const operandTokens: Token[] = [];
        while (i < tokens.length) {
            operandTokens.push(tokens[i]);
            i++;
        }
        result += formatOperands(operandTokens, options);
    }

    return result;
}

/**
 * 格式化数据定义行
 *
 * 与指令行使用相同的格式化规则（db, dw, dd 等）。
 *
 * @param tokens - 该行的词法单元序列
 * @param options - 格式化选项
 * @returns 格式化后的数据定义行内容
 */
export function formatDataLine(
    tokens: Token[],
    options: FormatterOptions
): string {
    return formatInstructionLine(tokens, options);
}

/**
 * 计算注释对齐所需的填充
 *
 * 将注释对齐到配置的列号，如果行内容已超过该列则添加一个空格。
 *
 * @param contentLength - 行内容长度
 * @param commentText - 格式化后的注释文本
 * @param options - 格式化选项
 * @returns 对齐后的 "填充 + 注释" 字符串
 */
export function alignComment(
    contentLength: number,
    commentText: string,
    options: FormatterOptions
): string {
    if (!options.alignComments || !commentText) {
        return commentText ? ' ' + commentText : '';
    }

    const padding = paddingToColumn(contentLength, options.commentColumn);
    return spaces(padding) + commentText;
}

/**
 * 计算行的最终缩进
 *
 * 根据行类型和标签上下文计算缩进：
 *   - 伪指令/预处理指令：缩进为 0
 *   - 标签：保留原始缩进（keepLabelIndent=true）或缩进为 0
 *   - 指令/数据：基于最近标签的缩进 + 一个缩进级别
 *   - 代码开始处无标签但位于 section 内：一个缩进级别
 *   - 代码开始处无标签且不在 section 内：不缩进
 *
 * @param line - 解析后的行对象
 * @param lastLabelIndent - 最近标签的缩进（空格数）
 * @param hasLabelBefore - 是否已有标签出现
 * @param inSection - 是否位于 section/segment 内
 * @param options - 格式化选项
 * @returns 计算后的缩进字符串
 */
export function computeIndent(
    line: ParsedLine,
    lastLabelIndent: number,
    hasLabelBefore: boolean,
    inSection: boolean,
    options: FormatterOptions
): string {
    switch (line.type) {
        case LineType.Directive:
        case LineType.Macro:
            return '';

        case LineType.Label:
            if (options.keepLabelIndent) {
                return spaces(line.originalIndent);
            }
            return '';

        case LineType.Blank:
            return '';

        case LineType.Comment:
            // 注释行保持原样
            return spaces(line.originalIndent);

        case LineType.Instruction:
        case LineType.Data:
        default:
            if (hasLabelBefore) {
                return spaces(lastLabelIndent + options.indentSize);
            }
            if (inSection) {
                return spaces(options.indentSize);
            }
            return '';
    }
}

/**
 * 组装格式化后的完整行
 *
 * 将缩进、行内容和注释组合为完整的行字符串。
 *
 * @param indent - 缩进字符串
 * @param content - 格式化后的行内容
 * @param commentText - 原始注释文本（可空）
 * @param options - 格式化选项
 * @returns 完整的格式化行
 */
export function assembleLine(
    indent: string,
    content: string,
    commentText: string | undefined,
    options: FormatterOptions
): string {
    if (!content && !commentText) {
        return '';
    }

    if (!content && commentText) {
        // 仅注释行，保留原样
        return commentText;
    }

    const formattedComment = commentText ? formatCommentText(commentText) : '';
    const line = indent + content;

    if (formattedComment) {
        // 使用 VS Code 的制表符感知对齐
        const visibleLength = calculateVisualLength(line);
        return line + alignComment(visibleLength, formattedComment, options);
    }

    return line;
}

/**
 * 计算字符串的"视觉长度"
 *
 * 制表符按一定宽度计算，用于注释对齐。
 *
 * @param str - 输入字符串
 * @param tabWidth - 制表符宽度
 * @returns 视觉列数
 */
export function calculateVisualLength(str: string, tabWidth: number = 8): number {
    let length = 0;
    for (const ch of str) {
        if (ch === '\t') {
            length += tabWidth - (length % tabWidth);
        } else {
            length++;
        }
    }
    return length;
}
