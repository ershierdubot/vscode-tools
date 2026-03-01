import * as vscode from 'vscode';

export class JsonFormatterPanel {
    public static currentPanel: JsonFormatterPanel | undefined;
    public static readonly viewType = 'jsonFormatter';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (JsonFormatterPanel.currentPanel) {
            JsonFormatterPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            JsonFormatterPanel.viewType,
            'JSON Formatter',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri],
                retainContextWhenHidden: true
            }
        );

        JsonFormatterPanel.currentPanel = new JsonFormatterPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'format':
                        this._handleFormat(message.json, message.indent);
                        return;
                    case 'minify':
                        this._handleMinify(message.json);
                        return;
                    case 'validate':
                        this._handleValidate(message.json);
                        return;
                    case 'loadFile':
                        await this._loadJsonFile();
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    private _handleFormat(json: string, indent: number) {
        try {
            const parsed = JSON.parse(json);
            const formatted = JSON.stringify(parsed, null, indent);
            this._panel.webview.postMessage({
                command: 'formatSuccess',
                result: formatted
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'error',
                message: `Invalid JSON: ${error}`
            });
        }
    }

    private _handleMinify(json: string) {
        try {
            const parsed = JSON.parse(json);
            const minified = JSON.stringify(parsed);
            this._panel.webview.postMessage({
                command: 'minifySuccess',
                result: minified
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'error',
                message: `Invalid JSON: ${error}`
            });
        }
    }

    private _handleValidate(json: string) {
        try {
            JSON.parse(json);
            this._panel.webview.postMessage({
                command: 'validateSuccess',
                message: 'Valid JSON'
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'error',
                message: `Invalid JSON: ${error}`
            });
        }
    }

    private async _loadJsonFile() {
        const options: vscode.OpenDialogOptions = {
            canSelectMany: false,
            openLabel: 'Load JSON File',
            filters: {
                'JSON files': ['json'],
                'All files': ['*']
            }
        };

        const fileUri = await vscode.window.showOpenDialog(options);
        if (fileUri && fileUri[0]) {
            try {
                const content = await vscode.workspace.fs.readFile(fileUri[0]);
                const text = new TextDecoder().decode(content);
                this._panel.webview.postMessage({
                    command: 'fileLoaded',
                    content: text
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Error loading file: ${error}`);
            }
        }
    }

    private _update() {
        this._panel.title = 'JSON Formatter';
        this._panel.webview.html = this._getHtmlForWebview();
    }

    private _getHtmlForWebview(): string {
        return `<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: var(--vscode-font-family); padding: 20px; }
        .btn { 
            background: var(--vscode-button-background); 
            color: var(--vscode-button-foreground);
            border: none; padding: 8px 16px; margin: 5px; cursor: pointer;
        }
        textarea { 
            width: 100%; height: 200px; 
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
        }
    </style>
</head>
<body>
    <h1>JSON Formatter</h1>
    <button class="btn" onclick="loadFile()">Load File</button>
    <button class="btn" onclick="format()">Format</button>
    <button class="btn" onclick="minify()">Minify</button>
    <button class="btn" onclick="validate()">Validate</button>
    <br><br>
    <textarea id="input" placeholder="Input JSON"></textarea>
    <textarea id="output" placeholder="Output" readonly></textarea>
    <div id="status"></div>
    <script>
        const vscode = acquireVsCodeApi();
        function loadFile() { vscode.postMessage({command: 'loadFile'}); }
        function format() { 
            vscode.postMessage({command: 'format', json: document.getElementById('input').value, indent: 2}); 
        }
        function minify() { 
            vscode.postMessage({command: 'minify', json: document.getElementById('input').value}); 
        }
        function validate() { 
            vscode.postMessage({command: 'validate', json: document.getElementById('input').value}); 
        }
        window.addEventListener('message', e => {
            const msg = e.data;
            if (msg.command === 'fileLoaded') document.getElementById('input').value = msg.content;
            if (msg.command === 'formatSuccess') document.getElementById('output').value = msg.result;
            if (msg.command === 'minifySuccess') document.getElementById('output').value = msg.result;
            document.getElementById('status').innerText = msg.message || '';
        });
    </script>
</body>
</html>`;
    }

    public dispose() {
        JsonFormatterPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            this._disposables.pop()?.dispose();
        }
    }
}
