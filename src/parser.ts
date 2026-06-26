/**
 * NASM 语法解析器模块
 *
 * 将词法分析器生成的词法单元序列解析为结构化的行对象，
 * 识别标签、指令、伪指令、预处理指令等不同行类型。
 */

import { Token, TokenType } from './tokenizer';

/**
 * 行类型枚举
 *
 * 定义了 NASM 源代码中每一行可能属于的类型。
 */
export enum LineType {
    /** 空行 */
    Blank = 'Blank',
    /** 仅注释行 */
    Comment = 'Comment',
    /** 标签定义（以冒号结尾的标识符） */
    Label = 'Label',
    /** 指令（mov, add, jmp 等可执行指令） */
    Instruction = 'Instruction',
    /** 伪指令（section, global, extern 等） */
    Directive = 'Directive',
    /** 预处理指令（%define, %macro, %if 等） */
    Macro = 'Macro',
    /** 数据定义（db, dw, dd, dq, resb, equ, times 等） */
    Data = 'Data',
}

/**
 * 解析后的行对象
 *
 * 包含行的类型、原始缩进、标签名、注释等信息。
 */
export interface ParsedLine {
    /** 行类型 */
    type: LineType;
    /** 原始缩进列数 */
    originalIndent: number;
    /** 原始源代码行 */
    originalText: string;
    /** 该行的词法单元序列（不含行尾换行符） */
    tokens: Token[];
    /** 标签名（如果是标签行） */
    labelName?: string;
    /** 注释文本（含前导分号） */
    commentText?: string;
    /** 指令或伪指令名称（如 mov, section, db 等） */
    mnemonic?: string;
    /** 操作数部分的词法单元 */
    operands?: Token[];
    /** 是否需要在标签前插入空行 */
    needsBlankBefore?: boolean;
}

/**
 * 始终左对齐的伪指令关键字列表
 *
 * 这些关键字出现在行首时，该行始终保持列 0 对齐。
 */
const DIRECTIVE_KEYWORDS = new Set([
    'section', 'segment',
    'global', 'extern', 'common', 'static', 'export', 'import',
    'default', 'bits', 'cpu',
    'org', 'align', 'alignb',
    'struc', 'endstruc', 'istruc', 'at', 'iend',
    'absolute',
]);

/**
 * 预处理指令关键字列表
 *
 * 以百分号开头的预处理指令。
 */
const MACRO_KEYWORDS = new Set([
    '%macro', '%imacro', '%endmacro',
    '%ifdef', '%ifndef', '%ifidn', '%ifnidn', '%ifidni', '%ifnidni',
    '%ifid', '%ifnid', '%ifnum', '%ifnnum', '%ifstr', '%ifnstr',
    '%iftoken', '%ifntoken', '%ifctx', '%ifnctx',
    '%if', '%elifdef', '%elifndef', '%elifidn', '%elifnidn',
    '%elifidni', '%elifnidni', '%elifid', '%elifnid',
    '%elifnum', '%elifnnum', '%elifstr', '%elifnstr',
    '%eliftoken', '%elifntoken', '%elifctx', '%elifnctx',
    '%elif', '%else', '%endif',
    '%include', '%define', '%xdefine', '%ixdefine', '%undef',
    '%assign', '%iassign',
    '%push', '%pop', '%repl',
    '%error', '%warning', '%fatal',
    '%rep', '%endrep', '%exitrep',
    '%strlen', '%strcat', '%substr',
    '%line', '%pathsearch', '%depend',
    '%use', '%arg', '%stacksize', '%local',
]);

/**
 * 数据定义伪指令列表
 *
 * 这些关键字用于定义数据，与普通指令缩进规则相同。
 */
const DATA_KEYWORDS = new Set([
    'db', 'dw', 'dd', 'dq', 'dt', 'do', 'dy', 'dz',
    'resb', 'resw', 'resd', 'resq', 'rest', 'reso', 'resy', 'resz',
    'incbin',
    'equ', 'equ',
    'times',
]);

/**
 * NASM 语法解析器
 *
 * 将词法分析结果解析为结构化的行对象，完成以下工作：
 *   1. 识别行类型（标签、指令、伪指令等）
 *   2. 计算原始缩进
 *   3. 提取标签名和注释
 *   4. 识别需要特殊处理的代码结构
 */
