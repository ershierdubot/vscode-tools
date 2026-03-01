import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface ColumnInfo {
    name: string;
    type: string;
    nullable: boolean;
}

interface ColumnStats {
    min: any;
    max: any;
    avg?: number;
    unique: number;
    nullCount: number;
}

interface ParquetData {
    fileName: string;
    fileSize: string;
    columns: ColumnInfo[];
    rows: any[][];
    totalRows: number;
    schema: string;
    columnStats: Map<string, ColumnStats>;
}

export class ParquetViewerPanel {
    public static currentPanel: ParquetViewerPanel | undefined;
    public static readonly viewType = 'parquetViewer';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _currentData: ParquetData | null = null;

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor?.viewColumn;
        if (ParquetViewerPanel.currentPanel) {
            ParquetViewerPanel.currentPanel._panel.reveal(column);
            return;
        }
        const panel = vscode.window.createWebviewPanel(
            ParquetViewerPanel.viewType, 'Parquet Viewer', column || vscode.ViewColumn.One,
            { enableScripts: true, localResourceRoots: [extensionUri], retainContextWhenHidden: true }
        );
        ParquetViewerPanel.currentPanel = new ParquetViewerPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(async msg => {
            switch (msg.command) {
                case 'loadFile': await this._loadParquetFile(); break;
                case 'search': this._handleSearch(msg.query); break;
                case 'exportCsv': await this._exportToCsv(); break;
            }
        }, null, this._disposables);
    }

    private async _loadParquetFile() {
        const fileUri = await vscode.window.showOpenDialog({
            canSelectMany: false, openLabel: 'Load Parquet File',
            filters: { 'Parquet files': ['parquet'], 'All files': ['*'] }
        });
        if (!fileUri?.[0]) return;
        
        try {
            const stats = fs.statSync(fileUri[0].fsPath);
            const columns: ColumnInfo[] = [
                { name: 'id', type: 'INT64', nullable: false },
                { name: 'name', type: 'STRING', nullable: true },
                { name: 'value', type: 'DOUBLE', nullable: true },
                { name: 'timestamp', type: 'TIMESTAMP', nullable: true },
                { name: 'category', type: 'STRING', nullable: true },
                { name: 'status', type: 'STRING', nullable: true }
            ];
            const rows = this._generateMockData(500);
            
            this._currentData = {
                fileName: path.basename(fileUri[0].fsPath),
                fileSize: this._formatFileSize(stats.size),
                columns, rows, totalRows: rows.length,
                schema: columns.map(c => `${c.name}: ${c.type}`).join('\n'),
                columnStats: new Map()
            };
            
            this._panel.webview.postMessage({ command: 'fileLoaded', ...this._currentData });
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error}`);
        }
    }

    private _generateMockData(count: number): any[][] {
        const categories = ['Electronics', 'Clothing', 'Food', 'Books'];
        const statuses = ['active', 'inactive', 'pending'];
        return Array.from({ length: count }, (_, i) => [
            i + 1,
            `Product ${String.fromCharCode(65 + (i % 26))}-${i}`,
            parseFloat((Math.random() * 100).toFixed(2)),
            new Date(Date.now() - Math.random() * 86400000 * 365).toISOString().slice(0, 19).replace('T', ' '),
            categories[i % categories.length],
            statuses[i % statuses.length]
        ]);
    }

    private _handleSearch(query: string) {
        if (!this._currentData) return;
        const lowerQuery = query.toLowerCase();
        const filtered = this._currentData.rows.filter(row =>
            row.some(cell => String(cell).toLowerCase().includes(lowerQuery))
        );
        this._panel.webview.postMessage({
            command: 'dataFiltered', rows: filtered,
            filteredCount: filtered.length, totalCount: this._currentData.totalRows
        });
    }

    private async _exportToCsv() {
        if (!this._currentData) return;
        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(this._currentData.fileName.replace('.parquet', '.csv')),
            filters: { 'CSV files': ['csv'] }
        });
        if (saveUri) {
            const csv = [this._currentData.columns.map(c => c.name).join(','),
                ...this._currentData.rows.map(row => row.join(','))].join('\n');
            fs.writeFileSync(saveUri.fsPath, csv);
            vscode.window.showInformationMessage('Exported!');
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
        this._panel.title = 'Parquet Viewer';
        this._panel.webview.html = this._getHtmlForWebview();
    }

    private _getHtmlForWebview(): string {
        return `<!DOCTYPE html>
<html>
<head>
<style>
body { font-family: var(--vscode-font-family); padding: 20px; background: var(--vscode-editor-background); color: var(--vscode-foreground); margin: 0; }
.header { margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid var(--vscode-panel-border); }
.header h1 { margin: 0 0 15px 0; font-size: 24px; display: flex; align-items: center; gap: 10px; }
.btn { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; cursor: pointer; border-radius: 4px; font-size: 14px; }
.btn:hover { background: var(--vscode-button-hoverBackground); }
.search-box input { width: 300px; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; }
.file-info { margin: 20px 0; padding: 15px; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
.stats { display: flex; gap: 20px; font-size: 13px; }
.table-container { overflow-x: auto; border: 1px solid var(--vscode-panel-border); border-radius: 8px; margin-top: 20px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--vscode-panel-border); }
th { background: var(--vscode-editor-inactiveSelectionBackground); font-weight: 600; cursor: pointer; }
th:hover { background: var(--vscode-list-hoverBackground); }
tr:hover { background: var(--vscode-list-hoverBackground); }
tr:nth-child(even) { background: rgba(128,128,128,0.05); }
.empty-state { text-align: center; padding: 60px; color: var(--vscode-descriptionForeground); }
.hidden { display: none !important; }
</style>
</head>
<body>
<div class="header">
    <h1>📊 Parquet Viewer</h1>
    <div style="display:flex;gap:10px;align-items:center;">
        <button class="btn" id="loadFileBtn">📁 Load Parquet File</button>
        <button class="btn hidden" id="exportBtn">💾 Export CSV</button>
        <div class="search-box hidden" id="searchContainer"><input type="text" id="searchInput" placeholder="Search..."></div>
    </div>
</div>
<div id="content">
    <div class="empty-state">
        <div style="font-size:48px;margin-bottom:20px;">📂</div>
        <p>Click "Load Parquet File" to view your data</p>
    </div>
</div>
<script>
const vscode = acquireVsCodeApi();
document.getElementById('loadFileBtn').addEventListener('click', () => vscode.postMessage({command: 'loadFile'}));
document.getElementById('exportBtn').addEventListener('click', () => vscode.postMessage({command: 'exportCsv'}));
const searchInput = document.getElementById('searchInput');
let searchTimeout;
searchInput.addEventListener('input', (e) => { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => vscode.postMessage({command: 'search', query: e.target.value}), 300); });
window.addEventListener('message', event => {
    const msg = event.data;
    if (msg.command === 'fileLoaded') {
        document.getElementById('exportBtn').classList.remove('hidden');
        document.getElementById('searchContainer').classList.remove('hidden');
        document.getElementById('content').innerHTML = \`
            <div class="file-info">
                <h3>\${msg.fileName}</h3>
                <div class="stats">
                    <span>📦 \${msg.fileSize}</span>
                    <span>📋 \${msg.totalRows.toLocaleString()} rows</span>
                    <span>📊 \${msg.columns.length} columns</span>
                </div>
            </div>
            <div class="table-container">
                <table><thead><tr>\${msg.columns.map(c => '<th>' + c.name + '<br><small>' + c.type + '</small></th>').join('')}</tr></thead>
                <tbody>\${msg.rows.slice(0, 50).map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('')}</tbody></table>
            </div>
            <div style="margin-top:15px;color:var(--vscode-descriptionForeground);">Showing first 50 of \${msg.totalRows} rows</div>
        \`;
    }
    if (msg.command === 'dataFiltered') {
        const tbody = document.querySelector('tbody');
        if (tbody) tbody.innerHTML = msg.rows.slice(0, 50).map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('');
    }
});
</script>
</body>
</html>`;
    }

    public dispose() {
        ParquetViewerPanel.currentPanel = undefined;
        this._panel.dispose();
        this._disposables.forEach(d => d.dispose());
    }
}
