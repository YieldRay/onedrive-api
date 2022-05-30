import { fetchData, fetchURL, fetchJSON, fetchOK, CONFIG } from "./fetch.js";
import { simpleOData, ODataAppendix } from "./helper.js";
import { pathWrapper, idWrapper, locatorWrap, ItemLocator } from "./helper.js";

// view https://docs.microsoft.com/zh-cn/onedrive/developer/rest-api/ for details

//! API class start

class OnedriveAPI {
    /**
     * a fetch that have accessToken attached in headers
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/concepts/errors to view errors
     */

    async fetchAPI(input: RequestInfo, info?: RequestInit) {
        if (!info) info = {};
        return fetch(
            input,
            Object.assign(info, {
                headers: {
                    Authorization: `Bearer ${CONFIG.accessToken}`,
                },
            })
        ).then((response) => response.json());
    }

    /**
     * initialize the API with accessToken
     * @param accessToken
     */
    constructor(accessToken: string) {
        CONFIG.accessToken = accessToken;
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
                CONFIG.drive = "/me/drive";
                break;
            case "approot":
                CONFIG.drive = "/drive/special/approot";
                break;
            default:
                if (!id) throw new Error(`id is required as parameter for ${type}`);
                if (type === "drives") CONFIG.drive = `/drives/${id}`;
                else CONFIG.drive = `/${type}/${id}/drives`;
        }
    }

    /**
     * set the max duration of fetch, default is unlimited
     * @param maxDuration (unit is milliseconds) if pass 0 or negative number, no timeout will be set
     */
    setMaxDuration(maxDuration: number) {
        CONFIG.maxDuration = maxDuration;
    }

    /**
     * @param accessToken set accessToken if you want to use another token
     */
    setAccessToken(accessToken: string) {
        CONFIG.accessToken = accessToken;
    }

    //! API functions start

    /**
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_checkin
     */
    async checkin(itemLocator: ItemLocator, comment: string): Promise<boolean> {
        return fetchOK([locatorWrap(itemLocator), "/checkin"], {
            method: "POST",
            body: JSON.stringify({ comment }),
        });
    }

    /**
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_checkout
     */
    async checkout(itemLocator: ItemLocator): Promise<boolean> {
        return fetchOK([locatorWrap(itemLocator), "/checkout"]);
    }

    /**
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_copy
     */
    async copy(
        itemLocator: ItemLocator,
        parentReference?: { driveId: string; id: string },
        name?: string
    ): Promise<any> {
        return fetchJSON([locatorWrap(itemLocator), "/copy"], {
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
        return fetchJSON(["/" + parentItemId, "/children"], {
            method: "POST",
            body: JSON.stringify({
                name,
                folder: {},
                "@microsoft.graph.conflictBehavior": "rename", // this is for mkdir
            }),
        });
    }

    /**
     * Delete a DriveItem by using its ID or path. Note that deleting items using this method will move the items to the recycle bin instead of permanently deleting the item.
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_delete
     */
    async delete(itemLocator: ItemLocator): Promise<boolean> {
        return fetchOK(locatorWrap(itemLocator), {
            method: "DELETE",
        });
    }

    /**
     * Download the contents of the primary stream (file) of a DriveItem. Only driveItems with the file property can be downloaded.
     * @param range the range of the file to download, default is the whole file
     * @returns Pre-authenticated download URL which is only valid for a short period of time (a few minutes) and do not require an Authorization header to download.
     * @example
     * download({path:"/path/to/file"})
     * download({path:"/path/to/file"}, [0,1023]) // partial range downloads
     * download({path:"/path/to/file"}, undefined, {format: "jpg"})
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_get_content
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_get_content_format
     */
    async download(
        itemLocator: ItemLocator,
        range?: [start: number, end: number],
        appendix?: ODataAppendix
    ): Promise<string> {
        return fetchURL([locatorWrap(itemLocator), "/content" + simpleOData(appendix)], {
            method: "GET",
            headers: range
                ? {
                      Range: `bytes=${range?.join("-")}`,
                  }
                : {},
        });
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
        return fetchJSON([locatorWrap(itemLocator), "/" + simpleOData(appendix)]);
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
        return fetchJSON([locatorWrap(itemLocator), "/children" + simpleOData(appendix)]);
    }

    /**
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_move
     */
    async move(itemLocator: ItemLocator, newParentFolderID: number, newItemName?: string): Promise<any> {
        return fetchJSON([locatorWrap(itemLocator)], {
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
        return fetchJSON([locatorWrap(itemLocator), "/preview"], {
            method: "POST",
            body: JSON.stringify(options),
        });
    }

    /**
     * Search the hierarchy of items for items matching a query. You can search within a folder hierarchy, a whole drive, or files shared with the current user.
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_search
     */
    async search(itemLocator: ItemLocator, searchText: string): Promise<any> {
        return fetchJSON([locatorWrap(itemLocator), `/search(q='${searchText}`]);
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
        return fetchJSON([locatorWrap(itemLocator), "/delta" + simpleOData(appendix)]);
    }

    /**
     * Retrieve a collection of ThumbnailSet resources for a DriveItem resource.
     * @example
     * thumbnails({path:"图片"})
     * thumbnails({path:"图片"}, "0", "small")
     * thumbnails({path:"图片"}, "0", "small", "/content") // get binary data, unrecommended
     * children({path:"图片"}, {$expand:"thumbnails"}) // a replacement for getting thumbnails
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_list_thumbnails
     * @see ThumbnailSet https://docs.microsoft.com/onedrive/developer/rest-api/resources/thumbnailset
     */
    async thumbnails(itemLocator: ItemLocator, thumbId?: string, size?: string, appendix?: ODataAppendix) {
        if (thumbId && size) {
            const odata = simpleOData(appendix);
            if (odata === "/content")
                return fetchURL([locatorWrap(itemLocator), "/thumbnails/" + thumbId, "/" + size, odata]);
            else
                return fetchJSON([
                    locatorWrap(itemLocator),
                    "/thumbnails/" + thumbId,
                    "/" + size,
                    appendix ? `?${simpleOData(appendix)}` : "",
                ]);
        }
        return fetchJSON([locatorWrap(itemLocator), "/thumbnails" + simpleOData(appendix)]);
    }

    /**
     * rename a DriveItem resource
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_update
     */
    async rename(itemLocator: ItemLocator, name: string): Promise<any> {
        return fetchJSON([locatorWrap(itemLocator)], {
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
            return fetchJSON([q + "/content"], {
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
            return fetchJSON([q + "/content"], {
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
        return fetchJSON([locatorWrap(itemLocator), "/" + command + simpleOData(appendix)], {
            method: method || (body ? "POST" : "GET"),
            body: body ? JSON.stringify(body) : undefined,
        });
    }
}

export default OnedriveAPI;
