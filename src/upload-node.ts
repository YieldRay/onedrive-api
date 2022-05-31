import { open, read, statSync, existsSync } from "node:fs";
import fetch from "cross-fetch";

export default async function (uploadUrl: string, filepath: string) {
    return new Promise<void>(async (resolve, reject) => {
        if (!existsSync(filepath)) throw new Error("file does not exist");
        const { size } = statSync(filepath);
        const chunkSize = 327680;
        let buffer = Buffer.alloc(chunkSize);
        let position = 0;
        const sendChunk = async (buffer: Buffer) => {
            // success 202 201 200 ...
            const { status } = await fetch(uploadUrl, {
                method: "PUT",
                body: buffer,
                headers: {
                    "Content-Length": buffer.length.toString(),
                    "Content-Range": `bytes ${position}-${position + buffer.length - 1}/${size}`,
                },
            });
            return status;
        };
        open(filepath, "r", undefined, (err, fd) => {
            if (err) reject(err);
            const readNext = () =>
                read(fd, buffer, 0, chunkSize, position, async (err, bytesRead, buffer) => {
                    if (err) reject(err);
                    if (bytesRead === 0) {
                        // end of file
                        resolve();
                    } else {
                        // read next chunk
                        let errorCount = 0;
                        const sendThisChunk = async () => {
                            const status = await sendChunk(buffer);
                            if (status === 202) return;
                            else if (status === 200 || status === 201) resolve();
                            else if (Math.floor(status / 100) === 5) {
                                // Use an exponential back off strategy if any 5xx server errors are returned when resuming or retrying upload requests.
                                errorCount++;
                                if (errorCount > 5) {
                                    // max 5 retries
                                    reject(new Error("Too many errors"));
                                } else {
                                    await new Promise(
                                        (resolve) => setTimeout(resolve, Math.pow(2, errorCount) * 500) // 0.5s ** n
                                    );
                                    sendThisChunk(); // retry
                                }
                            } else {
                                reject(new Error(`Unexpected status code: ${status}`));
                            }
                        };
                        sendThisChunk();
                        position += bytesRead;
                        readNext();
                    }
                });
            readNext();
        });
    });
}