export class NASMParser {
    private tokenLines: Token[][];

    /**
     * @param tokenLines - 词法分析器输出的逐行词法单元数组
     */
    constructor(tokenLines: Token[][]) {
        this.tokenLines = tokenLines;
    }

    /**
     * 执行解析
     *
     * @returns 解析后的行对象数组
     */
    parse(): ParsedLine[] {
        const lines: ParsedLine[] = [];

        for (let i = 0; i < this.tokenLines.length; i++) {
            const tokens = this.tokenLines[i];
            const parsedLine = this.parseLine(tokens, i);
            lines.push(parsedLine);
        }

        // 第二遍扫描：标记标签前是否需要空行
        this.markBlankBeforeLabels(lines);

        return lines;
    }

    /**
     * 解析单行词法单元
     *
     * @param tokens - 该行的词法单元
     * @param lineIndex - 行号
     * @returns 解析后的行对象
     */
    private parseLine(tokens: Token[], lineIndex: number): ParsedLine {
        const originalText = this.reconstructOriginal(tokens);
        const originalIndent = this.calculateOriginalIndent(tokens);
        const commentText = this.extractComment(tokens);

        // 空行
        if (this.isEmptyLine(tokens)) {
            return {
                type: LineType.Blank,
                originalIndent: 0,
                originalText,
                tokens,
                commentText,
                needsBlankBefore: false,
            };
        }

        // 仅注释行
        if (this.isCommentOnlyLine(tokens)) {
            return {
                type: LineType.Comment,
                originalIndent,
                originalText,
                tokens,
                commentText,
                needsBlankBefore: false,
            };
        }

        // 预处理指令行
        const macroName = this.getMacroName(tokens);
        if (macroName) {
            return {
                type: LineType.Macro,
                originalIndent: 0,
                originalText,
                tokens,
                mnemonic: macroName,
                commentText,
                needsBlankBefore: false,
            };
        }

        // 标签行
        const labelName = this.getLabelName(tokens);
        if (labelName) {
            return {
                type: LineType.Label,
                originalIndent,
                originalText,
                tokens,
                labelName,
                commentText,
                needsBlankBefore: false,
            };
        }

        // 伪指令行
        const directiveName = this.getDirectiveName(tokens);
        if (directiveName) {
            return {
                type: LineType.Directive,
                originalIndent: 0,
                originalText,
                tokens,
                mnemonic: directiveName,
                commentText,
                needsBlankBefore: false,
            };
        }

        // 数据定义行
        const dataName = this.getDataName(tokens);
        if (dataName) {
            return {
                type: LineType.Data,
                originalIndent,
                originalText,
                tokens,
                mnemonic: dataName,
                commentText,
                needsBlankBefore: false,
            };
        }

        // 默认为指令行
        const firstWord = this.getFirstWord(tokens);
        return {
            type: LineType.Instruction,
            originalIndent,
            originalText,
            tokens,
            mnemonic: firstWord || undefined,
            commentText,
            needsBlankBefore: false,
        };
    }

    /**
     * 判断是否为空行
     */
    private isEmptyLine(tokens: Token[]): boolean {
        if (tokens.length === 0) return true;
        return tokens.every(t => t.type === TokenType.Whitespace);
    }

    /**
     * 判断是否为仅注释行
     */
    private isCommentOnlyLine(tokens: Token[]): boolean {
        const nonWhitespace = tokens.filter(t => t.type !== TokenType.Whitespace);
        if (nonWhitespace.length === 0) return false;
        return nonWhitespace.every(t => t.type === TokenType.Comment);
    }

    /**
     * 获取第一个非空白词法单元的值
     */
    private getFirstNonWhitespace(tokens: Token[]): Token | undefined {
        return tokens.find(t => t.type !== TokenType.Whitespace);
    }

    /**
     * 获取第一个单词（跳过空白）
     */
    private getFirstWord(tokens: Token[]): string | undefined {
        const first = this.getFirstNonWhitespace(tokens);
        if (first && first.type === TokenType.Word) {
            return first.value.toLowerCase();
        }
        return undefined;
    }

