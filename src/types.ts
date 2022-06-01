// https://docs.microsoft.com/onedrive/developer/rest-api/resources/remoteitem
type RemoteItem = Readonly<{
    "@microsoft.graph.downloadUrl": string;
    id: string;
    createdBy: IdentitySet;
    createdDateTime: string;
    file: {
        hashes: {
            crc32Hash: string;
            sha1Hash: string; // 在 OneDrive for Business 和 SharePoint Server 2016 中，sha1Hash 和 crc32Hash 不可用。
            quickXorHash: string; // 在 OneDrive 个人版中，quickXorHash 不可用。
        };
        mimeType: string;
        processingMetadata: boolean;
    };
    fileSystemInfo: {
        createdDateTime: string;
        lastAccessedDateTime: string;
        lastModifiedDateTime: string;
    };
    folder: {
        childCount: number;
        view: {
            sortBy: "default" | "name" | "type" | "size" | "takenOrCreatedDateTime" | "lastModifiedDateTime" | "sequence";
            sortOrder: "ascending" | "descending";
            viewType: "default" | "icons" | "details" | "thumbnails";
        };
    };
    lastModifiedBy: IdentitySet;
    lastModifiedDateTime: string;
    name: string;
    package: {
        type: "oneNote";
    };
    parentReference: ItemReference;
    shared: {
        owner: IdentitySet;
        scope: "anonymous" | "organization" | "users";
        sharedBy: IdentitySet;
        sharedDateTime: string;
    };
    sharepointIds: SharePointIds;
    specialFolder: {
        name: string;
    };
    size: number;
    webDavUrl: string;
    webUrl: string;
}>;

type SingleRemoteItem = RemoteItem & { readonly "@odata.context": string };

//
//
//
//
//

interface SharePointIds {
    listId: string;
    listItemId: string;
    listItemUniqueId: string;
    siteId: string;
    siteUrl: string;
    tenantId: string;
    webId: string;
}

interface ItemReference {
    driveId: string;
    driveType: "personal" | "business" | "documentLibrary";
    id: string;
    listId: string;
    name: string;
    path: string;
    shareId: string;
    sharepointIds: SharePointIds;
    siteId: string;
}

interface Thumbnail {
    width: number;
    height: number;
    sourceItemId: string;
    url: string;
    // content: any; // stream
}
interface ThumbnailSet {
    id: string;
    large: Thumbnail;
    medium: Thumbnail;
    small: Thumbnail;
    source: Thumbnail;
}

interface Identity {
    displayName: string;
    id: string;
    thumbnails: ThumbnailSet[];
}

interface IdentitySet {
    application: Identity;
    device: Identity;
    group: Identity;
    user: Identity;
}

export { RemoteItem, SingleRemoteItem, Thumbnail, ThumbnailSet };
