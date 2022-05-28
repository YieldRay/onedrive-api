import fetch from "cross-fetch";
import { simpleOData, ODataAppendix, composeURL, pathWrapper, idWrapper } from "./helper.js";

// view https://docs.microsoft.com/zh-cn/onedrive/developer/rest-api/ for details

type ItemLocator = string | { path: string } | { id: string };
const locatorWrap = (locator: ItemLocator): string => {
    if (typeof locator === "string") return locator;
    if ("path" in locator) return pathWrapper(locator.path);
    if ("id" in locator) return idWrapper(locator.id);
    throw new Error("Invalid item locator");
};
class OnedriveAPI {
    #accessToken: string;
    #graphURL = "https://graph.microsoft.com/v1.0";
    #drive = "/me/drive";
    #maxDuration: number = 0; // 10s

    /**
     * fetch and if response is not ok, throw error
     */
    async #fetch(url: string | Array<string>, options?: RequestInit): Promise<Response> {
        const ac = new AbortController();
        const signal = this.#maxDuration ? ac.signal : undefined;
        this.#maxDuration &&
            setTimeout(() => ac.abort(`fetch is aborted due to ${this.#maxDuration}ms has passed`), this.#maxDuration);
        const apiEndpoint = composeURL(this.#graphURL, this.#drive, ...(Array.isArray(url) ? url : [url]));
        console.debug(`fetching ${apiEndpoint}`); // ! DEBUG
        const resp = await fetch(
            // ? keep in mind that every compose element except the first one should start with / but not end with /
            apiEndpoint,
            Object.assign(options, {
                headers: {
                    Authorization: `Bearer ${this.#accessToken}`,
                },
                signal,
            })
        );
        if (resp.ok) return resp;
        else throw new Error(`(${resp.status} ${resp.statusText})  API-ENDPOINT: ${apiEndpoint}`);
    }

    async #fetchJSON(url: string | Array<string>, options?: RequestInit): Promise<any> {
        if (!options) options = {};
        Object.assign(options, { headers: { accept: "application/json" } });
        return this.#fetch(url, options).then((resp) => resp.json());
    }

