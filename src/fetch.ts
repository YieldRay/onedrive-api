import fetch from "cross-fetch";

// only undefined will be ignored
function composeURL(baseURL: string, ...parts: Array<string>): string {
    return parts.reduce((acc, part) => {
        if (part === undefined) return acc;
        if (part.startsWith("/")) return acc + part;
        return acc + "/" + part;
    }, baseURL);
}

const CONFIG = {
    graphURL: "https://graph.microsoft.com/v1.0",
    accessToken: "",
    maxDuration: 0, // <= 0 for unlimited
    drive: "/me/drive",
};

//! fetch wrapper

async function fetchData(url: string | Array<string>, options?: RequestInit): Promise<Response> {
    const ac = new AbortController();
    const signal = CONFIG.maxDuration ? ac.signal : undefined;
    CONFIG.maxDuration &&
        setTimeout(() => ac.abort(`fetch is aborted due to ${CONFIG.maxDuration}ms has passed`), CONFIG.maxDuration);
    const apiEndpoint = composeURL(CONFIG.graphURL, CONFIG.drive, ...(Array.isArray(url) ? url : [url]));
    console.debug(`fetching ${apiEndpoint}`); //! DEBUG
    const resp = await fetch(
        // ? keep in mind that every compose element except the first one should start with / but not end with /
        apiEndpoint,
        Object.assign(options || {}, {
            headers: {
                Authorization: `Bearer ${CONFIG.accessToken}`,
            },
            signal,
        })
    );
    if (resp.ok) return resp;
    else throw new Error(`${resp.status} (${resp.statusText})  API-ENDPOINT:${apiEndpoint}`); //! Main Error
}

async function fetchURL(url: string | Array<string>, options?: RequestInit): Promise<string> {
    return fetchData(url, options).then((resp) => resp.url);
}

async function fetchJSON(url: string | Array<string>, options?: RequestInit): Promise<any> {
    if (!options) options = {};
    Object.assign(options, { headers: { accept: "application/json" } });
    return fetchData(url, options).then((resp) => resp.json());
}

async function fetchOK(url: string | Array<string>, options?: RequestInit): Promise<boolean> {
    try {
        await fetchData(url, options);
        return true;
    } catch (e) {
        return false;
    }
}

export { fetchData, fetchURL, fetchJSON, fetchOK, CONFIG };
