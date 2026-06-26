/**
 * NASM Formatter 配置选项模块
 *
 * 定义格式化器的所有可配置选项及其默认值。
 * 选项通过 VS Code 的 settings.json 中的 nasmFormatter.* 进行配置。
 */

/**
 * NASM 格式化器配置选项接口
 *
 * 所有配置项均有合理的默认值，用户可通过 VS Code 设置覆盖。
 */
export interface FormatterOptions {
    /** 缩进大小（空格数），默认 4 */
    indentSize: number;

    /** 是否对齐注释到指定列，默认 true */
    alignComments: boolean;

    /** 注释对齐的目标列号，默认 40 */
    commentColumn: number;

    /** 是否保留标签的原始缩进，默认 true */
    keepLabelIndent: boolean;

    /** 标签前是否自动添加空行，默认 true */
    blankLineBeforeLabel: boolean;

    /** 逗号后是否添加空格，默认 true */
    spaceAfterComma: boolean;

    /** 地址表达式内操作符前后是否添加空格，默认 true */
    spaceInsideAddress: boolean;

    /** 是否删除多余连续空行（保留一个），默认 true */
    removeExtraBlankLines: boolean;

    /** 是否将指令转为大写，默认 false（与 lowercaseInstruction 互斥） */
    uppercaseInstruction: boolean;

    /** 是否将指令转为小写，默认 false（与 uppercaseInstruction 互斥） */
    lowercaseInstruction: boolean;
}

/** 默认格式化选项常量 */
export const DEFAULT_OPTIONS: FormatterOptions = {
    indentSize: 4,
    alignComments: true,
    commentColumn: 40,
    keepLabelIndent: true,
    blankLineBeforeLabel: true,
    spaceAfterComma: true,
    spaceInsideAddress: true,
    removeExtraBlankLines: true,
    uppercaseInstruction: false,
    lowercaseInstruction: false,
};
