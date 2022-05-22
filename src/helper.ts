type anyObject = { [index: string | number | symbol]: any };

function determineDrive(
    type?: "drive" | "drives" | "groups" | "sites" | "users" | "approot",
    id?: string
): string {
    if (!type) return "/me/drive";
    if (type === "drive") return "/drive";
    if (type === "approot") return "/drive/special/approot";
    if (!id) throw new Error(`id is required as parameter for ${type}`);
    if (type === "drives") return `/drives/${id}`;
    return `/${type}/${id}/drives`;
}

function pathWrapper(path: string): string {
    return `/:root/${path}:`;
}

function idWrapper(id: string): string {
    return `/items/${id}`;
}

// only undefined will be ignored
function composeURL(baseURL: string, ...parts: Array<string>): string {
    return parts.reduce((acc, part) => {
        if (part === undefined) return acc;
        if (part.startsWith("/")) {
            return acc + part;
        }
        return acc + "/" + part;
    }, baseURL);
}

type ODataAppendix =
    | string
    | {
          [query: string]: string | string[];
      }
    | undefined;

// use this to construct query string, like OData {select, expand, filter, orderby, top, skip, count, ...}
// this can also for not OData, allowing additional path elements
function simpleOData(appendix: ODataAppendix): string {
    if (!appendix) return "";
    if (typeof appendix === "string") return appendix;
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(appendix)) q.append(key, value.toString());
    return "?" + q.toString();
}

function constructQuery(obj: anyObject): string {
    const q = new URLSearchParams();
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            if (Array.isArray(value)) {
                value.forEach((val) => q.append(key, val));
            } else {
                q.append(key, value);
            }
        }
    }
    return q.toString();
}

export { simpleOData, ODataAppendix, constructQuery, composeURL, determineDrive, pathWrapper, idWrapper };
