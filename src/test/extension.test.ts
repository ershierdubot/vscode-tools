import * as assert from 'assert';
import * as vscode from 'vscode';

suite('VSCode Tools Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        const extension = vscode.extensions.getExtension('ershierdu.vscode-tools');
        assert.ok(extension, 'Extension should be installed');
    });

    test('Should activate extension', async () => {
        const extension = vscode.extensions.getExtension('ershierdu.vscode-tools');
        if (extension) {
            await extension.activate();
            assert.strictEqual(extension.isActive, true, 'Extension should be active');
        }
    });

    test('Should register commands', async () => {
        const commands = await vscode.commands.getCommands(true);
        
        const expectedCommands = [
            'vscodeTools.refreshTools',
            'vscodeTools.openParquetViewer',
            'vscodeTools.openJsonFormatter',
            'vscodeTools.openTool'
        ];
        
        for (const cmd of expectedCommands) {
            assert.ok(commands.includes(cmd), `Command ${cmd} should be registered`);
        }
    });
});
