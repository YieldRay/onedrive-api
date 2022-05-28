import fs from "fs/promises";
import OnedriveAPI from "./dist/main.js";

const auth = await fs.readFile(".env", "utf8").then(JSON.parse);
const od = new OnedriveAPI(auth.access_token);
od.children({ path: "文档" }).then(console.log);
od.item({ path: "文档/OneDrive 入门.pdf" }).then(console.log);
