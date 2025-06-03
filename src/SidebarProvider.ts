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
                    await vscode.commands.executeCommand('codetrack.startSession', data.title);
                    break;
                case 'endSession':
                    await vscode.commands.executeCommand('codetrack.endSession', data.title);
                    break;
            }
        });
    }

    public updatePlaceholder(title: string) {
        if (this._view) {
            this._view.webview.postMessage({ 
                command: 'updatePlaceholder', 
                title: title 
            });
        }
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
                    button, input[type="text"] {
                        width: 100%;
                        padding: 8px;
                        margin: 5px 0;
                        border-radius: 2px;
                        box-sizing: border-box; /* This is the key change */
                    }
                    button {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        cursor: pointer;
                    }
                    button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                    input[type="text"] {
                        border: 1px solid var(--vscode-input-border);
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                    }
                </style>
            </head>
            <body>
                <h2>CodeTrack</h2>
                <p>Track your coding sessions with Notion.</p>
                <br>
                <label for="title">Session Title:</label>
                <input type="text" id="title" placeholder="Coding Session">
                <button id="startSessionBtn">Start Session</button>
                <button id="endSessionBtn">End Session</button>

                <script>
                    const vscode = acquireVsCodeApi();
                    let title;


                    document.getElementById('startSessionBtn').addEventListener('click', () => {
                        title = document.getElementById('title').value;
                        if (!title) {
                            title = "Coding Session - " + new Date().toLocaleString();
                        }
                        vscode.postMessage({ command: 'startSession', title: title });
                        document.getElementById('title').placeholder = title;
                    });

                    document.getElementById('endSessionBtn').addEventListener('click', () => {
                        title = document.getElementById('title').value;
                        vscode.postMessage({ command: 'endSession', title: title });
                        document.getElementById('title').value = '';
                        document.getElementById('title').placeholder = '';

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