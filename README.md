# NASM Formatter

A professional NASM assembly language formatter for Visual Studio Code.

Format your NASM assembly code with one keystroke. Supports `.asm`, `.nasm`, and `.s` files.

## Features

- **Label-based indentation** - Labels determine code hierarchy. Instructions under a label are automatically indented one level
- **Operand spacing** - Consistent spacing around commas, brackets, and operators
- **Comment alignment** - Align comments to a configurable column
- **Blank line management** - Remove extra blank lines, auto-insert blank lines before labels
- **Case control** - Uppercase or lowercase instruction mnemonics
- **Fully configurable** - Every formatting aspect is customizable via VS Code settings

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Press `Ctrl+Shift+X` to open Extensions view
3. Search for "NASM Formatter"
4. Click Install

### From VSIX file

1. Download the latest `.vsix` from [Releases](https://github.com/yourusername/nasm-formatter/releases)
2. In VS Code, press `Ctrl+Shift+P` and run `Extensions: Install from VSIX...`
3. Select the downloaded `.vsix` file

## Usage

1. Open a `.asm`, `.nasm`, or `.s` file
2. Press `Shift+Alt+F` (or `Ctrl+Shift+I` on some keyboards)
3. Alternatively, right-click and select "Format Document"

You can also enable "Format on Save" in VS Code settings:

```json
{
    "editor.formatOnSave": true
}
```

## Formatting Rules

### Label Hierarchy

Labels determine the indentation level. The formatter preserves label indentation and indents the following code one level:

```nasm
; Before formatting
loop1:
mov eax,1
mov ebx,2

    loop2:
mov ecx,3
mov edx,4

; After formatting
loop1:
    mov eax, 1
    mov ebx, 2

    loop2:
        mov ecx, 3
        mov edx, 4
```

### Left-Aligned Directives

These keywords always align to column 0:

```
section  global  extern  default  bits  cpu
org      align   struc   endstruc  segment

%macro  %endmacro  %ifdef  %ifndef  %if  %elif
%else   %endif     %include  %define  %xdefine
```

### Operand Spacing

```nasm
; Before
mov eax,ebx
imul rax,rbx,8
mov eax,[num]
mov eax,[rbx+rcx*4]

; After
mov eax, ebx
imul rax, rbx, 8
mov eax, [num]
mov eax, [rbx + rcx * 4]
```

### Comment Alignment

```nasm
; Before
mov eax,1;abc

; After
mov eax, 1          ; abc
```

## Configuration

All settings are under the `nasmFormatter.*` namespace.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `nasmFormatter.indentSize` | number | `4` | Indentation size in spaces |
| `nasmFormatter.alignComments` | boolean | `true` | Align comments to column |
| `nasmFormatter.commentColumn` | number | `40` | Comment alignment column |
| `nasmFormatter.keepLabelIndent` | boolean | `true` | Preserve label original indentation |
| `nasmFormatter.blankLineBeforeLabel` | boolean | `true` | Insert blank line before labels |
| `nasmFormatter.spaceAfterComma` | boolean | `true` | Add space after comma |
| `nasmFormatter.spaceInsideAddress` | boolean | `true` | Add spaces around operators in addresses |
| `nasmFormatter.removeExtraBlankLines` | boolean | `true` | Remove consecutive blank lines |
| `nasmFormatter.uppercaseInstruction` | boolean | `false` | Convert instructions to uppercase |
| `nasmFormatter.lowercaseInstruction` | boolean | `false` | Convert instructions to lowercase |

Note: `uppercaseInstruction` and `lowercaseInstruction` are mutually exclusive. If both are true, `uppercaseInstruction` takes precedence.

### Example settings.json

```json
{
    "nasmFormatter.indentSize": 4,
    "nasmFormatter.commentColumn": 50,
    "nasmFormatter.spaceAfterComma": true,
    "nasmFormatter.spaceInsideAddress": true,
    "nasmFormatter.uppercaseInstruction": true
}
```

## Keyboard Shortcuts

- `Shift+Alt+F` - Format document (VS Code default)
- `Ctrl+K Ctrl+F` - Format selection

You can customize shortcuts in `keybindings.json`:

```json
{
    "key": "ctrl+shift+f",
    "command": "editor.action.formatDocument",
    "when": "editorLangId == 'nasm'"
}
```

## Supported Language Constructs

| Construct | Support |
|-----------|---------|
| Labels (`label:`) | Full support |
| Local labels (`.label:`) | Full support |
| Anonymous labels (`@@:`) | Full support |
| Macro-local labels (`%%label:`) | Full support |
| Instructions (mov, add, jmp, etc.) | Full support |
| Directives (section, global, etc.) | Left-aligned |
| Preprocessor (%define, %macro, etc.) | Left-aligned |
| Data definitions (db, dw, dd, etc.) | Indented like instructions |
| Comments (`;`) | Column-aligned |
| Strings ('...', "...") | Preserved |
| Memory addresses (`[rbx+rcx]`) | Formatted with spaces |
| FPU/SSE/AVX instructions | Full support |

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [npm](https://www.npmjs.com/)

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/nasm-formatter.git
cd nasm-formatter

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Launch Extension Development Host
F5
```

### Project Structure

```
nasm-formatter/
├── .vscode/              # VS Code launch & task configuration
├── images/               # Extension icon
├── src/                  # TypeScript source files
│   ├── extension.ts      # Extension entry point
│   ├── formatter.ts      # Main formatter (DocumentFormattingEditProvider)
│   ├── tokenizer.ts      # Lexical analyzer
│   ├── parser.ts         # Syntax parser
│   ├── formatterRules.ts # Formatting rules
│   ├── options.ts        # Configuration interface
│   └── utils.ts          # Utility functions
├── syntaxes/             # TextMate grammars
│   └── nasm.tmLanguage.json
├── package.json          # Extension manifest
├── tsconfig.json         # TypeScript configuration
├── language-configuration.json
└── README.md
```

### Testing

Open any `.asm` file in the Extension Development Host and press `Shift+Alt+F`.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Future Plans

- Selection formatting support
- Range formatting
- Inline comment formatting options
- Multi-line macro support
- Indentation-based code folding
- Syntax error detection
- Integration with NASM preprocessor output
