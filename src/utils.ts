// import fetch, { Response } from 'node-fetch';

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
        
        console.log(`[CodeTrack] ${res.status} | ${method} | ${url.replace('https://', '').split('/')[0]} | ${message}`);

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
            console.error(`URL: ${url}`);
            console.error(`Response Message: ${error.message}`);
        }
        return false;
    }
}

export { MakeRequest, NotionUrlToId };