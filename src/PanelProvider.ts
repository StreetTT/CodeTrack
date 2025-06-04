import * as vscode from 'vscode';
import { GetHtmlForWebview, log, logError } from './utils';

function p_log(message: string) {
    log(`[Panel] ${message}`);
}

function p_logError(message: string) {
    logError(`[Panel] ${message}`);
}
export class PanelProvider {
    public static currentPanel: PanelProvider | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _properties: { [key: string]: string } = {};
    private _webviewReady: boolean = false;
    private _pendingMessages: Array<any> = [];
    private _selectedProjectProperty: string | null = null;
    private _selectedTimeProperty: string | null = null;

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        selectedProjectProperty: string | null = null,
        selectedTimeProperty: string | null = null
    ) {
        this._panel = panel;
        this._selectedProjectProperty = selectedProjectProperty;
        this._selectedTimeProperty = selectedTimeProperty;
        this._panel.webview.html = GetHtmlForWebview(this._panel.webview, extensionUri, 'panel.html');

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(async (data) => {
            switch (data.command) {
                case 'webviewReady':
                    p_log('Webview is ready');
                    this._webviewReady = true;
                    // Send any pending messages
                    if (this._pendingMessages.length > 0) {
                        p_log(`Sending ${this._pendingMessages.length} pending messages`);
                        this._pendingMessages.forEach(msg => {
                            this._panel.webview.postMessage(msg);
                        });
                        this._pendingMessages = [];
                    }
                    break;
                case 'log':
                    p_log(data.text);
                    break;
                case 'logError':
                    p_logError(data.text);
                    break;
                case 'saveSettings':
                    await vscode.commands.executeCommand('codetrack.saveSettings', data.projectProperty, data.timeProperty);
                    break;
            }
        });
    }

    public static render(extensionUri: vscode.Uri, selectedProjectProperty: string | null = null, selectedTimeProperty: string | null = null) {
        if (PanelProvider.currentPanel) {
            PanelProvider.currentPanel._panel.reveal(vscode.ViewColumn.One);
            // Update selected values if panel already exists
            PanelProvider.currentPanel._selectedProjectProperty = selectedProjectProperty;
            PanelProvider.currentPanel._selectedTimeProperty = selectedTimeProperty;
        } else {
            const panel = vscode.window.createWebviewPanel(
                'codetrackPanel',
                'CodeTrack Panel',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    localResourceRoots: [extensionUri]
                }
            );

            PanelProvider.currentPanel = new PanelProvider(panel, extensionUri, selectedProjectProperty, selectedTimeProperty);
        }
    }

    public static UpdatePropertySettings(properties: { [key: string]: string }) {
        if (!PanelProvider.currentPanel) {
            p_logError('Cannot update property settings: No panel instance exists');
            return;
        }

        try {
            p_log('Sending property settings: ' + JSON.stringify(properties));
            PanelProvider.currentPanel._properties = properties;
            
            const message = { 
                command: 'updatePropertySettings', 
                properties: properties,
                selectedProjectProperty: PanelProvider.currentPanel._selectedProjectProperty,
                selectedTimeProperty: PanelProvider.currentPanel._selectedTimeProperty
            };
            
            if (PanelProvider.currentPanel._webviewReady) {
                PanelProvider.currentPanel._panel.webview.postMessage(message);
            } else {
                p_log('Webview not ready, queueing message');
                PanelProvider.currentPanel._pendingMessages.push(message);
            }
        } catch (error) {
            p_logError('Failed to send property settings: ' + error);
        }
    }

    public dispose() {
        PanelProvider.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}