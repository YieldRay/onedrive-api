import fs from "fs/promises";
import OnedriveAPI from "./dist/main.js";
import fetch from "cross-fetch";

const { access_token, refresh_token } = await fs.readFile(".env", "utf8").then(JSON.parse);
const od = new OnedriveAPI(access_token);
od.setMaxDuration(5 * 1000);
// od.children({ path: "文档" }).then(console.log);
// od.item({ path: "文档/OneDrive 入门.pdf" }).then(console.log);
// od.search({ path: "文档" }, "OneDrive").then(console.log);
// od.download({ path: "文档/OneDrive 入门.pdf" }).then((downloadUrl) => {
//     console.log(downloadUrl);
//     console.log(od.detailFetch);
// });
// od.thumbnails({ path: "图片" }).then(console.log);
// od.thumbnails({ path: "图片" }, "0", "small").then(console.log);
// od.thumbnails({ path: "图片" }, "0", "small", "/content").then(console.log);
// od.uploadSimple({ path: "附件/" }, "./test.js", "test.js").then(console.log);
// od.rename({ path: "附件/test.js" }, "tested.js").then(console.log);
// od.move({ path: "附件/tested.js" }, { path: "/" }).then(console.log);
// od.delete({ path: "附件/tested.js" }).then(console.log);

function refresh(refreshToken) {
    return fetch("https://onedrive.deno.dev/refresh?refresh_token=" + refreshToken)
        .then((res) => res.text())
        .then((res) => {
            console.log(JSON.parse(res));
            return fs.writeFile(".env", res, "utf8");
        });
}
// refresh(refresh_token);
