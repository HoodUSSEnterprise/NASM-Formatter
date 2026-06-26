/**
 * 工具函数模块
 *
 * 提供字符串处理、缩进计算等通用工具函数。
 * 所有函数均为纯函数，不依赖 VS Code API。
 */

/**
 * 判断字符是否为空白字符（空格或制表符）
 *
 * @param ch - 要判断的字符
 * @returns 如果是空格或制表符返回 true
 */
export function isWhitespace(ch: string): boolean {
    return ch === ' ' || ch === '\t';
}

/**
 * 判断字符是否为英文字母或下划线
 *
 * @param ch - 要判断的字符
 * @returns 如果是字母或下划线返回 true
 */
export function isAlpha(ch: string): boolean {
    return /[a-zA-Z_]/.test(ch);
}

/**
 * 判断字符是否为数字
 *
 * @param ch - 要判断的字符
 * @returns 如果是数字返回 true
 */
export function isDigit(ch: string): boolean {
    return /[0-9]/.test(ch);
}

/**
 * 判断字符是否为字母、数字或下划线
 *
 * @param ch - 要判断的字符
 * @returns 如果是字母数字或下划线返回 true
 */
export function isAlphanumeric(ch: string): boolean {
    return /[a-zA-Z0-9_]/.test(ch);
}

/**
 * 计算字符串前导空白字符数（以空格为单位）
 *
 * 制表符按 8 列宽度计算，与 NASM 惯例保持一致。
 *
 * @param str - 输入字符串
 * @returns 前导空白字符数（空格等价列数）
 */
export function countIndent(str: string): number {
    let count = 0;
    for (const ch of str) {
        if (ch === ' ') {
            count++;
        } else if (ch === '\t') {
            count += 8;
        } else {
            break;
        }
    }
    return count;
}

/**
 * 生成指定数量的空格字符串
 *
 * @param n - 空格数量
 * @returns 由 n 个空格组成的字符串
 */
export function spaces(n: number): string {
    return ' '.repeat(Math.max(0, n));
}

/**
 * 将字符串中的制表符替换为空格
 *
 * @param line - 输入行
 * @param tabSize - 每个制表符对应的空格数，默认 4
 * @returns 转换后的字符串
 */
export function tabsToSpaces(line: string, tabSize: number = 4): string {
    let result = '';
    for (const ch of line) {
        if (ch === '\t') {
            result += ' '.repeat(tabSize);
        } else {
            result += ch;
        }
    }
    return result;
}

/**
 * 判断字符串是否为空或仅包含空白字符
 *
 * @param str - 输入字符串
 * @returns 如果字符串为空或仅含空白返回 true
 */
export function isBlank(str: string): boolean {
    return str.trim().length === 0;
}

/**
 * 获取字符串中最后一个非空白字符的列号（从 0 开始）
 *
 * @param str - 输入字符串
 * @returns 最后一个非空白字符的列号，若无则返回 -1
 */
export function lastNonWhitespaceColumn(str: string): number {
    for (let i = str.length - 1; i >= 0; i--) {
        if (!isWhitespace(str[i])) {
            return i;
        }
    }
    return -1;
}

/**
 * 计算将字符串填充到指定列所需空格数
 *
 * 如果字符串长度已超过目标列，返回 1（至少一个空格分隔）。
 *
 * @param currentLength - 当前字符串长度
 * @param targetColumn - 目标列号
 * @returns 需要填充的空格数
 */
export function paddingToColumn(currentLength: number, targetColumn: number): number {
    if (currentLength >= targetColumn) {
        return 1;
    }
    return targetColumn - currentLength;
}

/**
 * 应用指令大小写转换
 *
 * @param instruction - 原始指令字符串
 * @param options - 包含大小写配置的选项对象
 * @returns 转换后的指令字符串
 */
export function applyCase(
    instruction: string,
    uppercase: boolean,
    lowercase: boolean
): string {
    if (uppercase) {
        return instruction.toUpperCase();
    }
    if (lowercase) {
        return instruction.toLowerCase();
    }
    return instruction;
}
