/**
 * NASM 格式化器主模块
 *
 * 实现了 DocumentFormattingEditProvider 接口，作为 VS Code 格式化入口。
 * 编排词法分析、语法解析、格式化规则等整个格式化流水线。
 */

import * as vscode from 'vscode';
import { Tokenizer, TokenType } from './tokenizer';
import { NASMParser, ParsedLine, LineType } from './parser';
import { FormatterOptions, DEFAULT_OPTIONS } from './options';
import {
    formatInstructionLine,
    formatLabelLine,
    formatDirectiveLine,
    formatDataLine,
    formatCommentText,
    formatDataBlock,
    computeIndent,
    assembleLine,
} from './formatterRules';
import { spaces } from './utils';

/**
 * NASM 格式化器
 *
 * 实现 VS Code 的 DocumentFormattingEditProvider 接口，
 * 通过 Shift+Alt+F 触发格式化操作。
 *
 * 格式化流水线：
 *   1. 读取源代码
 *   2. 词法分析（Tokenizer）
 *   3. 语法解析（Parser）
 *   4. 缩进计算
 *   5. 逐行格式化
 *   6. 空行处理
 *   7. 输出格式化结果
 */
export class NASMFormatter implements vscode.DocumentFormattingEditProvider {
    /**
     * 提供文档格式化编辑
     *
     * VS Code 调用此方法获取格式化后的文本替换操作。
     *
     * @param document - 要格式化的文档
     * @param _options - VS Code 的格式化选项（tab 设置等）
     * @param _token - 取消令牌
     * @returns 文本替换操作数组
     */
    provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        _options: vscode.FormattingOptions,
        _token: vscode.CancellationToken
    ): vscode.TextEdit[] {
        const config = vscode.workspace.getConfiguration('nasmFormatter');
        const options: FormatterOptions = {
            indentSize: config.get<number>('indentSize', DEFAULT_OPTIONS.indentSize),
            alignComments: config.get<boolean>('alignComments', DEFAULT_OPTIONS.alignComments),
            commentColumn: config.get<number>('commentColumn', DEFAULT_OPTIONS.commentColumn),
            keepLabelIndent: config.get<boolean>('keepLabelIndent', DEFAULT_OPTIONS.keepLabelIndent),
            blankLineBeforeLabel: config.get<boolean>('blankLineBeforeLabel', DEFAULT_OPTIONS.blankLineBeforeLabel),
            spaceAfterComma: config.get<boolean>('spaceAfterComma', DEFAULT_OPTIONS.spaceAfterComma),
            spaceInsideAddress: config.get<boolean>('spaceInsideAddress', DEFAULT_OPTIONS.spaceInsideAddress),
            removeExtraBlankLines: config.get<boolean>('removeExtraBlankLines', DEFAULT_OPTIONS.removeExtraBlankLines),
            uppercaseInstruction: config.get<boolean>('uppercaseInstruction', DEFAULT_OPTIONS.uppercaseInstruction),
            lowercaseInstruction: config.get<boolean>('lowercaseInstruction', DEFAULT_OPTIONS.lowercaseInstruction),
        };

        const source = document.getText();
        const formatted = this.formatSource(source, options);

        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(source.length)
        );

        return [vscode.TextEdit.replace(fullRange, formatted)];
    }

    /**
     * 格式化源代码
     *
     * 执行完整的格式化流水线。
     *
     * @param source - 原始 NASM 源代码
     * @param options - 格式化选项
     * @returns 格式化后的代码
     */
    public formatSource(source: string, options: FormatterOptions): string {
        // 步骤 1：预处理 - 统一换行符
        const normalizedSource = source.replace(/\r\n/g, '\n');

        // 步骤 2：词法分析
        const tokenizer = new Tokenizer(normalizedSource);
        const tokenLines = tokenizer.tokenizeLineByLine();

        // 步骤 3：语法解析
        const parser = new NASMParser(tokenLines);
        const parsedLines = parser.parse();

        // 步骤 4：处理空行
        const processedLines = this.processBlankLines(parsedLines, options);

        // 步骤 5：计算缩进并格式化
        return this.formatLines(processedLines, options);
    }

    /**
     * 处理空行
     *
     * 根据配置执行：
     *   - 删除多余连续空行（保留一个）
     *   - 在标签前插入空行
     *
     * @param lines - 解析后的行数组
     * @param options - 格式化选项
     * @returns 处理后的行数组
     */
    private processBlankLines(
        lines: ParsedLine[],
        options: FormatterOptions
    ): ParsedLine[] {
        const result: ParsedLine[] = [];

        for (let i = 0; i < lines.length; i++) {
            const currentLine = lines[i];

            // 删除多余连续空行
            if (options.removeExtraBlankLines) {
                if (currentLine.type === LineType.Blank) {
                    // 跳过连续空行
                    if (result.length > 0 && result[result.length - 1].type === LineType.Blank) {
                        continue;
                    }
                    // 跳过文件末尾的空行
                    let allBlankAfter = true;
                    for (let j = i + 1; j < lines.length; j++) {
                        if (lines[j].type !== LineType.Blank) {
                            allBlankAfter = false;
                            break;
                        }
                    }
                    if (allBlankAfter) {
                        continue;
                    }
                }
            }

            // 在标签前插入空行
            if (options.blankLineBeforeLabel && currentLine.needsBlankBefore) {
                // 创建空行
                const blankLine: ParsedLine = {
                    type: LineType.Blank,
                    originalIndent: 0,
                    originalText: '',
                    tokens: [],
                    needsBlankBefore: false,
                };
                result.push(blankLine);
            }

            result.push(currentLine);
        }

        return result;
    }

    /**
     * 逐行格式化
     *
     * 遍历处理后的行数组，根据标签上下文计算缩进并应用格式化规则。
     *
     * @param lines - 处理后的行数组
     * @param options - 格式化选项
     * @returns 格式化后的完整代码字符串
     */
    private formatLines(
        lines: ParsedLine[],
        options: FormatterOptions
    ): string {
        const result: string[] = [];
        let lastLabelIndent = 0;
        let hasLabelBefore = false;
        /** 是否处于 section 或 segment 内部 */
        let inSection = false;
        /** 当前所在的 section 名称 */
        let currentSection = '';

        let i = 0;
        while (i < lines.length) {
            const line = lines[i];

            // 更新标签上下文
            if (line.type === LineType.Label && line.labelName) {
                if (options.keepLabelIndent) {
                    lastLabelIndent = line.originalIndent;
                } else {
                    lastLabelIndent = 0;
                }
                hasLabelBefore = true;
                inSection = false;
            }

            // 检测 section/segment 开始 & 更新 section 上下文
            if (line.type === LineType.Directive &&
                (line.mnemonic === 'section' || line.mnemonic === 'segment')) {
                inSection = true;
                currentSection = line.sectionName || '';
            }

            // --- 数据节行批处理：列对齐格式化 ---
            const isDataSection = currentSection === '.data' ||
                                  currentSection === '.rodata' ||
                                  currentSection === '.bss';

            if (isDataSection && line.type === LineType.Data) {
                const dataBlock: ParsedLine[] = [];
                while (i < lines.length) {
                    const l = lines[i];
                    if (l.type === LineType.Data) {
                        dataBlock.push(l);
                        i++;
                    } else {
                        break;
                    }
                }
                if (dataBlock.length > 0) {
                    const formatted = formatDataBlock(dataBlock, options);
                    result.push(...formatted);
                    continue;
                }
            }

            // 计算缩进
            const indent = computeIndent(line, lastLabelIndent, hasLabelBefore, inSection, options);

            // 格式化行内容
            let content: string;
            const nonCommentTokens = line.tokens.filter(t => t.type !== TokenType.Comment);

            switch (line.type) {
                case LineType.Blank:
                    result.push('');
                    i++;
                    continue;

                case LineType.Comment:
                    // 注释行：应用缩进并格式化注释文本
                    const formattedComment = formatCommentText(line.commentText || '');
                    result.push(indent + formattedComment);
                    i++;
                    continue;

                case LineType.Label:
                    if (line.labelName) {
                        content = formatLabelLine(nonCommentTokens, line.labelName);
                    } else {
                        content = nonCommentTokens.map(t => t.value).join('');
                    }
                    break;

                case LineType.Directive:
                    content = formatDirectiveLine(nonCommentTokens, options);
                    break;

                case LineType.Data:
                    // 非数据节中的零散数据行（如 .text 中的 db）
                    content = formatDataLine(nonCommentTokens, options);
                    break;

                case LineType.Macro:
                    // 预处理指令保持原内容，只清除前导空白
                    content = nonCommentTokens.map(t => t.value).join('').trim();
                    break;

                case LineType.Instruction:
                default:
                    content = formatInstructionLine(nonCommentTokens, options);
                    break;
            }

            // 组装完整行（缩进 + 内容 + 注释）
            const formattedLine = assembleLine(indent, content, line.commentText, options);
            result.push(formattedLine);
            i++;
        }

        return result.join('\n') + '\n';
    }

    /**
     * 纯编程方式格式化字符串（不依赖 VS Code API）
     *
     * 用于测试或非 VS Code 环境。
     *
     * @param source - 原始 NASM 源代码
     * @param options - 格式化选项（可选，默认为 DEFAULT_OPTIONS）
     * @returns 格式化后的代码
     */
    public formatString(source: string, options?: FormatterOptions): string {
        const opts = options || DEFAULT_OPTIONS;
        return this.formatSource(source, opts);
    }
}
