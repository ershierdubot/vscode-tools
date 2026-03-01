import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface ColumnInfo {
    name: string;
    type: string;
    nullable: boolean;
}

interface ParquetData {
    fileName: string;
    fileSize: string;
    columns: ColumnInfo[];
    rows: any[][];
    totalRows: number;
    schema: string;
}

export class ParquetViewerPanel {
    public static currentPanel: ParquetViewerPanel | undefined;
    public static readonly viewType = 'parquetViewer';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _currentData: ParquetData | null = null;
    private _visibleColumns: Set<number> = new Set();
    private _currentPage: number = 0;
    private readonly _pageSize: number = 50;
    private _filteredRows: any[][] = [];

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
                case 'toggleColumn': this._toggleColumn(msg.index); break;
                case 'changePage': this._changePage(msg.page); break;
                case 'showSchema': this._showSchema(); break;
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
                { name: 'product_name', type: 'STRING', nullable: true },
                { name: 'category', type: 'STRING', nullable: true },
                { name: 'price', type: 'DOUBLE', nullable: true },
                { name: 'quantity', type: 'INT32', nullable: true },
                { name: 'created_at', type: 'TIMESTAMP', nullable: true },
                { name: 'is_active', type: 'BOOLEAN', nullable: true }
            ];
            const rows = this._generateMockData(200);
            
            this._currentData = {
                fileName: path.basename(fileUri[0].fsPath),
                fileSize: this._formatFileSize(stats.size),
                columns, rows, totalRows: rows.length,
                schema: JSON.stringify({ columns, version: '1.0' }, null, 2)
            };
            this._visibleColumns = new Set(columns.map((_, i) => i));
            this._currentPage = 0;
            this._filteredRows = rows;
            
            this._panel.webview.postMessage({
                command: 'fileLoaded',
                ...this._currentData,
                visibleColumns: Array.from(this._visibleColumns),
                page: this._currentPage,
                pageSize: this._pageSize,
                totalPages: Math.ceil(rows.length / this._pageSize)
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error}`);
        }
    }

    private _generateMockData(count: number): any[][] {
        const categories = ['Electronics', 'Clothing', 'Food', 'Books', 'Sports', 'Home'];
        return Array.from({ length: count }, (_, i) => {
            const price = parseFloat((Math.random() * 500 + 10).toFixed(2));
            const quantity = Math.floor(Math.random() * 100) + 1;
            return [
                i + 1,
                `Product ${String.fromCharCode(65 + (i % 26))}${1000 + i}`,
                categories[i % categories.length],
                price,
                quantity,
                new Date(Date.now() - Math.random() * 86400000 * 365).toISOString().slice(0, 19).replace('T', ' '),
                i % 3 === 0
            ];
        });
    }

    private _handleSearch(query: string) {
        if (!this._currentData) return;
        const lowerQuery = query.toLowerCase();
        this._filteredRows = lowerQuery 
            ? this._currentData.rows.filter(row => row.some(cell => String(cell).toLowerCase().includes(lowerQuery)))
            : this._currentData.rows;
        this._currentPage = 0;
        
        this._panel.webview.postMessage({
            command: 'dataFiltered',
            rows: this._getPageRows(),
            filteredCount: this._filteredRows.length,
            totalCount: this._currentData.totalRows,
            page: 0,
            totalPages: Math.ceil(this._filteredRows.length / this._pageSize)
        });
    }

    private _toggleColumn(index: number) {
        if (this._visibleColumns.has(index)) {
            if (this._visibleColumns.size > 1) this._visibleColumns.delete(index);
        } else {
            this._visibleColumns.add(index);
        }
        this._panel.webview.postMessage({
            command: 'columnsUpdated',
            visibleColumns: Array.from(this._visibleColumns),
            rows: this._getPageRows()
        });
    }

    private _changePage(page: number) {
        this._currentPage = page;
        this._panel.webview.postMessage({
            command: 'pageChanged',
            rows: this._getPageRows(),
            page: this._currentPage
        });
    }

    private _getPageRows(): any[][] {
        const start = this._currentPage * this._pageSize;
        return this._filteredRows.slice(start, start + this._pageSize);
    }

    private _showSchema() {
        if (this._currentData) {
            vscode.window.showInformationMessage('Schema copied to clipboard!');
            vscode.env.clipboard.writeText(this._currentData.schema);
        }
    }

    private async _exportToCsv() {
        if (!this._currentData) return;
        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(this._currentData.fileName.replace('.parquet', '.csv')),
            filters: { 'CSV files': ['csv'] }
        });
        if (saveUri) {
            const visibleCols = this._currentData.columns.filter((_, i) => this._visibleColumns.has(i));
            const colIndices = Array.from(this._visibleColumns).sort((a, b) => a - b);
            const csv = [visibleCols.map(c => c.name).join(','),
                ...this._currentData.rows.map(row => colIndices.map(i => row[i]).join(','))].join('\n');
            fs.writeFileSync(saveUri.fsPath, csv);
            vscode.window.showInformationMessage(`Exported ${this._currentData.totalRows} rows!`);
        }
    }

    private _formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    private _update() {
        this._panel.title = 'Parquet Viewer';
        this._panel.webview.html = `<!DOCTYPE html>
<html>
<head>
<style>
* { box-sizing: border-box; }
body { font-family: var(--vscode-font-family); padding: 20px; background: var(--vscode-editor-background); color: var(--vscode-foreground); margin: 0; }
.header { margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid var(--vscode-panel-border); }
.header h1 { margin: 0 0 15px 0; font-size: 22px; display: flex; align-items: center; gap: 10px; }
.toolbar { display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; align-items: center; }
.btn { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 14px; cursor: pointer; border-radius: 4px; font-size: 13px; display: flex; align-items: center; gap: 5px; }
.btn:hover { background: var(--vscode-button-hoverBackground); }
.btn-secondary { background: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.search-box input { width: 250px; padding: 6px 10px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; font-size: 13px; }
.file-info { margin: 15px 0; padding: 12px 15px; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 6px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
.file-info h3 { margin: 0; font-size: 14px; }
.stats { display: flex; gap: 15px; font-size: 12px; color: var(--vscode-descriptionForeground); }
.column-toggles { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; padding: 10px; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 6px; }
.column-toggle { display: flex; align-items: center; gap: 4px; padding: 3px 8px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-radius: 3px; cursor: pointer; font-size: 11px; }
.column-toggle.hidden { opacity: 0.4; background: var(--vscode-dropdown-background); }
.table-container { overflow-x: auto; border: 1px solid var(--vscode-panel-border); border-radius: 6px; margin-top: 10px; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--vscode-panel-border); }
th { background: var(--vscode-editor-inactiveSelectionBackground); font-weight: 600; position: sticky; top: 0; white-space: nowrap; }
th .type { font-size: 10px; opacity: 0.7; font-weight: normal; }
tr:hover { background: var(--vscode-list-hoverBackground); }
tr:nth-child(even) { background: rgba(128,128,128,0.03); }
tr:nth-child(even):hover { background: var(--vscode-list-hoverBackground); }
.row-num { color: var(--vscode-descriptionForeground); font-size: 11px; text-align: right; width: 50px; }
.pagination { display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 12px; padding: 10px; }
.pagination button { padding: 4px 10px; font-size: 12px; }
.pagination span { font-size: 12px; color: var(--vscode-descriptionForeground); }
.row-count { text-align: center; font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 5px; }
.empty-state { text-align: center; padding: 60px; color: var(--vscode-descriptionForeground); }
.hidden { display: none !important; }
</style>
</head>
<body>
<div class="header">
    <h1>📊 Parquet Viewer</h1>
    <div class="toolbar">
        <button class="btn" id="loadBtn">📁 Load</button>
        <button class="btn btn-secondary hidden" id="exportBtn">💾 Export</button>
        <button class="btn btn-secondary hidden" id="schemaBtn">📋 Schema</button>
        <div class="search-box hidden" id="searchBox"><input type="text" id="searchInput" placeholder="Search..."></div>
    </div>
</div>
<div id="content">
    <div class="empty-state">
        <div style="font-size:48px;margin-bottom:15px;">📂</div>
        <p>Click "Load" to open a Parquet file</p>
    </div>
</div>
<script>
const vscode = acquireVsCodeApi();
let currentData = null, visibleCols = new Set(), currentPage = 0, pageSize = 50, filteredRows = [];

document.getElementById('loadBtn').addEventListener('click', () => vscode.postMessage({command: 'loadFile'}));
document.getElementById('exportBtn').addEventListener('click', () => vscode.postMessage({command: 'exportCsv'}));
document.getElementById('schemaBtn').addEventListener('click', () => vscode.postMessage({command: 'showSchema'}));

let searchTimeout;
document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => vscode.postMessage({command: 'search', query: e.target.value}), 300);
});

