import * as vscode from 'vscode';
import { ToolsProvider } from './providers/toolsProvider';
import { ParquetViewerPanel } from './panels/parquetViewerPanel';

export function activate(context: vscode.ExtensionContext) {
    console.log('VSCode Tools extension is now active');

    // Register the sidebar tree data provider
    const toolsProvider = new ToolsProvider();
    vscode.window.registerTreeDataProvider('vscodeToolsSidebar', toolsProvider);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('vscodeTools.refreshTools', () => {
            toolsProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscodeTools.openParquetViewer', () => {
            ParquetViewerPanel.createOrShow(context.extensionUri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscodeTools.openTool', (toolId: string) => {
            switch (toolId) {
                case 'parquet-viewer':
                    ParquetViewerPanel.createOrShow(context.extensionUri);
                    break;
                default:
                    vscode.window.showInformationMessage(`Tool ${toolId} is not implemented yet`);
            }
        })
    );
}

export function deactivate() {
    console.log('VSCode Tools extension is now deactivated');
}
