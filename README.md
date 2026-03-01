# VSCode Tools

A curated collection of VSCode extensions and development utilities designed to boost productivity and streamline the development workflow.

## 🎯 Overview

This repository serves as a centralized hub for custom VSCode extensions and development tools. Whether you're looking for productivity enhancers, code quality tools, or workflow optimizers, you'll find them here.

## 📦 Extensions

### Core Extensions

| Extension | Description | Status |
|-----------|-------------|--------|
| `toolkit-core` | Essential development utilities | 🚧 In Progress |
| `code-snippets` | Reusable code templates | 📋 Planned |
| `git-enhancer` | Advanced Git integration | 📋 Planned |

### Utility Tools

- **File Manager**: Quick file operations and navigation
- **Project Scaffolder**: Generate project templates instantly
- **Code Formatter**: Custom formatting rules and presets

## 🚀 Getting Started

### Prerequisites

- [VSCode](https://code.visualstudio.com/) (version 1.60.0 or higher)
- [Node.js](https://nodejs.org/) (version 16.x or higher)
- npm or yarn package manager

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/ershierdubot/vscode-tools.git
   cd vscode-tools
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Open in VSCode:
   ```bash
   code .
   ```

4. Press `F5` to launch the Extension Development Host

## 🛠️ Development

### Project Structure

```
vscode-tools/
├── extensions/
│   ├── toolkit-core/
│   ├── code-snippets/
│   └── git-enhancer/
├── docs/
├── scripts/
└── README.md
```

### Building Extensions

```bash
# Build all extensions
npm run build

# Build specific extension
npm run build:toolkit-core

# Watch mode for development
npm run watch
```

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 📝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Contribution Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- VSCode Team for the excellent extension API
- Open source community for inspiration and tools
- Contributors who make this project better

---

**Happy Coding!** 🎉

For issues and feature requests, please use the [GitHub Issues](https://github.com/ershierdubot/vscode-tools/issues) page.
