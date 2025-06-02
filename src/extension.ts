// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { SidebarProvider } from './SidebarProvider';

let sessionInProgress = false;

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {

	const config = vscode.workspace.getConfiguration('codetrack');
    const notionSecret = config.get('notionSecret', '');
    const trackingDatabaseURL = config.get('trackingDatabaseURL', '');
	const autoStartOnVSCode = config.get('autoStartOnVSCode', false);

	// // Check if the Notion secret and tracking database are set
	// if (!notionSecret || !trackingDatabaseURL) {
	// 	vscode.window.showErrorMessage('Please set your Notion secret and tracking database in the settings.');
	// 	return;
	// }

	// Auto-start if enabled
    if (autoStartOnVSCode) {
        vscode.commands.executeCommand('codetrack.startSession');
    }

	// Watch for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('codetrack')) {
                // Reload configuration
                const config = vscode.workspace.getConfiguration('codetrack');
				const notionSecret = config.get('notionSecret', '');
				const trackingDatabaseURL = config.get('trackingDatabaseURL', '');
				const autoStartOnVSCode = config.get('autoStartOnVSCode', false);
            }
        })
    );

	let startSession = vscode.commands.registerCommand('codetrack.startSession', () => {
		if (sessionInProgress) {
			vscode.window.showWarningMessage('A coding session is already in progress.');
			return;
		}
		
		sessionInProgress = true;
		vscode.window.showInformationMessage('Started tracking your coding session');
	});

	let endSession = vscode.commands.registerCommand('codetrack.endSession', () => {
		if (!sessionInProgress) {
			vscode.window.showWarningMessage('No coding session is currently in progress.');
			return;
		}

		sessionInProgress = false;
		vscode.window.showInformationMessage('Ended tracking your coding session');
	});

	context.subscriptions.push(startSession);
	context.subscriptions.push(endSession);

	const sidebarProvider = new SidebarProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			"codetrack-view",
			sidebarProvider
		)
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
