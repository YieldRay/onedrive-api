import fetch from "cross-fetch";
import { fetchData, fetchURL, fetchJSON, fetchOK } from "./fetch.js";
import { CONFIG, FETCH_DETAIL } from "./fetch.js";
import { simpleOData, ODataAppendix } from "./helper.js";
import { locatorWrap, pathWrapper, ItemLocator } from "./helper.js";
import { RemoteItem, SingleRemoteItem, Thumbnail, ThumbnailSet } from "./types.js";

// view https://docs.microsoft.com/zh-cn/onedrive/developer/rest-api/ for details

//! API class start

class OnedriveAPI {
    /**
     * a fetch that have accessToken attached in headers
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/concepts/errors to view errors
     */
    async fetchAPI(input: RequestInfo, info?: RequestInit) {
        return fetch(input, {
            ...info,
            headers: {
                Authorization: `Bearer ${CONFIG.accessToken}`,
            },
        });
    }

    /**
     * A getter that expose the error info needed by the error handler
     */
    get detailFetch(): typeof FETCH_DETAIL {
        return JSON.parse(JSON.stringify(FETCH_DETAIL));
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
        if (!type || !["me", "drives", "groups", "sites", "users", "approot"].includes(type)) throw new Error("type must be one of me, drive, drives, groups, sites, users, approot");

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
     * Check-in a checked out DriveItem resource, which makes the version of the document available to others.
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_checkin
     */
    async checkin(itemLocator: ItemLocator, comment: string): Promise<boolean> {
        return fetchOK([locatorWrap(itemLocator), "/checkin"], {
            method: "POST",
            body: JSON.stringify({ comment }),
        });
    }

    /**
     * Check-out a driveItem resource to prevent others from editing the document, and your changes from being visible until the documented is checked-in.
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_checkout
     */
    async checkout(itemLocator: ItemLocator): Promise<boolean> {
        return fetchOK([locatorWrap(itemLocator), "/checkout"]);
    }

    /**
     * (Only return monitor url) Asynchronously creates a copy of an driveItem (including any children), under a new parent item or with a new name.
     * @example
     * const monitorUrl = await copy({ path: "path/to/file" }, { path: "path/to/folder" });
     * const copyResult = await monitorCopy(monitorUrl);
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_copy
     */
    async copy(itemLocator: ItemLocator, parentLocator: Exclude<ItemLocator, string>, name?: string): Promise<string> {
        const id = parentLocator && "id" in parentLocator ? parentLocator.id : undefined;
        const path = parentLocator && "path" in parentLocator ? parentLocator.path : undefined;

        if (!id && !path) throw new Error("parentLocator must have id or path");

        return fetchURL([locatorWrap(itemLocator), "/copy"], {
            method: "POST",
            body: JSON.stringify({
                parentReference: {
                    id,
                    path: path ? "/drive" + pathWrapper(path) : undefined,
                },
                name,
            }),
        });
    }

    async monitorCopy(
        monitorUrl: string
    ): Promise<{ resourceId?: string; operation: string; status: "completed" | "inProgress" | "failed" | "notStarted"; percentageComplete?: number; errorCode?: string; statusDescription: string }> {
        return fetch(monitorUrl).then((res) => res.json());
    }

    /**
     * Create a new folder or DriveItem in a Drive with a specified parent item or path.
     * @param parentLocator the parent id or path of the new folder
     * @param name the name of the new folder
     * @param renameIfExist if true, the folder will be renamed if the name already exists, otherwise it will throw an error
     * @example createFolder({path:"path/to/folder"}, "New Folder", true)
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_post_children
     */
    async mkdir(parentLocator: ItemLocator, name: string, renameIfExist = false): Promise<SingleRemoteItem> {
        return fetchJSON([locatorWrap(parentLocator), "/children"], {
            method: "POST",
            body: JSON.stringify({
                name,
                folder: {},
                "@microsoft.graph.conflictBehavior": renameIfExist ? "rename" : undefined,
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
     * (Only return downloadUrl) Download the contents of the primary stream (file) of a DriveItem. Only driveItems with the file property can be downloaded.
     * @returns Pre-authenticated download URL which is only valid for a short period of time (a few minutes) and do not require an Authorization header to download.
     * @example
     * download({path:"/path/to/file"})
     * download({path:"/path/to/file"}, {format: "jpg"}) // specify format
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_get_content
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_get_content_format
     */
    async download(itemLocator: ItemLocator, appendix?: ODataAppendix): Promise<string> {
        return fetchURL([locatorWrap(itemLocator), "/content" + simpleOData(appendix)], {
            method: "GET",
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
    async item(itemLocator: ItemLocator, appendix?: ODataAppendix): Promise<SingleRemoteItem> {
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
    async children(itemLocator: ItemLocator, appendix?: ODataAppendix): Promise<{ "@odata.context": string; "@odata.count": number; value: Array<RemoteItem> }> {
        return fetchJSON([locatorWrap(itemLocator), "/children" + simpleOData(appendix)]);
    }

    /**
     * Move a DriveItem to a new folder
     * This is a special case of the Update method. Your app can combine moving an item to a new container and updating other properties of the item into a single request.
     * Items cannot be moved between Drives using this request.
     * @param parentLocator like parentReference, but is {path: "/path/to/file"} or {id: "id"}, string is not allowed
     * @param newItemName optional, new name for the item, has the same effect as rename
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_move
     */
    async move(itemLocator: ItemLocator, parentLocator?: Exclude<ItemLocator, string>, newItemName?: string): Promise<SingleRemoteItem> {
        if (!parentLocator && !newItemName) throw new Error("parentLocator or newItemName must be specified");

        const id = parentLocator && "id" in parentLocator ? parentLocator.id : undefined;
        const path = parentLocator && "path" in parentLocator ? parentLocator.path : undefined;

        if (!id && !path) throw new Error("parentLocator must have id or path");
        return fetchJSON([locatorWrap(itemLocator)], {
            method: "PATCH",
            body: JSON.stringify({
                parentReference: {
                    id,
                    path: path ? "/drive" + pathWrapper(path) : undefined,
                },
                name: newItemName,
            }),
        });
    }

    /**
     * A shortcut for renaming a DriveItem resource
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_update
     */
    async rename(itemLocator: ItemLocator, name: string): Promise<SingleRemoteItem> {
        return fetchJSON([locatorWrap(itemLocator)], {
            method: "PATCH",
            body: JSON.stringify({
                name,
            }),
        });
    }

    /**
     * This action allows you to obtain short-lived embeddable URLs for an item.
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
    async search(
        itemLocator: ItemLocator,
        searchText: string
    ): Promise<{
        "@odata.context": string;
        value: Array<RemoteItem & { readonly "@odata.type": string; readonly searchResult: any }>;
        "@odata.nextLink"?: string;
    }> {
        return fetchJSON([locatorWrap(itemLocator), `/search(q='${searchText}')`]);
    }

    /**
     * This method allows your app to track changes to a drive and its children over time.
     * @example
     *  delta({path:""}, {token:"latest"})
     *  od.fetchAPI((await od.delta(...))["@odata.nextLink"]).then(res=>res.json()) // for next page
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_delta
     */
    async delta(itemLocator: ItemLocator, appendix?: ODataAppendix): Promise<{ value: any[]; "@odata.nextLink"?: string }> {
        return fetchJSON([locatorWrap(itemLocator), "/delta" + simpleOData(appendix)]);
    }

    /**
     * Retrieve a collection of ThumbnailSet resources for a DriveItem resource.
     * @example
     * thumbnails({path:"图片"})
     * thumbnails({path:"图片"}, "0", "small | medium | large")
     * thumbnails({path:"图片"}, "0", "small", "/content") // get downloadUrl
     * children({path:"图片"}, {$expand:"thumbnails"}) // a replacement for getting thumbnails
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_list_thumbnails
     * @see ThumbnailSet https://docs.microsoft.com/onedrive/developer/rest-api/resources/thumbnailset
     */
    async thumbnails(itemLocator: ItemLocator, thumbId: undefined, size: undefined, appendix?: ODataAppendix): Promise<{ "@odata.context": string; value: ThumbnailSet }>;
    async thumbnails(itemLocator: ItemLocator, thumbId: string, size: string, appendix?: ODataAppendix): Promise<Thumbnail & { "@odata.context": string }>;
    async thumbnails(itemLocator: ItemLocator, thumbId: string, size: string, appendix: "/content"): Promise<string>;
    async thumbnails(itemLocator: ItemLocator, thumbId?: string, size?: string, appendix?: ODataAppendix) {
        if (thumbId && size) {
            const odata = simpleOData(appendix);
            return (odata === "/content" ? fetchURL : fetchJSON)([locatorWrap(itemLocator), "/thumbnails/" + thumbId, "/" + size, odata]);
        }
        return fetchJSON([locatorWrap(itemLocator), "/thumbnails" + simpleOData(appendix)]);
    }

    /**
     * Upload the contents of a DriveItem (less than 4MB)
     * @param parentLocator pass an parentLocator for replacing the old file, e.g. {path:"/path/to/folder/"} where the path must end with a "/"
     * @param file if pass a File object assuming you are running in a browser or deno, you need to construct the File object yourself
     * @param file if pass a string, it should be the file path, only supported in node.js
     * @param filename pass "" if you want to use the file name of the file
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_put_content
     */
    async uploadSimple(parentLocator: ItemLocator, file: File | string, filename: string): Promise<SingleRemoteItem>;
    /**
     * Replace the contents of a DriveItem (less than 4MB)
     * @param itemLocator pass an itemLocator for replacing the old file
     * @param file if pass a File object assuming you are running in a browser or deno, you need to construct the File object yourself
     * @param file if pass a string, it should be the file path, only supported in node.js
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_put_content
     */
    async uploadSimple(itemLocator: ItemLocator, file: File | string): Promise<SingleRemoteItem>;
    async uploadSimple(locator: ItemLocator, file: File | string, filename?: string): Promise<SingleRemoteItem> {
        if (typeof filename !== "string") {
            // ! upload replace
            let body: BodyInit;
            if (typeof File !== "undefined") {
                // for browser/deno
                if (!(file instanceof File)) throw new Error("file should be a File object");
                body = file;
            } else {
                // for node.js
                if (typeof file !== "string") throw new Error("file should be a string");
                const { createReadStream } = await import("node:fs");
                body = createReadStream(file) as any as ReadableStream;
            }
            return fetchJSON([locatorWrap(locator) + "/content"], {
                method: "PUT",
                body,
            });
        } else {
            // ! upload new
            let query: string;
            let fileName: string;
            let body: BodyInit;

            if (typeof File !== "undefined") {
                // for browser/deno
                if (!(file instanceof File)) throw new Error("file should be a File object");
                fileName = filename || file.name;
                if (typeof locator === "string") query = locator;
                else if ("id" in locator) query = `/items/${locator.id}:/${fileName}:/content`;
                else if ("path" in locator) {
                    if (!locator.path.endsWith("/")) throw new Error("A parent folder path must end with '/'");
                    query = `/root:/${locator.path}${fileName}:/content`;
                } else throw new Error("locator must be a string or an ItemLocator");

                body = file;
            } else {
                // for node.js
                if (typeof file !== "string") throw new Error("file should be a string");
                const { createReadStream, existsSync } = await import("node:fs");
                if (!existsSync(file)) throw new Error("file does not exist");
                const { basename } = await import("node:path");
                fileName = filename || basename(file);

                body = createReadStream(file) as any as ReadableStream;
            }

            if (typeof locator === "string") query = locator;
            else if ("id" in locator) query = `/items/${locator.id}:/${fileName}:/content`;
            else if ("path" in locator) {
                if (!locator.path.endsWith("/")) throw new Error("A parent folder path must end with '/'");
                query = `/root:/${locator.path}${fileName}:/content`;
            } else throw new Error("locator must be a string or an ItemLocator");

            return fetchJSON(query, {
                method: "PUT",
                body,
            });
        }
    }

    /**
     * This only returns `{uploadUrl, expirationDateTime}`, where the `uploadUrl` need not authorization, use `upload-node.ts` to upload the file
     * @see https://docs.microsoft.com/onedrive/developer/rest-api/api/driveitem_createuploadsession
     */
    async uploadSession(itemLocator: ItemLocator): Promise<{
        uploadUrl: string;
        expirationDateTime: string;
    }> {
        return fetchJSON([locatorWrap(itemLocator)]);
    }

    /**
     * customize a request if not shipped by this library
     * @param itemLocator bare string only if you know the API, otherwise use {path: "/path/to/file"} or {id: "id"}
     * @param command the command name, such as children, versions, checkin, checkout, ...
     * @param appendix the ODataAppendix or some suffix to the API
     * @param body the body of fetch
     * @param method the method of fetch
     * @example
     *  custom({id}, "versions") // Listing versions of a DriveItem
     *  custom({id}, "versions", "/{version-id}") // Get a DriveItemVersion resource
     *  custom({id}, "versions", "/{version-id}/restoreVersion", undefined, "POST") // Restore a previous version of a DriveItem
     */
    async custom(itemLocator: ItemLocator, command: string, appendix?: ODataAppendix, body?: any, method?: string) {
        return fetchJSON([locatorWrap(itemLocator), "/" + command + simpleOData(appendix)], {
            method: method || (body ? "POST" : "GET"),
            body: body ? JSON.stringify(body) : undefined,
        });
    }
}

export default OnedriveAPI;
