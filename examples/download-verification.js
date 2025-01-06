// Copyright (c) 2021-2025 BuiltByBit (Mick Capital Pty. Ltd.)
// MIT License (https://github.com/BuiltByBit/js-api-wrapper/blob/main/LICENSE)

const { Wrapper, Token, TokenType } = require("@builtbybit/api-wrapper");
const readline = require("readline");
const { table } = require("table"); 

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const config = {
    header: {
        alignment: "center",
        content: "BuiltByBit Download Verification"
    }
};

let token = new Token(TokenType.PRIVATE, "Find @ https://builtbybit.com/account/api");
let wrapper = new Wrapper();

async function main() {
    await wrapper.init(token); 

    let ownedResources = await wrapper.resources().listOwnedAll().catch(e => { console.error(e); });
    let resourceIds = [["Resource Title", "Resource ID"]];
    for (const resource of ownedResources) {
        resourceIds.push([resource.title, resource.resource_id]);
    }
    const ownedConfig = {
        header: {
            alignment: "center",
            content: "BuiltByBit Download Verification\nOwned Resources"
        }
    };
    console.log(table(resourceIds, ownedConfig));

    rl.question("Lookup by (u)sername or by (r)esource id? ", async (answer) =>{
        let downloadDetails;
        let user;
        let downloads = [];
        switch (answer.toLowerCase()) {
        case "u":
            try {
                rl.question("What is the username of the user you'd like to lookup? ", async (username) => {
                    user = await wrapper.members().fetchByUsername(username).catch(e => { console.error(e); });
                    console.log("Fetching...");
                    downloads.push(["Resource Title", "Resource ID", "Download Date"]);
                    for (const resource of ownedResources) {
                        // eslint-disable-next-line max-len
                        downloadDetails = await wrapper.resources().downloads().listByMemberAll(resource.resource_id, user.member_id).catch(e => { console.error(e); });
                        for (const download of downloadDetails) {
                            // eslint-disable-next-line max-len
                            downloads.push([resource.title, resource.resource_id, new Date(download.download_date * 1000).toLocaleString()]);
                        }
                    }
                    console.log(table(downloads, config));
                    rl.close();
                });
            } catch (e) {
                console.error(e);
                rl.close();
            }
            break;
        case "r":
            try {
                rl.question("What is the resource id of the resource you'd like to lookup? ", async (resourceId) => {
                    // eslint-disable-next-line max-len
                    downloadDetails = await wrapper.resources().downloads().listAll(resourceId).catch(e => { console.error(e); });
                    downloads.push(["Username", "Member ID", "Download Date"]);
                    console.log("Fetching...");
                    for (const download of downloadDetails) {
                        user = await wrapper.members().fetch(download.downloader_id).catch(e => { console.error(e); });
                        // eslint-disable-next-line max-len
                        downloads.push([user.username, user.member_id, new Date(download.download_date * 1000).toLocaleString()]);
                    }
                    console.log(table(downloads, config));
                    rl.close();
                });
            } catch (e) {
                console.error(e);
                rl.close();
            }
            break;
        default:
            console.error("Invalid input. Please try again.");
            rl.close();
            break;
        }
    });
}

main().catch(error => console.error("ERROR: " + error));