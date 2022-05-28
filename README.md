# onedrive-api

> ## Under construction...
>
> ## This library is not fully tested, do not use it at present!

another onedrive api for both node.js/deno and browser

```ts
const api = new OnedriveAPI(accessToken);

type ItemLocator = string | { path: string } | { id: string };
api.item("/root:/Documents/MyFile.xlsx:");
api.item("/items/0123456789AB");
api.item({ path: "Documents/MyFile.xlsx" });
api.item({ id: "0123456789AB" });

api.children({ path: "/" }); // for root folder

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
```
