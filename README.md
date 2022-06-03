# onedrive-api

another onedrive api for both node.js/deno and browser

## documentation

see <https://yieldray.github.io/onedrive-api/classes/main.default.html>

```ts
const api = new OnedriveAPI(accessToken);

// type ItemLocator = string | { path: string } | { id: string };
api.item("/root:/Documents/MyFile.xlsx:");
api.item({ path: "Documents/MyFile.xlsx" });
api.item("/items/0123456789AB");
api.item({ id: "0123456789AB" });

// methods
api.children({ path: "/" }).then(console.log);
api.item({ path: "path/to/file" }).then(console.log);
api.search({ path: "parent/to/search" }, "search text").then(console.log);
api.download({ path: "path/to/file" }).then(console.log); // get download url
api.mkdir({ path: "path/to/parent" }, "new folder name").then(console.log);
api.copy({ path: "文档/OneDrive 入门.pdf" }, { path: "附件" }).then(async (monitorUrl) => {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // wait a moment
    od.monitorCopy(monitorUrl).then(console.log);
});
api.uploadSimple({ path: "parent/folder/" }, "/path/to/local/file", "upload file name").then(console.log);
api.rename({ path: "path/to/file" }, "new file name").then(console.log);
api.move({ path: "path/to/file" }, { path: "new/parent/" }).then(console.log);
api.delete({ path: "path/to/file" }).then(console.log);
// for more, see the doc

// advance
api.setDrive("me");
api.setDrive("drives", "AB0987654321");
api.setDrive("groups", "AB0987654321");
api.setDrive("sites", "AB0987654321");
api.setDrive("users", "AB0987654321");
api.setDrive("approot");

api.setMaxDuration(10 * 1000); // 10s timeout

api.custom("/root", "children", undefined, {
    name: "Team Documents",
    remoteItem: {
        id: "12345abcde!1221",
        parentReference: { driveId: "12345abcde" },
    },
});

// as the Error thrown by the api can not provide detailed info, and is hard to known what happend
// when an error occur due to response code is not 2xx
// you can handle the error like this
api.download({ path: "path/to/file" }).catch((err) => {
    const { status, error, endpoint, headers } = api.detailFetch;
    if (status === 401 || error.code === "InvalidAuthenticationToken") {
        // access token is invalid or expired
        console.log(error.message);
    }
    const diagnostic = JSON.parse(headers.get("x-ms-ags-diagnostic"));
    console.log(diagnostic);
});
```
