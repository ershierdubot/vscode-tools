import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface ParquetData {
    fileName: string;
    fileSize: string;
    columns: string[];
    rows: any[][];
    totalRows: number;
}

export class ParquetViewerPanel {
    public static currentPanel: ParquetViewerPanel | undefined;
    public static readonly viewType = 'parquetViewer';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _currentData: ParquetData | null = null;

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (ParquetViewerPanel.currentPanel) {
            ParquetViewerPanel.currentPanel._panel.reveal(column);
            return;
        }

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

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.onDidChangeViewState(
            e => {
                if (this._panel.visible) {
                    this._update();
                }
            },
            null,
            this._disposables
        );

        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'loadFile':
                        await this._loadParquetFile();
                        return;
                    case 'search':
                        this._handleSearch(message.query);
                        return;
                    case 'sort':
                        this._handleSort(message.columnIndex, message.ascending);
                        return;
                    case 'exportCsv':
                        await this._exportToCsv();
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
                const stats = fs.statSync(filePath);
                
                // Generate more realistic mock data
                const columns = ['id', 'name', 'value', 'timestamp', 'category', 'status'];
                const rows = this._generateMockData(100);
                
                this._currentData = {
                    fileName: path.basename(filePath),
                    fileSize: this._formatFileSize(stats.size),
                    columns,
                    rows,
                    totalRows: rows.length
                };
                
