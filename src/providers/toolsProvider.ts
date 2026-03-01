import * as vscode from 'vscode';

export interface Tool {
    id: string;
    label: string;
    description: string;
    icon?: string;
}

export class ToolItem extends vscode.TreeItem {
    constructor(
        public readonly tool: Tool
    ) {
        super(tool.label, vscode.TreeItemCollapsibleState.None);
        this.tooltip = tool.description;
        this.description = tool.description;
        this.iconPath = new vscode.ThemeIcon(tool.icon || 'tools');
        this.command = {
            command: 'vscodeTools.openTool',
            title: 'Open Tool',
            arguments: [tool.id]
        };
    }
}

export class ToolsProvider implements vscode.TreeDataProvider<ToolItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ToolItem | undefined | null | void> = new vscode.EventEmitter<ToolItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ToolItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private tools: Tool[] = [
        {
            id: 'parquet-viewer',
            label: 'Parquet Viewer',
            description: 'View and analyze Parquet files',
            icon: 'file-binary'
        },
        {
            id: 'json-formatter',
            label: 'JSON Formatter',
            description: 'Format and validate JSON',
            icon: 'bracket'
        },
        {
            id: 'base64-converter',
            label: 'Base64 Converter',
            description: 'Encode/Decode Base64',
            icon: 'symbol-string'
        },
        {
            id: 'timestamp-converter',
            label: 'Timestamp Converter',
            description: 'Convert Unix timestamps',
            icon: 'clock'
        }
    ];

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ToolItem): vscode.TreeItem {
        return element;
    }

    getChildren(): Thenable<ToolItem[]> {
        return Promise.resolve(
            this.tools.map(tool => new ToolItem(tool))
        );
    }
}
