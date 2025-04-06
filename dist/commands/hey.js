"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const axios_1 = __importDefault(require("axios"));
exports.data = {
    name: "hey",
    description: "Reply with hey",
};
async function run({ interaction, client, handler }) {
    interaction.reply("Hey!");
    const graphqlApiUrl = "https://www.warcraftlogs.com/api/v2/client";
    async function getAccessToken() {
        const tokenUri = "https://www.warcraftlogs.com/oauth/token";
        try {
            const response = await axios_1.default.post(tokenUri, new URLSearchParams({ grant_type: "client_credentials" }), // Form data
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                auth: {
                    username: process.env.WLOGS_CLIENT_ID || "",
                    password: process.env.WLOGS_CLIENT_SECRET || "", // Basic HTTP auth
                },
            });
            console.log("got token");
            return response.data.access_token; // Access token
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                console.error("Error fetching access token:", error.response?.data || error.message);
            }
            else {
                console.error("An unexpected error occurred:", error.message);
            }
            throw new Error("Failed to obtain access token");
        }
    }
    async function getAPILimit() {
        const query = `
    query {
      rateLimitData  {
        pointsSpentThisHour
        limitPerHour
        pointsResetIn
        }
      }
    `;
        try {
            const response = await axios_1.default.post(graphqlApiUrl, { query }, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            console.log(response.data);
        }
        catch (error) {
            console.log(`Error fetching data: ${error}`);
        }
    }
    const accessToken = await getAccessToken();
    await getAPILimit();
}
exports.options = {
    deleted: false,
};
