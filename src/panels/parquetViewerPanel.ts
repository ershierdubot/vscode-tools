import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class ParquetViewerPanel {
    public static currentPanel: ParquetViewerPanel | undefined;
    public static readonly viewType = 'parquetViewer';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (ParquetViewerPanel.currentPanel) {
            ParquetViewerPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            ParquetViewerPanel.viewType,
            'Parquet Viewer',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri],
                retainContextWhenHidden: true
            }
        );

        ParquetViewerPanel.currentPanel = new ParquetViewerPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Update the content based on view changes
        this._panel.onDidChangeViewState(
            e => {
                if (this._panel.visible) {
                    this._update();
                }
            },
            null,
            this._disposables
        );

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'loadFile':
                        await this._loadParquetFile();
                        return;
                    case 'alert':
                        vscode.window.showErrorMessage(message.text);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    private async _loadParquetFile() {
        const options: vscode.OpenDialogOptions = {
            canSelectMany: false,
            openLabel: 'Load Parquet File',
            filters: {
                'Parquet files': ['parquet'],
                'All files': ['*']
            }
        };

        const fileUri = await vscode.window.showOpenDialog(options);
        if (fileUri && fileUri[0]) {
            const filePath = fileUri[0].fsPath;
            try {
                // For now, we'll use a simple approach to read the file
                // In a real implementation, you'd use a parquet library
                const stats = fs.statSync(filePath);
                
                // Send message to webview with file info
                this._panel.webview.postMessage({
                    command: 'fileLoaded',
                    fileName: path.basename(filePath),
                    fileSize: this._formatFileSize(stats.size),
                    // Mock data for demonstration
                    columns: ['id', 'name', 'value', 'timestamp', 'category'],
                    rows: [
                        [1, 'Item A', 100.5, '2024-01-15 10:30:00', 'Type 1'],
                        [2, 'Item B', 200.75, '2024-01-15 11:45:00', 'Type 2'],
                        [3, 'Item C', 150.0, '2024-01-15 12:00:00', 'Type 1'],
                        [4, 'Item D', 300.25, '2024-01-15 13:15:00', 'Type 3'],
                        [5, 'Item E', 175.5, '2024-01-15 14:30:00', 'Type 2']
                    ]
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Error loading file: ${error}`);
            }
        }
    }

    private _formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.title = 'Parquet Viewer';
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Parquet Viewer</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .header {
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .header h1 {
            margin: 0 0 10px 0;
            font-size: 24px;
        }
        .btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            font-size: 14px;
            border-radius: 2px;
        }
        .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .file-info {
            margin: 20px 0;
            padding: 15px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
        }
        .file-info h3 {
            margin: 0 0 10px 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th, td {
            padding: 10px;
            text-align: left;
            border: 1px solid var(--vscode-panel-border);
        }
        th {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            font-weight: bold;
        }
        tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .empty-state {
            text-align: center;
            padding: 50px;
            color: var(--vscode-descriptionForeground);
        }
        .row-count {
            margin-top: 15px;
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Parquet Viewer</h1>
        <button class="btn" id="loadFileBtn">Load Parquet File</button>
    </div>
    
    <div id="content">
        <div class="empty-state">
            <p>Click "Load Parquet File" to view your data</p>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        document.getElementById('loadFileBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'loadFile' });
        });

        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'fileLoaded':
                    displayData(message);
                    break;
            }
        });

        function displayData(data) {
            const content = document.getElementById('content');
            
            let html = \`
                <div class="file-info">
                    <h3>\${data.fileName}</h3>
                    <p>Size: \${data.fileSize}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            \${data.columns.map(col => \`<th>\${col}</th>\`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        \${data.rows.map(row => \`
                            <tr>
                                \${row.map(cell => \`<td>\${cell}</td>\`).join('')}
                            </tr>
                        \`).join('')}
                    </tbody>
                </table>
                <div class="row-count">Showing first \${data.rows.length} rows</div>
            \`;
            
            content.innerHTML = html;
        }
    </script>
</body>
</html>`;
    }

    public dispose() {
        ParquetViewerPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
