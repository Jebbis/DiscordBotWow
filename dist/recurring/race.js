"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.race = race;
const axios_1 = __importDefault(require("axios"));
const dotenv = __importStar(require("dotenv"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
dotenv.config();
const DATA_FILE = path_1.default.resolve(process.cwd(), "data/guilds.json");
async function saveDataToFile(data) {
    await promises_1.default.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}
async function loadDataFromFile() {
    try {
        const raw = await promises_1.default.readFile(DATA_FILE, "utf-8");
        return JSON.parse(raw);
    }
    catch (err) {
        console.warn("No previous data found or error reading file, returning empty array.");
        return [];
    }
}
async function compareWithFile(newData) {
    const previousData = await loadDataFromFile();
    const changed = [];
    for (const guild of newData) {
        const match = previousData.find((prev) => prev.name === guild.name && prev.encounterName === guild.encounterName);
        if (!match || match.bestPercent !== guild.bestPercent) {
            changed.push(guild);
        }
    }
    await saveDataToFile(newData);
    return changed;
}
async function race() {
    async function getAccessToken() {
        const tokenUri = "https://www.warcraftlogs.com/oauth/token";
        try {
            const response = await axios_1.default.post(tokenUri, new URLSearchParams({ grant_type: "client_credentials" }), {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                auth: {
                    username: process.env.WLOGS_CLIENT_ID || "",
                    password: process.env.WLOGS_CLIENT_SECRET || "",
                },
            });
            console.log("got token");
            return response.data.access_token;
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
    async function get_guilds_data(accessToken) {
        const graphqlApiUrl = "https://www.warcraftlogs.com/api/v2/client";
        const query = `
    query {
        progressRaceData {
            progressRace (
                serverRegion: "eu",
                serverSlug: "stormreaver")
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
            return response.data; // Return the full JSON response
        }
        catch (error) {
            console.error("Error fetching guilds data:", error instanceof Error ? error.message : error);
            throw error;
        }
    }
    function filterGuildProgressData(responseData) {
        const result = [];
        const races = responseData?.data?.progressRaceData?.progressRace ?? [];
        for (const guild of races) {
            const { name, rank, encounters } = guild;
            // Filter encounters with pullCount > 0
            const validEncounters = encounters.filter((e) => e.pullCount > 0 && guild.rank < 10);
            // Get the last one
            const lastEncounter = validEncounters.pop();
            if (lastEncounter) {
                result.push({
                    name,
                    rank,
                    encounterName: lastEncounter.shortName || lastEncounter.name,
                    bestPercent: lastEncounter.bestPercent,
                    pulls: lastEncounter.pullCount,
                });
            }
        }
        return result;
    }
    const accessToken = await getAccessToken();
    const data = await get_guilds_data(accessToken);
    const filtered = filterGuildProgressData(data);
    /* console.log(filtered); */
    const changedResults = await compareWithFile(filtered);
    /* console.log(changedResults); */
    return changedResults;
}
