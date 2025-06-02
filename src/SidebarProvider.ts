import * as vscode from 'vscode';

export class SidebarProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

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

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.command) {
                case 'startSession':
                    await vscode.commands.executeCommand('codetrack.startSession');
                    break;
                case 'endSession':
                    await vscode.commands.executeCommand('codetrack.endSession');
                    break;
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return /*html*/ `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>CodeTrack</title>
                <style>
                    body { 
                        padding: 10px; 
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-sidebar-background);
                    }
                    button {
                        width: 100%;
                        padding: 8px;
                        margin: 5px 0;
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        border-radius: 2px;
                        cursor: pointer;
                    }
                    button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                </style>
            </head>
            <body>
                <h2>CodeTrack</h2>
                <button id="startSessionBtn">Start Session</button>
                <button id="endSessionBtn">End Session</button>

                <script>
                    const vscode = acquireVsCodeApi();
                    
                    document.getElementById('startSessionBtn').addEventListener('click', () => {
                        vscode.postMessage({ command: 'startSession' });
                    });
                    
                    document.getElementById('endSessionBtn').addEventListener('click', () => {
                        vscode.postMessage({ command: 'endSession' });
                    });
                </script>
            </body>
            </html>
        `;
    }
}

export function activate(context: vscode.ExtensionContext) {
    const sidebarProvider = new SidebarProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            "codetrack-view",
            sidebarProvider
        )
    );
}