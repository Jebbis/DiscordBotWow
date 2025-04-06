"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
async function default_1(message, client, handler) {
    if (message.content.startsWith("!droptimizer")) {
        const args = message.content.split(" ");
        if (args.length !== 3) {
            await message.reply("Invalid format. Use `!droptimizer <character_id> <report_id>`.");
            return;
        }
        const characterID = parseInt(args[1], 10);
        const reportID = args[2];
        if (isNaN(characterID)) {
            await message.reply("The character ID must be a number.");
            return;
        }
        const apiUrl = "https://wowaudit.com/v1/wishlists";
        const data = {
            report_id: reportID,
            character_id: characterID,
        };
        try {
            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${process.env.WOWAUDIT_SECRET}`,
                },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                throw new Error(`Error: ${response.status} ${response.statusText}`);
            }
            const result = await response.json();
            console.log("API response:", result);
            await message.reply("Droptimizer request successfully posted!");
        }
        catch (error) {
            console.error("Failed to send POST request:", error);
            await message.reply("Failed to post droptimizer request. Please try again later.");
        }
    }
}
