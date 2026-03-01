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
    stats: Map<number, ColumnStats>;
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
                case 'exportJson': await this._exportToJson(); break;
                case 'toggleColumn': this._toggleColumn(msg.index); break;
                case 'changePage': this._changePage(msg.page); break;
                case 'showSchema': this._showSchema(); break;
                case 'showStats': this._showStats(msg.index); break;
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
            const colStats = this._calculateStats(columns, rows);
            
            this._currentData = {
                fileName: path.basename(fileUri[0].fsPath),
                fileSize: this._formatFileSize(stats.size),
                columns, rows, totalRows: rows.length,
                schema: JSON.stringify({ columns, version: '1.0' }, null, 2),
                stats: colStats
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
                totalPages: Math.ceil(rows.length / this._pageSize),
                stats: Object.fromEntries(colStats)
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

    private _calculateStats(columns: ColumnInfo[], rows: any[][]): Map<number, ColumnStats> {
        const stats = new Map<number, ColumnStats>();
        columns.forEach((col, idx) => {
            const values = rows.map(r => r[idx]).filter(v => v !== null && v !== undefined);
            const numeric = col.type === 'INT64' || col.type === 'INT32' || col.type === 'DOUBLE';
            const nums = numeric ? values.map(v => Number(v)).filter(n => !isNaN(n)) : [];
            
            stats.set(idx, {
                min: numeric && nums.length ? Math.min(...nums) : values.length ? values.reduce((a, b) => String(a) < String(b) ? a : b) : null,
                max: numeric && nums.length ? Math.max(...nums) : values.length ? values.reduce((a, b) => String(a) > String(b) ? a : b) : null,
                avg: nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : undefined,
                unique: new Set(values.map(v => String(v))).size,
                nullCount: rows.length - values.length
            });
        });
        return stats;
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
            vscode.env.clipboard.writeText(this._currentData.schema);
            vscode.window.showInformationMessage('Schema copied to clipboard!');
        }
    }

    private _showStats(index: number) {
        if (!this._currentData) return;
        const stat = this._currentData.stats.get(index);
        const col = this._currentData.columns[index];
        if (stat) {
            const msg = `📊 ${col.name} (${col.type})
• Min: ${stat.min ?? 'N/A'}
• Max: ${stat.max ?? 'N/A'}${stat.avg !== undefined ? `
• Avg: ${stat.avg.toFixed(2)}` : ''}
• Unique: ${stat.unique}
• Nulls: ${stat.nullCount}`;
            vscode.window.showInformationMessage(msg, { modal: true });
        }
    }

    private async _exportToCsv() {
        if (!this._currentData) return;
        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(this._currentData.fileName.replace('.parquet', '.csv')),
            filters: { 'CSV files': ['csv'] }
        });
        if (saveUri) {
            const colIndices = Array.from(this._visibleColumns).sort((a, b) => a - b);
            const csv = [colIndices.map(i => this._currentData!.columns[i].name).join(','),
                ...this._currentData.rows.map(row => colIndices.map(i => row[i]).join(','))].join('\n');
            fs.writeFileSync(saveUri.fsPath, csv);
            vscode.window.showInformationMessage(`Exported ${this._currentData.totalRows} rows to CSV!`);
        }
    }

    private async _exportToJson() {
        if (!this._currentData) return;
        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(this._currentData.fileName.replace('.parquet', '.json')),
            filters: { 'JSON files': ['json'] }
        });
        if (saveUri) {
            const colIndices = Array.from(this._visibleColumns).sort((a, b) => a - b);
            const jsonData = this._currentData.rows.map(row => {
                const obj: any = {};
                colIndices.forEach(i => obj[this._currentData!.columns[i].name] = row[i]);
                return obj;
            });
            fs.writeFileSync(saveUri.fsPath, JSON.stringify(jsonData, null, 2));
            vscode.window.showInformationMessage(`Exported ${this._currentData.totalRows} rows to JSON!`);
        }
    }

    private _formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    private _getTypeIcon(type: string): string {
        const icons: Record<string, string> = {
            'INT64': '🔢', 'INT32': '🔢', 'DOUBLE': '💰', 'FLOAT': '💰',
            'STRING': '📝', 'BOOLEAN': '☑️', 'TIMESTAMP': '📅', 'DATE': '📅'
        };
        return icons[type] || '📄';
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
.btn { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 14px; cursor: pointer; border-radius: 4px; font-size: 13px; display: flex; align-items: center; gap: 5px; transition: all 0.2s; }
.btn:hover { background: var(--vscode-button-hoverBackground); transform: translateY(-1px); }
.btn-secondary { background: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.search-box input { width: 250px; padding: 6px 10px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; font-size: 13px; }
.file-info { margin: 15px 0; padding: 12px 15px; background: linear-gradient(135deg, var(--vscode-editor-inactiveSelectionBackground) 0%, var(--vscode-dropdown-background) 100%); border-radius: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.file-info h3 { margin: 0; font-size: 14px; }
.stats { display: flex; gap: 15px; font-size: 12px; }
.stat-item { background: var(--vscode-editor-background); padding: 4px 10px; border-radius: 4px; }
.column-toggles { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; padding: 10px; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 6px; }
.column-toggle { display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-radius: 4px; cursor: pointer; font-size: 11px; transition: all 0.2s; }
.column-toggle:hover { transform: scale(1.05); }
.column-toggle.hidden { opacity: 0.4; background: var(--vscode-dropdown-background); }
.table-container { overflow-x: auto; border: 1px solid var(--vscode-panel-border); border-radius: 8px; margin-top: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th, td { padding: 10px; text-align: left; border-bottom: 1px solid var(--vscode-panel-border); }
th { background: linear-gradient(180deg, var(--vscode-editor-inactiveSelectionBackground) 0%, var(--vscode-dropdown-background) 100%); font-weight: 600; position: sticky; top: 0; white-space: nowrap; cursor: pointer; transition: background 0.2s; }
th:hover { background: var(--vscode-list-hoverBackground); }
th .type-icon { margin-right: 5px; }
th .type { font-size: 10px; opacity: 0.7; font-weight: normal; margin-left: 5px; }
tr:hover { background: var(--vscode-list-hoverBackground); }
tr:nth-child(even) { background: rgba(128,128,128,0.03); }
tr:nth-child(even):hover { background: var(--vscode-list-hoverBackground); }
.row-num { color: var(--vscode-descriptionForeground); font-size: 11px; text-align: right; width: 50px; background: rgba(128,128,128,0.05); }
.cell-number { text-align: right; font-family: var(--vscode-editor-font-family); }
.cell-boolean { text-align: center; font-weight: 600; }
.cell-true { color: var(--vscode-testing-iconPassed); }
.cell-false { color: var(--vscode-testing-iconFailed); }
.cell-string { color: var(--vscode-symbolIcon-stringForeground); }
.cell-null { color: var(--vscode-descriptionForeground); font-style: italic; }
.pagination { display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 15px; padding: 10px; }
.pagination button { padding: 6px 14px; font-size: 12px; }
.pagination span { font-size: 13px; color: var(--vscode-foreground); font-weight: 500; }
.row-count { text-align: center; font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 5px; padding: 8px; }
.empty-state { text-align: center; padding: 80px 20px; color: var(--vscode-descriptionForeground); }
.empty-state-icon { font-size: 64px; margin-bottom: 20px; opacity: 0.3; }
.export-menu { position: relative; display: inline-block; }
.export-dropdown { display: none; position: absolute; top: 100%; left: 0; background: var(--vscode-dropdown-background); border: 1px solid var(--vscode-panel-border); border-radius: 4px; z-index: 100; min-width: 120px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
.export-dropdown.show { display: block; }
.export-dropdown button { display: block; width: 100%; padding: 8px 12px; text-align: left; border: none; background: none; color: var(--vscode-dropdown-foreground); cursor: pointer; font-size: 12px; }
.export-dropdown button:hover { background: var(--vscode-list-hoverBackground); }
.hidden { display: none !important; }
</style>
</head>
<body>
<div class="header">
    <h1>📊 Parquet Viewer</h1>
    <div class="toolbar">
        <button class="btn" id="loadBtn">📁 Load</button>
        <div class="export-menu hidden" id="exportMenu">
            <button class="btn btn-secondary" id="exportBtn">💾 Export ▼</button>
            <div class="export-dropdown" id="exportDropdown">
                <button onclick="exportFile('csv')">📄 Export as CSV</button>
                <button onclick="exportFile('json')">📋 Export as JSON</button>
            </div>
        </div>
        <button class="btn btn-secondary hidden" id="schemaBtn">📋 Schema</button>
        <div class="search-box hidden" id="searchBox"><input type="text" id="searchInput" placeholder="🔍 Search..."></div>
    </div>
</div>
<div id="content">
    <div class="empty-state">
        <div class="empty-state-icon">📂</div>
        <p>Click "Load" to open a Parquet file</p>
    </div>
</div>
<script>
const vscode = acquireVsCodeApi();
const typeIcons = {'INT64':'🔢','INT32':'🔢','DOUBLE':'💰','FLOAT':'💰','STRING':'📝','BOOLEAN':'☑️','TIMESTAMP':'📅','DATE':'📅'};
let currentData = null, visibleCols = new Set(), currentPage = 0, pageSize = 50, filteredRows = [];

document.getElementById('loadBtn').addEventListener('click', () => vscode.postMessage({command: 'loadFile'}));
document.getElementById('schemaBtn').addEventListener('click', () => vscode.postMessage({command: 'showSchema'}));
document.getElementById('exportBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('exportDropdown').classList.toggle('show');
});
document.addEventListener('click', () => document.getElementById('exportDropdown').classList.remove('show'));

function exportFile(format) { vscode.postMessage({command: format === 'csv' ? 'exportCsv' : 'exportJson'}); }

let searchTimeout;
document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => vscode.postMessage({command: 'search', query: e.target.value}), 300);
});

function formatCell(value, type) {
    if (value === null || value === undefined) return '<span class="cell-null">NULL</span>';
    if (type === 'BOOLEAN') return '<span class="cell-boolean cell-' + value + '">' + (value ? '✓ true' : '✗ false') + '</span>';
    if (type === 'DOUBLE' || type === 'FLOAT' || type === 'INT64' || type === 'INT32') return '<span class="cell-number">' + value + '</span>';
    if (type === 'STRING') return '<span class="cell-string">' + value + '</span>';
    return String(value);
}

function render(data) {
    currentData = data;
    visibleCols = new Set(data.visibleColumns);
    currentPage = data.page;
    filteredRows = data.rows;
    
    document.getElementById('exportMenu').classList.remove('hidden');
    document.getElementById('schemaBtn').classList.remove('hidden');
    document.getElementById('searchBox').classList.remove('hidden');
    
    const colToggles = data.columns.map((c, i) => 
        '<span class="column-toggle ' + (visibleCols.has(i) ? '' : 'hidden') + '" data-idx="' + i + '">' +
        (visibleCols.has(i) ? '👁️' : '🚫') + ' ' + c.name + '</span>'
    ).join('');
    
    const visibleIndices = Array.from(visibleCols).sort((a,b)=>a-b);
    const tableHeader = '<th class="row-num">#</th>' + visibleIndices.map(i => 
        '<th data-idx="' + i + '"><span class="type-icon">' + (typeIcons[data.columns[i].type] || '📄') + '</span>' + 
        data.columns[i].name + '<span class="type">' + data.columns[i].type + '</span></th>'
    ).join('');
    
    const tableBody = data.rows.map((row, idx) => 
        '<tr><td class="row-num">' + (data.page * pageSize + idx + 1) + '</td>' + 
        visibleIndices.map(i => '<td>' + formatCell(row[i], data.columns[i].type) + '</td>').join('') + '</tr>'
    ).join('');
    
    const totalPages = Math.ceil(data.filteredCount / pageSize);
    const pagination = totalPages > 1 ? 
        '<button class="btn btn-secondary" ' + (currentPage===0?'disabled':'') + ' onclick="changePage(' + (currentPage-1) + ')">← Prev</button>' +
        '<span>Page ' + (currentPage+1) + ' of ' + totalPages + '</span>' +
        '<button class="btn btn-secondary" ' + (currentPage>=totalPages-1?'disabled':'') + ' onclick="changePage(' + (currentPage+1) + ')">Next →</button>' : '';
    
    document.getElementById('content').innerHTML = 
        '<div class="file-info"><h3>' + data.fileName + '</h3><div class="stats">' +
        '<span class="stat-item">📦 ' + data.fileSize + '</span>' +
        '<span class="stat-item">📋 ' + data.totalRows.toLocaleString() + ' rows</span>' +
        '<span class="stat-item">📊 ' + data.columns.length + ' columns</span></div></div>' +
        '<div class="column-toggles">' + colToggles + '</div>' +
        '<div class="table-container"><table><thead><tr>' + tableHeader + '</tr></thead><tbody>' + tableBody + '</tbody></table></div>' +
        '<div class="pagination">' + pagination + '</div>' +
        '<div class="row-count">Showing ' + data.rows.length + ' of ' + data.filteredCount.toLocaleString() + 
        (data.filteredCount < data.totalRows ? ' rows (filtered from ' + data.totalRows.toLocaleString() + ')' : ' rows') + '</div>';
    
    document.querySelectorAll('.column-toggle').forEach(t => {
        t.addEventListener('click', () => vscode.postMessage({command: 'toggleColumn', index: parseInt(t.dataset.idx)}));
    });
    
    document.querySelectorAll('th[data-idx]').forEach(th => {
        th.addEventListener('dblclick', () => vscode.postMessage({command: 'showStats', index: parseInt(th.dataset.idx)}));
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
