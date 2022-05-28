// helper for dealing with item locate
const pathWrapper = (path: string) => {
    if (path === "") return "/root/";
    return `/root:/${path}:`;
};
const idWrapper = (id: string) => `/items/${id}`;

// only undefined will be ignored
function composeURL(baseURL: string, ...parts: Array<string>): string {
    return parts.reduce((acc, part) => {
        if (part === undefined) return acc;
        if (part.startsWith("/")) return acc + part;
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
// this can also for none OData, allowing additional path elements
function simpleOData(appendix: ODataAppendix): string {
    if (!appendix) return "";
    if (typeof appendix === "string") return appendix;
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(appendix)) q.append(key, value.toString());
    return "?" + q.toString();
}

export { simpleOData, ODataAppendix, composeURL, pathWrapper, idWrapper };
