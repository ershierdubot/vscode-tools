import * as vscode from 'vscode';
import { ToolsProvider } from './providers/toolsProvider';
import { ParquetViewerPanel } from './panels/parquetViewerPanel';
import { JsonFormatterPanel } from './panels/jsonFormatterPanel';

export function activate(context: vscode.ExtensionContext) {
    console.log('VSCode Tools extension is now active');

    const toolsProvider = new ToolsProvider();
    vscode.window.registerTreeDataProvider('vscodeToolsSidebar', toolsProvider);

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
        vscode.commands.registerCommand('vscodeTools.openJsonFormatter', () => {
            JsonFormatterPanel.createOrShow(context.extensionUri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscodeTools.openTool', (toolId: string) => {
            switch (toolId) {
                case 'parquet-viewer':
                    ParquetViewerPanel.createOrShow(context.extensionUri);
                    break;
                case 'json-formatter':
                    JsonFormatterPanel.createOrShow(context.extensionUri);
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