    /**
     * 提取注释文本
     */
    private extractComment(tokens: Token[]): string | undefined {
        const comment = tokens.find(t => t.type === TokenType.Comment);
        return comment ? comment.value : undefined;
    }

    /**
     * 计算原始缩进列数
     */
    private calculateOriginalIndent(tokens: Token[]): number {
        let indent = 0;
        for (const token of tokens) {
            if (token.type === TokenType.Whitespace) {
                for (const ch of token.value) {
                    if (ch === ' ') indent++;
                    else if (ch === '\t') indent += 8;
                }
            } else {
                break;
            }
        }
        return indent;
    }

    /**
     * 从原始文本重建函数（调试用）
     */
    private reconstructOriginal(tokens: Token[]): string {
        return tokens.map(t => t.value).join('');
    }

    /**
     * 检查是否为标签行
     *
     * 检测以下标签格式：
     *   - 普通标签：label:
     *   - 局部标签：.label:
     *   - 匿名标签：@@:
     *   - 宏局部标签：%%label:
     */
    private getLabelName(tokens: Token[]): string | undefined {
        let i = 0;

        // 跳过前导空白
        while (i < tokens.length && tokens[i].type === TokenType.Whitespace) i++;

        if (i >= tokens.length) return undefined;

        // Case 1: Word 后跟冒号 => 普通标签
        if (tokens[i].type === TokenType.Word) {
            let j = i + 1;
            while (j < tokens.length && tokens[j].type === TokenType.Whitespace) j++;
            if (j < tokens.length && tokens[j].type === TokenType.Colon) {
                return tokens[i].value;
            }
        }

        // Case 2: %%label 宏局部标签 => Macro 后跟冒号
        if (tokens[i].type === TokenType.Macro && tokens[i].value.startsWith('%%')) {
            let j = i + 1;
            while (j < tokens.length && tokens[j].type === TokenType.Whitespace) j++;
            if (j < tokens.length && tokens[j].type === TokenType.Colon) {
                return tokens[i].value;
            }
        }

        return undefined;
    }

    /**
     * 检查是否为伪指令行
     */
    private getDirectiveName(tokens: Token[]): string | undefined {
        const firstWord = this.getFirstWord(tokens);
        if (firstWord && DIRECTIVE_KEYWORDS.has(firstWord)) {
            return firstWord;
        }
        return undefined;
    }

    /**
     * 检查是否为数据定义行
     */
    private getDataName(tokens: Token[]): string | undefined {
        const firstWord = this.getFirstWord(tokens);
        if (firstWord && DATA_KEYWORDS.has(firstWord)) {
            return firstWord;
        }
        return undefined;
    }

    /**
     * 检查是否为预处理指令行
     */
    private getMacroName(tokens: Token[]): string | undefined {
        let i = 0;
        while (i < tokens.length && tokens[i].type === TokenType.Whitespace) i++;

        if (i < tokens.length && tokens[i].type === TokenType.Macro) {
            const value = tokens[i].value;
            // % 或 %% 单独出现不是预处理指令
            if (value === '%' || value === '%%') return undefined;
            // 预处理指令总是左对齐
            return value;
        }

        return undefined;
    }

    /**
     * 第二遍扫描：标记标签前需要插入的空行
     *
     * 如果 blankLineBeforeLabel 配置开启，在标签行前标记需要空行。
     * 规则：
     *   - 标签前不是空行时标记需要插入空行
     *   - 文件开头的标签不插入空行
     *   - 连续的标签（标签后紧跟标签）不插入空行
     */
    private markBlankBeforeLabels(lines: ParsedLine[]): void {
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].type === LineType.Label) {
                // 文件开头的标签不插入空行
                if (i === 0) continue;

                // 前一行是标签时不插入空行
                if (lines[i - 1].type === LineType.Label) continue;

                // 前一行已经是空行时不重复插入
                if (lines[i - 1].type === LineType.Blank) continue;

                // 前一行是注释行时，检查更前一行
                if (lines[i - 1].type === LineType.Comment) {
                    if (i - 2 >= 0 && lines[i - 2].type === LineType.Blank) continue;
                }

                lines[i].needsBlankBefore = true;
            }
        }
    }
}