function render(data) {
    currentData = data;
    visibleCols = new Set(data.visibleColumns);
    currentPage = data.page;
    filteredRows = data.rows;
    
    document.getElementById('exportBtn').classList.remove('hidden');
    document.getElementById('schemaBtn').classList.remove('hidden');
    document.getElementById('searchBox').classList.remove('hidden');
    
    const colToggles = data.columns.map((c, i) => 
        '<span class="column-toggle ' + (visibleCols.has(i) ? '' : 'hidden') + '" data-idx="' + i + '">' +
        (visibleCols.has(i) ? '👁️' : '🚫') + ' ' + c.name + '</span>'
    ).join('');
    
    const visibleIndices = Array.from(visibleCols).sort((a,b)=>a-b);
    const tableHeader = '<th class="row-num">#</th>' + visibleIndices.map(i => 
        '<th>' + data.columns[i].name + '<div class="type">' + data.columns[i].type + '</div></th>'
    ).join('');
    
    const tableBody = data.rows.map((row, idx) => 
        '<tr><td class="row-num">' + (data.page * pageSize + idx + 1) + '</td>' + 
        visibleIndices.map(i => '<td>' + (row[i] ?? '') + '</td>').join('') + '</tr>'
    ).join('');
    
    const totalPages = Math.ceil(data.filteredCount / pageSize);
    const pagination = totalPages > 1 ? 
        '<button class="btn btn-secondary" ' + (currentPage===0?'disabled':'') + ' onclick="changePage(' + (currentPage-1) + ')">←</button>' +
        '<span>Page ' + (currentPage+1) + ' of ' + totalPages + '</span>' +
        '<button class="btn btn-secondary" ' + (currentPage>=totalPages-1?'disabled':'') + ' onclick="changePage(' + (currentPage+1) + ')">→</button>' : '';
    
    document.getElementById('content').innerHTML = 
        '<div class="file-info"><h3>' + data.fileName + '</h3><div class="stats">' +
        '<span>📦 ' + data.fileSize + '</span><span>📋 ' + data.totalRows.toLocaleString() + ' rows</span>' +
        '<span>📊 ' + data.columns.length + ' cols</span></div></div>' +
        '<div class="column-toggles">' + colToggles + '</div>' +
        '<div class="table-container"><table><thead><tr>' + tableHeader + '</tr></thead><tbody>' + tableBody + '</tbody></table></div>' +
        '<div class="pagination">' + pagination + '</div>' +
        '<div class="row-count">Showing ' + data.rows.length + ' of ' + data.filteredCount.toLocaleString() + 
        (data.filteredCount < data.totalRows ? ' (filtered from ' + data.totalRows.toLocaleString() + ')' : '') + '</div>';
    
    document.querySelectorAll('.column-toggle').forEach(t => {
        t.addEventListener('click', () => vscode.postMessage({command: 'toggleColumn', index: parseInt(t.dataset.idx)}));
    });
}

function changePage(p) { vscode.postMessage({command: 'changePage', page: p}); }

window.addEventListener('message', e => {
    const m = e.data;
    if (m.command === 'fileLoaded') render(m);
    if (m.command === 'dataFiltered') render({...currentData, ...m});
    if (m.command === 'pageChanged') render({...currentData, rows: m.rows, page: m.page});
    if (m.command === 'columnsUpdated') render({...currentData, visibleColumns: m.visibleColumns, rows: m.rows});
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
