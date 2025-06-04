// import fetch, { Response } from 'node-fetch';
import * as vscode from 'vscode';
import * as fs from 'fs';

enum LogLevel {
    Log = 'LOG',
    Warning = 'WARN',
    Error = 'ERROR'
}

let outputChannel: vscode.OutputChannel;

function initializeLogging() {
    outputChannel = vscode.window.createOutputChannel('CodeTrack');
}

export function log(message: string, level: LogLevel = LogLevel.Log) {
    if (!outputChannel) {
        initializeLogging();
    }

    const timestamp = new Date().toISOString();
    let prefix = '';

    switch (level) {
        case LogLevel.Error:
            prefix = '🔴 ERROR';
            console.error(`[${timestamp}] [CodeTrack] | ${message}`);
            break;
        case LogLevel.Warning:
            prefix = '🟡 WARN';
            console.warn(`[${timestamp}] [CodeTrack] | ${message}`);
            break;
        case LogLevel.Log:
            prefix = '🔵 Log';
            console.log(`[${timestamp}] [CodeTrack] | ${message}`);
            break;
    }

    outputChannel.appendLine(`[${timestamp}] ${prefix} | ${message}`);

    // Also show error notifications for errors
    if (level === LogLevel.Error) {
        vscode.window.showErrorMessage(`CodeTrack: ${message}`);
    }
}

// Helper functions for different log levels
export const logError = (message: string) => log(message, LogLevel.Error);
export const logWarning = (message: string) => log(message, LogLevel.Warning);

function u_log(message: string) {
    log(`[Utils] ${message}`);
}

function u_logError(message: string) {
    logError(`[Utils] ${message}`);
}

function NotionUrlToId(url: string): string {
    // Turns the URL of a Notion page into its ID
    const parts = url.split("/");
    
    if (parts.length >= 2) {
        return parts[parts.length - 1].split("-").pop()?.split("?")[0] || "";
    } else {
        throw new Error("Invalid Notion URL provided");
    }
}

interface RequestOptions {
    method: string;
    url: string;
    message: string;
    data?: Record<string, any> | null;
    headers?: Record<string, string>;
    raw?: boolean;
    returnError?: boolean;
}

/**
 * Sends an HTTP request using the specified method, URL, and optional data and headers.
 * @param options.method The HTTP method to use (e.g., 'GET', 'POST', etc.)
 * @param options.url The URL to send the request to
 * @param options.message A message to include in the log output
 * @param options.data The data to send in the request body
 * @param options.headers Additional headers to include in the request
 * @param options.raw If true, returns the raw response object
 * @param options.returnError If true, returns the Error on failure
 * @returns Promise resolving to JSON data, Response object, Error, or false
 */
async function MakeRequest({
    method,
    url,
    message,
    data = null,
    headers = {},
    raw = false,
    returnError = false
}: RequestOptions): Promise<unknown | Response | Error | false> {
    try {
        const { default: fetch } = await import('node-fetch');
        const fetchOptions: {
            method: string;
            headers: Record<string, string>;
            body?: string;
        } = {
            method,
            headers
        };

        if (data !== null) {
            if (headers['Content-Type']?.includes('application/json')) {
                fetchOptions.body = JSON.stringify(data);
            } else if (typeof data === 'string') {
                fetchOptions.body = data;
            } else {
                fetchOptions.body = JSON.stringify(data);
            }
        }

        const res = await fetch(url, fetchOptions);

        u_log(`${res.status} | ${method} | ${url.replace('https://', '').split('/')[0]} | ${message}`);

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        if (raw) {
            return res;
        }

        return await res.json();

    } catch (error) {
        if (returnError) {
            return error as Error;
        }
        
        if (error instanceof Error) {
            u_logError(`URL: ${url}`);
            u_logError(`Response Message: ${error.message}`);
        }
        return false;
    }
}

function GetHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri, htmlFile: string) {
    // Read the HTML file
    const htmlPath = vscode.Uri.joinPath(extensionUri, 'resources', htmlFile);
    let html = fs.readFileSync(htmlPath.fsPath, 'utf8');
    
    // Generate a nonce
    const nonce = getNonce();
    
    // Get the style and script URIs
    const styleUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'resources', 'styles.css')
    ).toString();
    
    const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'resources', 'script.js')
    ).toString();

    // // Add this debugging log to see what's being replaced
    // u_log(`Style path: ${stylePath.toString()}`);
    // u_log(`Script path: ${scriptPath.toString()}`);
    // u_log(`Nonce: ${getNonce()}`);
    
    // Replace all placeholders
    html = html.replace(/\$\{nonce\}/g, nonce);
    html = html.replace(/\$\{webview\.cspSource\}/g, webview.cspSource);
    html = html.replace(/\$\{styleUri\}/g, styleUri);
    html = html.replace(/\$\{scriptUri\}/g, scriptUri);
    
    return html;
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * Integrates pagination to collect all objects from Notion API
 * @param url The Notion API endpoint URL
 * @param message A message for logging
 * @param blockQuery Whether to use GET method (true) or POST method (false)
 * @param query Optional query object for the request
 * @returns Promise resolving to an array of results
 */
async function QueryNotion(url: string, message: string, blockQuery: boolean = false, query: Record<string, any> = {}, headers: Record<string, string> = {}): Promise<any[]> {
    let results: any[] = [];
    let more: boolean = true;
    const method: string = blockQuery ? "GET" : "POST";
    
    while (more) {
        const data = await MakeRequest({
            method,
            url,
            message,
            data: method === "POST" ? query : null,
            headers: headers
        }) as { results: any[]; has_more: boolean; next_cursor: string | null };
        
        if (!data || typeof data !== 'object') {
            u_logError(`Failed to query Notion: ${url}`);
            return [];
        }

        results = results.concat(data.results || []);
        more = data.has_more || false;
        
        if (more) {
            query.start_cursor = data.next_cursor;
        }
    }
    
    return results;
}

export { MakeRequest, NotionUrlToId, GetHtmlForWebview, QueryNotion };