    async #fetchOK(url: string | Array<string>, options?: RequestInit): Promise<boolean> {
        try {
            await this.#fetch(url, options);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * a fetch that have accessToken attached in headers
     */
    async fetchAPI(input: RequestInfo, info?: RequestInit) {
        if (!info) info = {};
        return fetch(
            input,
            Object.assign(info, {
                headers: {
                    Authorization: `Bearer ${this.#accessToken}`,
                },
            })
        ).then((response) => response.json());
    }

    /**
     * initialize the API with accessToken
     * @param accessToken
     */
    constructor(accessToken: string) {
        this.#accessToken = accessToken;
    }

    /**
     * set drive if you want to change current drive, default might be user's onedrive
     * @param type
     * @param id
     */
    setDrive(type: "me" | "drives" | "groups" | "sites" | "users" | "approot", id?: string) {
        if (!type || !["me", "drives", "groups", "sites", "users", "approot"].includes(type))
            throw new Error("type must be one of me, drive, drives, groups, sites, users, approot");

        switch (type) {
            case "me":
                this.#drive = "/me/drive";
                break;
            case "approot":
                this.#drive = "/drive/special/approot";
                break;
            default:
                if (!id) throw new Error(`id is required as parameter for ${type}`);
                if (type === "drives") this.#drive = `/drives/${id}`;
                else this.#drive = `/${type}/${id}/drives`;
        }
    }

    /**
     * set the max duration of fetch, default is unlimited
     * @param maxDuration (unit is milliseconds) if pass 0 or negative number, no timeout will be set
     */
    setMaxDuration(maxDuration: number) {
        this.#maxDuration = maxDuration;
    }

    /**
     * @param accessToken set accessToken if you want to use another token
     */
    setAccessToken(accessToken: string) {
        this.#accessToken = accessToken;
    }

    /**
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_checkin
     */
    async checkin(itemLocator: ItemLocator, comment: string): Promise<boolean> {
        return this.#fetchOK([locatorWrap(itemLocator), "/checkin"], {
            method: "POST",
            body: JSON.stringify({ comment }),
        });
    }

    /**
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_checkout
     */
    async checkout(itemLocator: ItemLocator): Promise<boolean> {
        return this.#fetchOK([locatorWrap(itemLocator), "/checkout"]);
    }

    /**
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_copy
     */
    async copy(
        itemLocator: ItemLocator,
        parentReference?: { driveId: string; id: string },
        name?: string
    ): Promise<any> {
        return this.#fetchJSON([locatorWrap(itemLocator), "/copy"], {
            method: "POST",
            body: JSON.stringify({
                parentReference,
                name,
            }),
        });
    }

    /**
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_post_children
     */
    async mkdir(parentItemId = "root", name: string): Promise<any> {
        return this.#fetchJSON(["/" + parentItemId, "/children"], {
            method: "POST",
            body: JSON.stringify({
                name,
                folder: {},
                "@microsoft.graph.conflictBehavior": "rename", // this is for mkdir
            }),
        });
    }

    /**
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_delete
     */
    async delete(itemLocator: ItemLocator): Promise<boolean> {
        return this.#fetchOK(locatorWrap(itemLocator), {
            method: "DELETE",
        });
    }

    /**
     * get the final download url, which do not need authentication to fetch
     * @param range the range of the file to download, default is the whole file
     * @example download({path:"/path/to/file"}, undefined, {format: "jpg"})
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_get_content_format
     */
    async download(
        itemLocator: ItemLocator,
        range?: [start: number, end: number],
        appendix?: ODataAppendix
    ): Promise<string> {
        return this.#fetch([locatorWrap(itemLocator), "/content" + simpleOData(appendix)], {
            method: "GET",
            headers: range
                ? {
                      Range: `bytes=${range?.join("-")}`,
                  }
                : {},
        }).then((res) => res.url);
    }

    /**
     * Retrieve the metadata for a DriveItem in a Drive by file system path or ID.
     * @param itemLocator bare string only if you know the API, otherwise use {path: "/path/to/file"} or {id: "id"}
     * @param appendix pass OData query string, a string that starts with ?
     * @param appendix pass an object and it will transform to correct OData query string
     * @example
     * item({path:"/path/to/file"}, {select:["name","size"]})
     * item({path:"/path/to/file"}, "?select=name,size")
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_get
     */
    async item(itemLocator: ItemLocator, appendix?: ODataAppendix) {
        return this.#fetchJSON([locatorWrap(itemLocator), "/" + simpleOData(appendix)]);
    }

    /**
     * ask the server whether the item is available
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_get
     */
    async exist(itemLocator: ItemLocator): Promise<boolean> {
        // TODO: this is buggy and always return false
        return this.#fetchOK([locatorWrap(itemLocator), "/"], {
            method: "HEAD",
        });
    }

    /**
     * Return a collection of DriveItems in the children relationship of a DriveItem.
     * DriveItems with a non-null folder or package facet can have one or more child DriveItems.
     * @param itemLocator bare string only if you know the API, otherwise use {path: "/path/to/file"} or {id: "id"}
     * @param appendix ODataAppendix, like {select: "id,name,size,@microsoft.graph.downloadUrl"}
     * @example children("") // for root
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_list_children
     */
    async children(itemLocator: ItemLocator, appendix?: ODataAppendix): Promise<any> {
        return this.#fetchJSON([locatorWrap(itemLocator), "/children" + simpleOData(appendix)]);
    }

    /**
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_move
     */
    async move(itemLocator: ItemLocator, newParentFolderID: number, newItemName?: string): Promise<any> {
        return this.#fetchJSON([locatorWrap(itemLocator)], {
            method: "PATCH",
            body: JSON.stringify({
                parentReference: {
                    id: newParentFolderID,
                },
                name: newItemName,
            }),
        });
    }

    /**
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_preview
     */
    async preview(
        itemLocator: ItemLocator,
        options: {
            viewer?: null | "onedrive" | "office";
            chromeless?: boolean;
            allowEdit?: boolean;
            page?: number | string;
            zoom?: number;
        }
    ): Promise<{ getUrl: string; postParameters: string; postUrl: string }> {
        return this.#fetchJSON([locatorWrap(itemLocator), "/preview"], {
            method: "POST",
            body: JSON.stringify(options),
        });
    }

    /**
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_search
     */
    async search(itemLocator: ItemLocator, searchText: string): Promise<any> {
        return this.#fetchJSON([locatorWrap(itemLocator), `/search(q='${searchText}`]);
    }

    /**
     * This method allows your app to track changes to a drive and its children over time.
     * @example
     *  delta({path:""}, {token:"latest"})
     *  od.fetchAPI((await od.delta(...))["@odata.nextLink"]) // for next page
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_delta
     */
    async delta(
        itemLocator: ItemLocator,
        appendix?: ODataAppendix
    ): Promise<{ value: any[]; "@odata.nextLink"?: string }> {
        return this.#fetchJSON([locatorWrap(itemLocator), "/delta" + simpleOData(appendix)]);
    }

    /**
     * recommend to use children({path:""}, {expand:"thumbnails"}) if possible
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_list_thumbnails
     */
    async thumbnails(itemLocator: ItemLocator, thumbId?: string, size?: string, appendix?: ODataAppendix) {
        if (thumbId && size) {
            return this.#fetchJSON([
                locatorWrap(itemLocator),
                "/thumbnails/" + thumbId,
                "/" + size,
                appendix ? `?${simpleOData(appendix)}` : "",
            ]);
        }
        return this.#fetchJSON([locatorWrap(itemLocator), "/thumbnails" + simpleOData(appendix)]);
    }

    /**
     * rename a DriveItem resource
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_update
     */
    async rename(itemLocator: ItemLocator, name: string): Promise<any> {
        return this.#fetchJSON([locatorWrap(itemLocator)], {
            method: "PATCH",
            body: JSON.stringify({
                name,
            }),
        });
    }

    /**
     * upload a file whose size is less than 4MB
     * @param locator if pass { itemId: string }, the selected file will be overwritten
     * @param locator if pass { filePath: string }, it should contain the file name, otherwise the file name will be the same as the file name
     * @param locator if pass { parentId: string; filename?: string }, you need to specify the parent folder id
     * @param file if pass a File object assuming you are running in a browser or deno, you need to construct the File object yourself
     * @param file if pass a string, it should be the file path, only supported in node.js
     */
    async uploadSimple(
        locator: { itemId: string } | { filePath: string } | { parentId: string; filename?: string }, // the first for overwrite, the other for upload
        file: File | string // the front for browser, the rear for node
    ): Promise<any> {
        let q: string | undefined;
        if ("itemId" in locator) {
            q = idWrapper(locator.itemId);
        } else if ("filePath" in locator) {
            q = pathWrapper(locator.filePath);
        }
        // for browser/deno
        if (file instanceof File) {
            if ("parentId" in locator) {
                q = idWrapper(locator.parentId) + `:${locator.filename || file.name}:`;
            }
            if (q === undefined) throw new Error("itemId or parentId or filename or filePath is required");
            return this.#fetchJSON([q + "/content"], {
                method: "PUT",
                body: file,
            });
        }
        // for node.js
        if (typeof file === "string") {
            const { createReadStream } = await import("node:fs");
            const { basename } = await import("node:path");
            if ("parentId" in locator) {
                q = idWrapper(locator.parentId) + `:${locator.filename || basename(file)}:`;
            }
            if (q === undefined) throw new Error("itemId or parentId or filename or filePath is required");
            return this.#fetchJSON([q + "/content"], {
                method: "PUT",
                body: createReadStream(file) as any as ReadableStream,
            });
        }
    }

    // TODO
    async uploadSession() {}

    /**
     * customize a request if not shipped by this library
     * @param itemLocator bare string only if you know the API, otherwise use {path: "/path/to/file"} or {id: "id"}
     * @param command the command name, such as children, versions, checkin, checkout, ...
     * @param appendix the ODataAppendix or some suffix to the API
     * @param body the body of fetch
     * @param method the method of fetch
     * @example custom({id}, "versions")
     * @example custom({id}, "versions", "/{version-id}")
     * @example custom({id}, "versions", "/{version-id}/restoreVersion", undefined, "POST")
     */
    async custom(itemLocator: ItemLocator, command: string, appendix?: ODataAppendix, body?: any, method?: string) {
        return this.#fetchJSON([locatorWrap(itemLocator), "/" + command + simpleOData(appendix)], {
            method: method || (body ? "POST" : "GET"),
            body: body ? JSON.stringify(body) : undefined,
        });
    }
}

export default OnedriveAPI;
