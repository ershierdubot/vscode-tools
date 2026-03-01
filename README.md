# VSCode Tools

[![CI](https://github.com/ershierdubot/vscode-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/ershierdubot/vscode-tools/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.3.0-blue.svg)](https://github.com/ershierdubot/vscode-tools/releases)

A collection of useful development tools right in your VSCode sidebar.

## 🚀 Features

- 📊 **Parquet Viewer** - View and analyze Parquet files with search, sort, and export
- 🔧 **JSON Formatter** - Format, minify, and validate JSON
- 🔐 **Base64 Converter** - Encode and decode Base64 strings
- ⏰ **Timestamp Converter** - Coming soon!

## 📦 Installation

### From Source

1. Clone this repository:
   ```bash
   git clone https://github.com/ershierdubot/vscode-tools.git
   cd vscode-tools
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile TypeScript:
   ```bash
   npm run compile
   ```

4. Open in VSCode:
   ```bash
   code .
   ```

5. Press `F5` to launch Extension Development Host

## 🎯 Usage

### Opening the Extension

Click the **VSCode Tools** icon in the Activity Bar (left sidebar) to open the tools panel.

### Parquet Viewer

1. Click "Parquet Viewer" in the sidebar
2. Click "Load Parquet File" to select a .parquet file
3. View your data with:
   - **Search**: Type in the search box to filter rows
   - **Sort**: Click column headers to sort
   - **Export**: Export data to CSV format

### JSON Formatter

1. Click "JSON Formatter" in the sidebar
2. Paste your JSON in the input area
3. Click:
   - **Format** to pretty-print with indentation
   - **Minify** to compress to single line
   - **Validate** to check JSON syntax
   - **Load File** to open a JSON file

### Base64 Converter

1. Click "Base64 Converter" in the sidebar
2. Enter text in the input area
3. Click:
   - **Encode** to convert to Base64
   - **Decode** to convert from Base64
   - **Copy** to copy result to clipboard

## 🛠️ Development

### Project Structure

```
vscode-tools/
├── src/
│   ├── extension.ts              # Extension entry point
│   ├── providers/
│   │   └── toolsProvider.ts      # Sidebar tree view
│   ├── panels/
│   │   ├── parquetViewerPanel.ts
│   │   ├── jsonFormatterPanel.ts
│   │   └── base64ConverterPanel.ts
│   └── test/                     # Test files
├── resources/
│   └── icon.png                  # Extension icon
├── package.json                  # Extension manifest
└── README.md
```

### Available Scripts

```bash
npm run compile      # Compile TypeScript
npm run watch        # Watch mode for development
npm run test         # Run tests
npm run package      # Create VSIX package
npm run lint         # Type-check without emit
```

### Adding a New Tool

1. Create a new panel in `src/panels/yourToolPanel.ts`
2. Register the command in `src/extension.ts`
3. Add the tool to `src/providers/toolsProvider.ts`
4. Add command to `package.json` contributes.commands

## 📝 Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## 📋 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.

## 📄 License

This project is licensed under the MIT License - see [LICENSE](./LICENSE) for details.

## 🙏 Acknowledgments

- VSCode Team for the excellent extension API
- Contributors and users of this extension

---

**Enjoy coding!** 🎉

[Report Issue](https://github.com/ershierdubot/vscode-tools/issues) | [Request Feature](https://github.com/ershierdubot/vscode-tools/issues)
