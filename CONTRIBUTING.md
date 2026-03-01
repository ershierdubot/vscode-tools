# Contributing to VSCode Tools

First off, thank you for considering contributing to VSCode Tools! It's people like you that make this extension better for everyone.

## 🚀 How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to see if the problem has already been reported. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples to demonstrate the steps**
- **Describe the behavior you observed and what behavior you expected**
- **Include screenshots if applicable**

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title**
- **Provide a step-by-step description of the suggested enhancement**
- **Provide specific examples to demonstrate the enhancement**
- **Explain why this enhancement would be useful**

### Pull Requests

1. Fork the repository
2. Create a new branch from `main`: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Run tests and ensure they pass
5. Commit your changes with a clear commit message
6. Push to your fork
7. Open a Pull Request

## 🛠️ Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v16.x or higher)
- [VSCode](https://code.visualstudio.com/)
- npm or yarn

### Setup Steps

```bash
# Clone your fork
git clone https://github.com/your-username/vscode-tools.git
cd vscode-tools

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Open in VSCode
code .
```

### Running the Extension

Press `F5` to open a new VSCode window with the extension loaded.

### Project Structure

```
vscode-tools/
├── src/                    # Source code
│   ├── extension.ts        # Extension entry point
│   ├── providers/          # Tree view providers
│   └── panels/             # Webview panels
├── out/                    # Compiled JavaScript (generated)
├── package.json            # Extension manifest
└── tsconfig.json          # TypeScript configuration
```

## 📝 Coding Standards

### TypeScript

- Use TypeScript for all new code
- Follow the existing code style
- Add type annotations where appropriate
- Use meaningful variable and function names

### Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

Example:
```
feat: Add CSV export functionality to Parquet Viewer

- Add export button to webview
- Implement CSV generation logic
- Add file save dialog

Fixes #123
```

### Code Review Process

All submissions require review. We use GitHub pull requests for this purpose.

## 🧪 Testing

- Write tests for new functionality
- Ensure all existing tests pass before submitting
- Test your changes manually in the Extension Development Host

## 📋 Checklist Before Submitting

- [ ] Code follows the project's style guidelines
- [ ] Self-review of code completed
- [ ] Code is commented, particularly in hard-to-understand areas
- [ ] Corresponding documentation changes made
- [ ] No new warnings generated
- [ ] Tests added and passing

## 🙏 Code of Conduct

This project and everyone participating in it is governed by our commitment to:

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Respect different viewpoints and experiences

## 📞 Questions?

Feel free to open an issue for any questions you may have.

Thank you for contributing! 🎉
