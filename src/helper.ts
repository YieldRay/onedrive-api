// helper for dealing with item locate
const pathWrapper = (path: string) => {
    if (path === "" || path === "/") return "/root/";
    return `/root:/${path}:`;
};
const idWrapper = (id: string) => `/items/${id}`;

type ItemLocator = string | { path: string } | { id: string };
const locatorWrap = (locator: ItemLocator): string => {
    if (typeof locator === "string") return locator;
    if ("path" in locator) return pathWrapper(locator.path);
    if ("id" in locator) return idWrapper(locator.id);
    throw new Error("Invalid item locator, must be string or {path} or {id}");
};

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

export { simpleOData, ODataAppendix };
export { pathWrapper, idWrapper, locatorWrap, ItemLocator };
