/**
 * VS Code Extension 入口模块
 *
 * 负责扩展的激活（activate）和停用（deactivate）生命周期管理。
 * 注册 NASM 格式化器到 VS Code 的文档格式化服务。
 */

import * as vscode from 'vscode';
import { NASMFormatter } from './formatter';

/**
 * 扩展激活时的入口函数
 *
 * 在 VS Code 启动时调用，注册 NASM 语言的 DocumentFormattingEditProvider。
 * 使用空 activationEvents（"onStartupFinished" 隐式行为），
 * 使得扩展在 VS Code 启动时即被加载，无需延迟激活。
 *
 * @param context - 扩展上下文，用于管理订阅的生命周期
 */
export function activate(context: vscode.ExtensionContext): void {
    // 创建格式化器实例
    const formatter = new NASMFormatter();

    // 注册文档格式化提供程序
    // 支持三种文件扩展名：.asm、.nasm、.s
    const providerDisposable = vscode.languages.registerDocumentFormattingEditProvider(
        { language: 'nasm', scheme: 'file' },
        formatter
    );

    // 也支持未保存的 untitled 文件
    const untitledProviderDisposable = vscode.languages.registerDocumentFormattingEditProvider(
        { language: 'nasm', scheme: 'untitled' },
        formatter
    );

    // 将订阅添加到上下文，VS Code 会在扩展停用时自动清理
    context.subscriptions.push(providerDisposable, untitledProviderDisposable);
}

/**
 * 扩展停用时的清理函数
 *
 * VS Code 在扩展停用时调用。目前无需特殊清理操作，
 * 所有订阅已通过 context.subscriptions 自动管理。
 */
export function deactivate(): void {
    // 无需额外清理
}
