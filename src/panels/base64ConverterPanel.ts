import * as vscode from 'vscode';

export class Base64ConverterPanel {
    public static currentPanel: Base64ConverterPanel | undefined;
    public static readonly viewType = 'base64Converter';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (Base64ConverterPanel.currentPanel) {
            Base64ConverterPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            Base64ConverterPanel.viewType,
            'Base64 Converter',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri],
                retainContextWhenHidden: true
            }
        );

        Base64ConverterPanel.currentPanel = new Base64ConverterPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'encode':
                        this._encode(message.text);
                        return;
                    case 'decode':
                        this._decode(message.text);
                        return;
                    case 'copy':
                        await vscode.env.clipboard.writeText(message.text);
                        vscode.window.showInformationMessage('Copied to clipboard!');
                        return;
                    case 'clear':
                        this._panel.webview.postMessage({ command: 'cleared' });
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    private _encode(text: string) {
        try {
            const encoded = Buffer.from(text).toString('base64');
            this._panel.webview.postMessage({
                command: 'encoded',
                result: encoded,
                originalLength: text.length,
                encodedLength: encoded.length
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'error',
                message: `Encoding error: ${error}`
            });
        }
    }

    private _decode(text: string) {
        try {
            const decoded = Buffer.from(text, 'base64').toString('utf8');
            this._panel.webview.postMessage({
                command: 'decoded',
                result: decoded,
                originalLength: text.length,
                decodedLength: decoded.length
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'error',
                message: 'Invalid Base64 string'
            });
        }
    }

    private _update() {
        this._panel.title = 'Base64 Converter';
        this._panel.webview.html = this._getHtmlForWebview();
    }

    private _getHtmlForWebview(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        h1 {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 20px;
        }
        .toolbar {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
            flex-wrap: wrap;
        }
        .btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 14px;
        }
        .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .btn-secondary {
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
        }
        textarea {
            width: 100%;
            height: 150px;
            padding: 10px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-family: var(--vscode-editor-font-family);
            resize: vertical;
        }
        .panel {
            margin-bottom: 20px;
        }
        .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .stats {
            margin-top: 15px;
            padding: 10px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
            font-size: 13px;
        }
        .error {
            color: var(--vscode-errorForeground);
            margin-top: 10px;
            padding: 10px;
            background-color: var(--vscode-inputValidation-errorBackground);
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <h1><span>🔐</span> Base64 Converter</h1>
    
    <div class="toolbar">
        <button class="btn" id="encodeBtn">Encode to Base64</button>
        <button class="btn btn-secondary" id="decodeBtn">Decode from Base64</button>
        <button class="btn btn-secondary" id="clearBtn">Clear</button>
    </div>
    
    <div class="panel">
        <div class="panel-header">
            <strong>Input</strong>
        </div>
        <textarea id="inputArea" placeholder="Enter text here..."></textarea>
    </div>
    
    <div class="panel">
        <div class="panel-header">
            <strong>Output</strong>
            <button class="btn btn-secondary" id="copyBtn" style="padding: 4px 12px; font-size: 12px;">Copy</button>
        </div>
        <textarea id="outputArea" readonly placeholder="Result will appear here..."></textarea>
    </div>
    
    <div class="stats" id="stats"></div>
    <div id="error"></div>

    <script>
        const vscode = acquireVsCodeApi();
        
        const inputArea = document.getElementById('inputArea');
        const outputArea = document.getElementById('outputArea');
        const statsDiv = document.getElementById('stats');
        const errorDiv = document.getElementById('error');
        
        document.getElementById('encodeBtn').addEventListener('click', () => {
            errorDiv.innerHTML = '';
            vscode.postMessage({ command: 'encode', text: inputArea.value });
        });
        
        document.getElementById('decodeBtn').addEventListener('click', () => {
            errorDiv.innerHTML = '';
            vscode.postMessage({ command: 'decode', text: inputArea.value });
        });
        
        document.getElementById('clearBtn').addEventListener('click', () => {
            inputArea.value = '';
            outputArea.value = '';
            statsDiv.innerHTML = '';
            errorDiv.innerHTML = '';
        });
        
        document.getElementById('copyBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'copy', text: outputArea.value });
        });
        
        window.addEventListener('message', event => {
            const msg = event.data;
            
            switch (msg.command) {
                case 'encoded':
                    outputArea.value = msg.result;
                    statsDiv.innerHTML = \`Original: \${msg.originalLength} chars | Encoded: \${msg.encodedLength} chars\`;
                    break;
                case 'decoded':
                    outputArea.value = msg.result;
                    statsDiv.innerHTML = \`Original: \${msg.originalLength} chars | Decoded: \${msg.decodedLength} chars\`;
                    break;
                case 'error':
                    errorDiv.innerHTML = \`<div class="error">\${msg.message}</div>\`;
                    break;
            }
        });
    </script>
</body>
</html>`;
    }

    public dispose() {
        Base64ConverterPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            this._disposables.pop()?.dispose();
        }
    }
}
