# Changelog

All notable changes to the NASM Formatter extension will be documented in this file.

## [1.0.0] - 2024-01-15

### Added

- Initial release
- Document formatting via `DocumentFormattingEditProvider`
- Label-based indentation: labels determine code hierarchy, instructions auto-indent one level
- Label types supported: regular labels (`label:`), local labels (`.label:`), anonymous labels (`@@:`), macro-local labels (`%%label:`)
- Left-aligned directives: `section`, `global`, `extern`, `default`, `bits`, `cpu`, `org`, `align`, `struc`, `endstruc`, `segment`
- Left-aligned preprocessor: `%macro`, `%endmacro`, `%ifdef`, `%ifndef`, `%if`, `%elif`, `%else`, `%endif`, `%include`, `%define`, `%xdefine`
- Operand formatting: consistent spacing after commas
- Memory address formatting: spaces around operators inside brackets
- Comment alignment to configurable column
- Blank line management: collapse consecutive blank lines, auto-insert before labels
- Instruction case conversion (uppercase/lowercase)
- Full Tokenizer with character-by-character scanning
- NASM syntax TextMate grammar for highlighting
- Configurable via VS Code settings (10 configuration options)
- Support for `.asm`, `.nasm`, `.s` file extensions
