import * as vscode from 'vscode';
import { GetHtmlForWebview, log, logError } from './utils';
function sb_log(message: string) {
    log(`[Sidebar] ${message}`);
}

function sb_logError(message: string) {
    logError(`[Sidebar] ${message}`);
}

export class SidebarProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _properties: { [key: string]: string } = {};
    private _webviewReady: boolean = false;
    private _pendingMessages: Array<any> = [];

    constructor(private readonly _extensionUri: vscode.Uri) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        try {
            webviewView.webview.html = GetHtmlForWebview(webviewView.webview, this._extensionUri, 'sidebar.html');
        } catch (error) {
            sb_logError('Error setting webview HTML: ' + error);
        }

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.command) {
                case 'webviewReady':
                    sb_log('Webview is ready');
                    this._webviewReady = true;
                    // Send any pending messages
                    if (this._pendingMessages.length > 0) {
                        sb_log(`Sending ${this._pendingMessages.length} pending messages`);
                        this._pendingMessages.forEach(msg => {
                            if (!this._view) {
                                sb_logError('Webview view is not available to send messages'); 
                                return;
                            }
                            // Ensure the webview is ready before sending messages
                            this._view.webview.postMessage(msg);
                        });
                        this._pendingMessages = [];
                    }
                    break;
                case 'log':
                    sb_log(data.text);
                    break;
                case 'logError':
                    sb_logError(data.text);
                    break;
                case 'startSession':
                    await vscode.commands.executeCommand('codetrack.startSession', data.title, data.project);
                    break;
                case 'endSession':
                    await vscode.commands.executeCommand('codetrack.endSession', data.title);
                    break;
            }
        });
    }

    public UpdateProjects(projects: { [key: string]: string }) {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'updateProjects',
                projects: projects,
                workspaceName: vscode.workspace.name || null
            });
        }
    }

    public UpdatePlaceholder(title: string) {
        if (this._view) {
            this._view.webview.postMessage({ 
                command: 'updatePlaceholder', 
                title: title 
            });
        }
    }
}