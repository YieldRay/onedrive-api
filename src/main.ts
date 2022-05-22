import fetch from "cross-fetch";
import { simpleOData, ODataAppendix, composeURL, determineDrive, pathWrapper, idWrapper } from "./helper.js";

// view https://docs.microsoft.com/zh-cn/onedrive/developer/rest-api/ for details

type ItemLocator = string | { path: string } | { id: string };
const locatorWrap = (locator: ItemLocator): string => {
    if (typeof locator === "string") return locator;
    if ("path" in locator) return pathWrapper(locator.path);
    if ("id" in locator) return idWrapper(locator.id);
    throw new Error("Invalid locator");
};
class OnedriveAPI {
    #accessToken: string;
    #graphURL = "https://graph.microsoft.com/v1.0";
    #drive = "/drive";
    async #fetch(url: string | Array<string>, options?: RequestInit): Promise<Response> {
        return fetch(
            //! keep in mind that every compose element except the first one should start with / but not end with /
            composeURL(this.#graphURL, this.#drive, ...(Array.isArray(url) ? url : [url])),
            Object.assign(
                {
                    headers: {
                        Authorization: `Bearer ${this.#accessToken}`,
                    },
                },
                options
            )
        );
    }

    async #fetchJSON(url: string | Array<string>, options?: RequestInit): Promise<any> {
        return this.#fetch(url, options).then((response) => response.json());
    }

    async #fetchOK(url: string | Array<string>, options?: RequestInit): Promise<boolean> {
        return this.#fetch(url, options).then((response) => response.ok);
    }

    async fetchAPI(input: RequestInfo, info?: RequestInit) {
        return fetch(input, info).then((response) => response.json());
    }

    constructor(accessToken: string) {
        this.#accessToken = accessToken;
    }

    // set drive if you want to change current drive, default might be user's onedrive
    setDrive(drive?: "drive" | "drives" | "groups" | "sites" | "users" | "approot", id?: string) {
        this.#drive = determineDrive(drive, id);
    }

    async checkin(itemLocator: ItemLocator, comment: string): Promise<boolean> {
        return this.#fetchOK([locatorWrap(itemLocator), "/checkin"], {
            method: "POST",
            body: JSON.stringify({ comment }),
        });
    }

    async checkout(itemLocator: ItemLocator): Promise<boolean> {
        return this.#fetchOK([locatorWrap(itemLocator), "/checkout"]);
    }

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

    async delete(itemLocator: ItemLocator): Promise<boolean> {
        return this.#fetchOK(locatorWrap(itemLocator), {
            method: "DELETE",
        });
    }

    // e.g download({path:"/path/to/file"}, undefined, {format: "jpg"})
    // see https://docs.microsoft.com/zh-cn/onedrive/developer/rest-api/api/driveitem_get_content_format
    async download(
        itemLocator: ItemLocator,
        range?: [number, number],
        appendix?: ODataAppendix
    ): Promise<ReadableStream | null> {
        return this.#fetch([locatorWrap(itemLocator), "/?" + simpleOData(appendix)], {
            method: "GET",
            headers: range
                ? {
                      Range: `bytes=${range?.join("-")}`,
                  }
                : {},
        }).then((response) => response.body);
    }

    async item(itemLocator: ItemLocator, appendix?: ODataAppendix) {
        return this.#fetchJSON([locatorWrap(itemLocator), "/" + simpleOData(appendix)]);
    }

    // e.g. children("") // for root
    async children(itemLocator: ItemLocator, appendix?: ODataAppendix): Promise<any> {
        return this.#fetchJSON([locatorWrap(itemLocator), "/children" + simpleOData(appendix)]);
    }

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

    async search(itemLocator: ItemLocator, searchText: string): Promise<any> {
        return this.#fetchJSON([locatorWrap(itemLocator), `/search(q='${searchText}`]);
    }

    // e.g fetchAPI(res["@odata.nextLink"]) // for next page
    // delta({path:""}, {token:"latest"})
    async delta(
        itemLocator: ItemLocator,
        appendix?: ODataAppendix
    ): Promise<{ value: any[]; "@odata.nextLink"?: string }> {
        return this.#fetchJSON([locatorWrap(itemLocator), "/delta" + simpleOData(appendix)]);
    }

    // recommend to use getItemChildren(path, {expand:"thumbnails"}) if possible
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

    async rename(itemLocator: ItemLocator, name: string): Promise<any> {
        return this.#fetchJSON([locatorWrap(itemLocator)], {
            method: "PATCH",
            body: JSON.stringify({
                name,
            }),
        });
    }

    // file size less than 4M
    // itemLocator should contain the file name
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

    // e.g custom({id}, "versions")
    // e.g custom({id}, "versions", "/{version-id}")
    // e.g custom({id}, "versions", "/{version-id}/restoreVersion", undefined, "POST")
    async custom(itemLocator: ItemLocator, command: string, appendix?: ODataAppendix, body?: any, method?: string) {
        return this.#fetchJSON([locatorWrap(itemLocator), "/" + command + simpleOData(appendix)], {
            method: method || (body ? "POST" : "GET"),
            body: body ? JSON.stringify(body) : undefined,
        });
    }
}

export default OnedriveAPI;