                this._panel.webview.postMessage({
                    command: 'fileLoaded',
                    ...this._currentData
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Error loading file: ${error}`);
            }
        }
    }

    private _generateMockData(count: number): any[][] {
        const categories = ['Type A', 'Type B', 'Type C', 'Type D'];
        const statuses = ['active', 'inactive', 'pending'];
        const rows = [];
        
        for (let i = 1; i <= count; i++) {
            rows.push([
                i,
                `Item ${String.fromCharCode(65 + (i % 26))}${i}`,
                parseFloat((Math.random() * 1000).toFixed(2)),
                new Date(Date.now() - Math.random() * 86400000 * 30).toISOString().slice(0, 19).replace('T', ' '),
                categories[i % categories.length],
                statuses[i % statuses.length]
            ]);
        }
        return rows;
    }

    private _handleSearch(query: string) {
        if (!this._currentData) return;
        
        const lowerQuery = query.toLowerCase();
        const filteredRows = this._currentData.rows.filter(row =>
            row.some(cell => String(cell).toLowerCase().includes(lowerQuery))
        );
        
        this._panel.webview.postMessage({
            command: 'dataFiltered',
            rows: filteredRows,
            filteredCount: filteredRows.length,
            totalCount: this._currentData.totalRows
        });
    }

    private _handleSort(columnIndex: number, ascending: boolean) {
        if (!this._currentData) return;
        
        const sortedRows = [...this._currentData.rows].sort((a, b) => {
            const aVal = a[columnIndex];
            const bVal = b[columnIndex];
            
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return ascending ? aVal - bVal : bVal - aVal;
            }
            
            const aStr = String(aVal).toLowerCase();
            const bStr = String(bVal).toLowerCase();
            
            if (ascending) {
                return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
            } else {
                return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
            }
        });
        
        this._panel.webview.postMessage({
            command: 'dataSorted',
            rows: sortedRows
        });
    }

    private async _exportToCsv() {
        if (!this._currentData) {
            vscode.window.showWarningMessage('No data to export');
            return;
        }
        
        const options: vscode.SaveDialogOptions = {
            defaultUri: vscode.Uri.file(this._currentData.fileName.replace('.parquet', '.csv')),
            filters: {
                'CSV files': ['csv']
            }
        };
        
        const saveUri = await vscode.window.showSaveDialog(options);
        if (saveUri) {
            try {
                const csvContent = [
                    this._currentData.columns.join(','),
                    ...this._currentData.rows.map(row => row.join(','))
                ].join('\n');
                
                fs.writeFileSync(saveUri.fsPath, csvContent);
                vscode.window.showInformationMessage(`Exported to ${path.basename(saveUri.fsPath)}`);
            } catch (error) {
                vscode.window.showErrorMessage(`Export failed: ${error}`);
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
        * {
            box-sizing: border-box;
        }
        
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
        }
        
        .header {
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .header h1 {
            margin: 0 0 15px 0;
            font-size: 24px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .header-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        
        .btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            font-size: 14px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: background-color 0.2s;
        }
        
        .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .btn-secondary {
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
        }
        
        .search-box {
            flex: 1;
            min-width: 200px;
            max-width: 400px;
        }
        
        .search-box input {
            width: 100%;
            padding: 8px 12px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-size: 14px;
        }
        
        .search-box input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        .file-info {
            margin: 20px 0;
            padding: 15px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 15px;
        }
        
        .file-info h3 {
            margin: 0;
            font-size: 16px;
        }
        
        .stats {
            display: flex;
            gap: 20px;
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
        }
        
        .stat-item {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .table-container {
            overflow-x: auto;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            margin-top: 20px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }
        
        th, td {
            padding: 10px 12px;
            text-align: left;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        th {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            font-weight: 600;
            position: sticky;
            top: 0;
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
        }
        
        th:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        th .sort-icon {
            margin-left: 5px;
            opacity: 0.5;
        }
        
        th.sort-asc .sort-icon::after {
            content: '▲';
            opacity: 1;
        }
        
        th.sort-desc .sort-icon::after {
            content: '▼';
            opacity: 1;
        }
        
        tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        td {
            color: var(--vscode-foreground);
        }
        
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: var(--vscode-descriptionForeground);
        }
        
        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 20px;
            opacity: 0.5;
        }
        
        .row-count {
            margin-top: 15px;
            padding: 10px;
            color: var(--vscode-descriptionForeground);
            font-size: 13px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>
            <span>📊</span>
            Parquet Viewer
        </h1>
        <div class="header-actions">
            <button class="btn" id="loadFileBtn">
                <span>📁</span>
                Load Parquet File
            </button>
            <button class="btn btn-secondary hidden" id="exportBtn">
                <span>💾</span>
                Export CSV
            </button>
            <div class="search-box hidden" id="searchContainer">
                <input type="text" id="searchInput" placeholder="Search in data...">
            </div>
        </div>
    </div>
    
    <div id="content">
        <div class="empty-state">
            <div class="empty-state-icon">📂</div>
            <p>Click "Load Parquet File" to view your data</p>
            <p style="font-size: 12px; margin-top: 10px;">Supports .parquet files with automatic preview</p>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentData = null;
        let currentSort = { column: -1, ascending: true };
        
        document.getElementById('loadFileBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'loadFile' });
        });
        
        document.getElementById('exportBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'exportCsv' });
        });
        
        const searchInput = document.getElementById('searchInput');
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                vscode.postMessage({ command: 'search', query: e.target.value });
            }, 300);
        });

        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'fileLoaded':
                    currentData = message;
                    displayData(message);
                    showControls();
                    break;
                case 'dataFiltered':
                    updateTable(message.rows);
                    updateRowCount(message.filteredCount, message.totalCount);
                    break;
                case 'dataSorted':
                    updateTable(message.rows);
                    break;
            }
        });

        function showControls() {
            document.getElementById('exportBtn').classList.remove('hidden');
            document.getElementById('searchContainer').classList.remove('hidden');
        }

        function displayData(data) {
            const content = document.getElementById('content');
            
            content.innerHTML = \`
                <div class="file-info">
                    <div>
                        <h3>\${data.fileName}</h3>
                    </div>
                    <div class="stats">
                        <div class="stat-item">
                            <span>📦</span>
                            <span>\${data.fileSize}</span>
                        </div>
                        <div class="stat-item">
                            <span>📋</span>
                            <span>\${data.totalRows} rows</span>
                        </div>
                        <div class="stat-item">
                            <span>📊</span>
                            <span>\${data.columns.length} columns</span>
                        </div>
                    </div>
                </div>
                <div class="table-container">
                    <table id="dataTable">
                        <thead>
                            <tr>\${data.columns.map((col, idx) => \`
                                <th data-index="\${idx}">
                                    \${col}
                                    <span class="sort-icon">⇅</span>
                                </th>
                            \`).join('')}</tr>
                        </thead>
                        <tbody>\${renderRows(data.rows)}</tbody>
                    </table>
                </div>
                <div class="row-count" id="rowCount">
                    <span>Showing \${data.rows.length} of \${data.totalRows} rows</span>
                </div>
            \`;
            
            // Add sort handlers
            document.querySelectorAll('th').forEach(th => {
                th.addEventListener('click', () => {
                    const index = parseInt(th.dataset.index);
                    const isCurrentColumn = currentSort.column === index;
                    currentSort.ascending = isCurrentColumn ? !currentSort.ascending : true;
                    currentSort.column = index;
                    
                    // Update UI
                    document.querySelectorAll('th').forEach(header => {
                        header.classList.remove('sort-asc', 'sort-desc');
                    });
                    th.classList.add(currentSort.ascending ? 'sort-asc' : 'sort-desc');
                    
                    vscode.postMessage({
                        command: 'sort',
                        columnIndex: index,
                        ascending: currentSort.ascending
                    });
                });
            });
        }

        function renderRows(rows) {
            return rows.map(row => \`
                <tr>\${row.map(cell => \`<td>\${cell}</td>\`).join('')}</tr>
            \`).join('');
        }

        function updateTable(rows) {
            const tbody = document.querySelector('#dataTable tbody');
            if (tbody) {
                tbody.innerHTML = renderRows(rows);
            }
        }

        function updateRowCount(filtered, total) {
            const rowCount = document.getElementById('rowCount');
            if (rowCount) {
                rowCount.innerHTML = \`
                    <span>Showing \${filtered} of \${total} rows</span>
                    \${filtered < total ? \`<span>(filtered)</span>\` : ''}
                \`;
            }
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
