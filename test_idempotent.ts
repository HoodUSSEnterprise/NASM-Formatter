/**
 * 幂等性测试 - format(format(code)) === format(code)
 *
 * 运行: npx ts-node test_idempotent.ts
 *
 * 注意: formatter.ts 依赖 vscode 模块，无法直接在 Node.js 中跑。
 * 完整流水线测试需要在 VS Code Extension Development Host 中验证。
 * 此处测试 Tokenizer + Parser + formatterRules 的关键修复。
 */
import { Tokenizer, TokenType } from './src/tokenizer';
import { NASMParser } from './src/parser';
import { extractValueTokens, formatDataValues, formatDataBlock, formatCommentText } from './src/formatterRules';
import { DEFAULT_OPTIONS, FormatterOptions } from './src/options';

const opts: FormatterOptions = { ...DEFAULT_OPTIONS };

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
    if (condition) {
        console.log(`  PASS: ${msg}`);
        passed++;
    } else {
        console.error(`  FAIL: ${msg}`);
        failed++;
    }
}

// ===== Test 1: extractValueTokens 排除 Comment Token =====
console.log('\n=== Test 1: extractValueTokens excludes Comment tokens ===');
{
    const line = 'msg db "hello", 0 ; comment';
    const tokens = new Tokenizer(line).tokenizeLineByLine()[0];
    const parsed = new NASMParser([tokens]).parse()[0];

    assert(parsed.commentText === '; comment', `Parser extracts commentText: "${parsed.commentText}"`);
    assert(parsed.dataLabel === 'msg', `Parser detects dataLabel: "${parsed.dataLabel}"`);

    const valueTokens = extractValueTokens(parsed.tokens, parsed.dataLabel);
    const hasComment = valueTokens.some(t => t.type === TokenType.Comment);
    assert(!hasComment, 'extractValueTokens output has no Comment tokens');

    const valuesStr = formatDataValues(valueTokens, opts);
    assert(!valuesStr.includes('comment'), `formatDataValues output does not contain "comment": "${valuesStr}"`);
    assert(valuesStr === '"hello", 0', `Values are correct: "${valuesStr}"`);
}

// ===== Test 2: 多行数据块中 Comment 不混入 Value =====
console.log('\n=== Test 2: Data block values are comment-free ===');
{
    const src = 'malloc_failed db "Memory allocation failed",10,0 ; malloc failed msg\ninvalid_param db "Invalid param!",10,0 ; invalid param msg';
    const tokens = new Tokenizer(src).tokenizeLineByLine();
    const parsed = new NASMParser(tokens).parse();

    const dataLines = parsed.filter(l => l.type === 'Data');
    assert(dataLines.length === 2, 'Found 2 data lines');

    for (const line of dataLines) {
        const values = extractValueTokens(line.tokens, line.dataLabel);
        const valuesStr = formatDataValues(values, opts);
        assert(!valuesStr.includes(';'), `Values for "${line.dataLabel}" have no semicolon: "${valuesStr}"`);
    }
}

// ===== Test 3: 字符串中的分号不被当作注释 =====
console.log('\n=== Test 3: Semicolons inside strings ===');
{
    const line = 'msg db "hello;world", 0';
    const tokens = new Tokenizer(line).tokenizeLineByLine()[0];
    const commentToken = tokens.find(t => t.type === TokenType.Comment);
    assert(!commentToken, 'No Comment token found for line with semicolon inside string');
}

// ===== Test 4: 数据块格式化幂等性 =====
console.log('\n=== Test 4: DataBlock idempotency ===');
{
    const src = 'msg db "hello",0 ; test\nlen equ $-msg ; length';
    const tokens = new Tokenizer(src).tokenizeLineByLine();
    const parsed = new NASMParser(tokens).parse();
    // Assign section name for data block formatting
    parsed.forEach(l => { if (l.type === 'Data') l.sectionName = '.rodata'; });
    const dataLines = parsed.filter(l => l.type === 'Data');

    const block1 = formatDataBlock(dataLines, opts);
    const block2 = formatDataBlock(
        new NASMParser(new Tokenizer(block1.join('\n')).tokenizeLineByLine()).parse()
            .filter(l => l.type === 'Data'),
        opts
    );

    assert(block1.join('\n') === block2.join('\n'), 'Data block pass 2 === pass 1');
}

// ===== Test 5: formatCommentText 幂等性 =====
console.log('\n=== Test 5: formatCommentText idempotency ===');
{
    const inputs = [
        '; test',
        ';  test',
        ';test',
    ];
    for (const inp of inputs) {
        const r1 = formatCommentText(inp);
        const r2 = formatCommentText(r1);
        assert(r1 === r2, `formatCommentText idempotent for "${inp}" → "${r1}"`);
    }
}

// ===== Test 6: 指令行 comment 不重复 =====
console.log('\n=== Test 6: Instruction comment not duplicated ===');
{
    // Simulate what happens: tokenize a formatted instruction line
    const formattedLine = '    mov eax, 1 ; set eax';
    const tokens = new Tokenizer(formattedLine).tokenizeLineByLine()[0];
    const parsed = new NASMParser([tokens]).parse()[0];

    // The comment should be extracted exactly once
    assert(parsed.commentText === '; set eax', `Comment extraction: "${parsed.commentText}"`);

    // Non-comment tokens should not contain any ";"
    const nonCommentText = parsed.tokens
        .filter(t => t.type !== TokenType.Comment)
        .map(t => t.value)
        .join('');
    assert(!nonCommentText.includes(';'), `Non-comment tokens contain no semicolon: "${nonCommentText}"`);
}

// Summary
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
