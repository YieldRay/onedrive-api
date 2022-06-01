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

const FETCH_DETAIL: {
    status: number;
    endpoint: string;
    error?: {
        code: string;
        message: string;
        innererror: {
            code: string;
        };
    };
} = {
    status: 0,
    endpoint: "",
};

//! fetch wrapper

async function fetchData(url: string | Array<string>, options?: RequestInit): Promise<Response> {
    const ac = new AbortController();
    const signal = CONFIG.maxDuration ? ac.signal : undefined;
    if (CONFIG.maxDuration > 0) setTimeout(() => ac.abort(`fetch is aborted due to ${CONFIG.maxDuration}ms has passed`), CONFIG.maxDuration);

    // ? keep in mind that every compose element except the first one should start with / but not end with /
    const apiEndpoint = composeURL(CONFIG.graphURL, CONFIG.drive, ...(Array.isArray(url) ? url : [url]));

    const resp = await fetch(
        apiEndpoint,
        Object.assign(options || {}, {
            headers: {
                ...(options && options.headers ? options.headers : {}),
                Authorization: `Bearer ${CONFIG.accessToken}`,
            },
            signal,
        })
    );

    // store fetch details
    FETCH_DETAIL.status = resp.status;
    FETCH_DETAIL.endpoint = apiEndpoint;

    if (resp.ok) return resp;
    else {
        try {
            FETCH_DETAIL.error = await resp.json();
        } catch (e) {}
        throw new Error(`${resp.status} (${resp.statusText})\n` + `API-ENDPOINT: ${apiEndpoint}\n` + `Check the fetchDetail property in api instantiate for more detailed info`);
        // ! FETCH_DETAIL should attached to the instantiate of the api
    }
}

async function fetchURL(url: string | Array<string>, options?: RequestInit): Promise<string> {
    return fetchData(url, {
        ...options,
        headers: {
            ...(options && options.headers ? options.headers : {}),
            "Content-Type": "application/json",
        },
    }).then((resp) => {
        const { headers } = resp;
        return headers.get("Location") || resp.url;
    });
}

async function fetchJSON(url: string | Array<string>, options?: RequestInit): Promise<any> {
    return fetchData(url, {
        ...options,
        headers: {
            ...(options && options.headers ? options.headers : {}),
            accept: "application/json",
            "Content-Type": "application/json",
        },
    }).then((resp) => resp.json());
}

async function fetchOK(url: string | Array<string>, options?: RequestInit): Promise<boolean> {
    try {
        await fetchData(url, options);
        return true;
    } catch (e) {
        return false;
    }
}

export { fetchData, fetchURL, fetchJSON, fetchOK };
export { CONFIG, FETCH_DETAIL };
