"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const axios_1 = __importDefault(require("axios"));
const discord_js_1 = require("discord.js");
exports.data = {
    name: "tonttu",
    description: "Get tonttut",
    options: [
        {
            name: "guild-id",
            description: "Warcarftlogs guild id.",
            type: 3,
            required: true,
        },
        {
            name: "difficulty",
            description: "Encounter difficulty",
            type: 3,
            choices: [
                { name: "Mythic", value: "5" } /* ,
                      { name: "Heroic", value: "Heroic" },
                      { name: "Normal", value: "Ranged Dps" }, */,
            ],
            required: true,
        },
        {
            name: "ignore-deaths-after",
            description: "Ignore events after X deaths",
            type: discord_js_1.ApplicationCommandOptionType.Integer,
            required: true,
        },
    ],
};
async function run({ interaction, client, handler }) {
    //const reportId = interaction.options.get("report-id")?.value as string;
    const guildId = interaction.options.get("guild-id")?.value;
    const reportDifficulty = interaction.options.get("difficulty")?.value;
    const reportIgnoreDeathsAfter = interaction.options.get("ignore-deaths-after")
        ?.value;
    const difficulty = 5; // 5 = Mythic
    const timeFrame = 3000;
    const deathsWithInTimeFrame = 4;
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
    async function fetchFirstKillTimestamps(accessToken) {
        const graphqlApiUrl = "https://www.warcraftlogs.com/api/v2/client";
        const query = `
      query {
        progressRaceData {
          progressRace(guildID: ${guildId})
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
            const encounters = response.data.data.progressRaceData.progressRace[0].encounters;
            const firstKillTimestamps = {};
            for (const encounter of encounters) {
                firstKillTimestamps[encounter.id] = encounter.killedAtTimestamp;
            }
            console.log(firstKillTimestamps);
            return firstKillTimestamps;
        }
        catch (error) {
            console.error("Error fetching first kill timestamps:", error instanceof Error ? error.message : error);
            throw error;
        }
    }
    async function fetchGuildsReports(accessToken) {
        const graphqlApiUrl = "https://www.warcraftlogs.com/api/v2/client";
        // GraphQL query to fetch the report
        const query = `
      query {
        reportData {
          reports(guildID: ${guildId}, zoneID: 42) {
            data {
              code
              fights(difficulty: ${difficulty}) {
                encounterID
              }
            }
          }
        }
      }
    `;
        try {
            const response = await axios_1.default.post(graphqlApiUrl, { query }, // GraphQL query as the request body
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`, // Bearer token for auth
                },
            });
            const ReportsWithMythicFights = response.data.data.reportData.reports.data;
            console.log(response.data.data.reportData.reports);
            // Select only fights with mythic fights
            const filteredData = ReportsWithMythicFights.filter((record) => record.fights && record.fights.length > 0) // Specify type here
                .map((record) => record.code); // Specify type here
            console.log(filteredData);
            return filteredData;
        }
        catch (error) {
            console.error("Error fetching report data:", error.response?.data || error.message);
            throw new Error("Failed to fetch report data");
        }
    }
    async function fetchReportIDs(accessToken, reportCode, firstKillTimestamps) {
        const graphqlApiUrl = "https://www.warcraftlogs.com/api/v2/client";
        //add , fightIDs: [37] to fights to help testing for only 1 fight
        const query = `
      query {
        reportData {
          report(code: "${reportCode}") {
            startTime
            fights(difficulty:${reportDifficulty}) {
              id
              name
              encounterID
            }
          }
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
            const { startTime, fights } = response.data.data.reportData.report;
            const filteredFights = fights.filter((fight) => {
                const firstKillTime = firstKillTimestamps[fight.encounterID];
                // If firstKillTime is null, include all fights for that encounter
                if (firstKillTime === null) {
                    return true;
                }
                return firstKillTime && firstKillTime >= startTime;
            });
            console.log(`Log id: ${reportCode}`);
            console.log("Filtered proge fights", {
                startTime,
                fights: filteredFights,
            });
            return { startTime, fights: filteredFights };
        }
        catch (error) {
            console.error("Error fetching report data:", error instanceof Error ? error.message : error);
            throw new Error("Failed to fetch report data");
        }
    }
    async function fetchReportDeaths(accessToken, reportCode, reportIDs) {
        const graphqlApiUrl = "https://www.warcraftlogs.com/api/v2/client";
        const groupedStats = {};
        for (const fight of reportIDs.fights) {
            const query = `
        query {
          reportData {
            report(code: "${reportCode}") {
              table(fightIDs: ${fight.id}) 
            }
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
                const logData = {
                    composition: response.data.data.reportData.report.table.data.composition,
                    deathEvents: response.data.data.reportData.report.table.data.deathEvents,
                };
                const filteredDeaths = getFilteredDeathEvents(logData.deathEvents);
                if (!groupedStats[fight.name]) {
                    groupedStats[fight.name] = {};
                }
                for (const player of logData.composition) {
                    if (!groupedStats[fight.name][player.name]) {
                        groupedStats[fight.name][player.name] = { deaths: 0, total: 0 };
                    }
                    groupedStats[fight.name][player.name].total++;
                }
                for (const death of filteredDeaths) {
                    if (groupedStats[fight.name][death.name]) {
                        groupedStats[fight.name][death.name].deaths++;
                    }
                }
            }
            catch (error) {
                console.error("Error fetching report data:", error instanceof Error ? error.message : error);
                throw new Error("Failed to fetch report data");
            }
        }
        // Convert groupedStats into the desired format
        const formattedOutput = {};
        for (const [encounter, stats] of Object.entries(groupedStats)) {
            formattedOutput[encounter] = Object.entries(stats)
                .sort(([, a], [, b]) => b.deaths - a.deaths)
                .map(([name, { deaths, total }]) => ({
                name,
                deaths,
                total,
            }));
        }
        console.log(formattedOutput);
        return formattedOutput;
    }
    function getFilteredDeathEvents(deathEvents) {
        const result = [];
        let deathsCount = 0;
        for (let i = 0; i < deathEvents.length; i++) {
            if (deathsCount >= reportIgnoreDeathsAfter)
                break;
            const currentDeath = deathEvents[i];
            const overlappingDeaths = deathEvents.filter((event) => 
            //Time in milliseconds that is determined to be the aikaikkuna
            event.deathTime <= currentDeath.deathTime + timeFrame);
            //This indicates how many player has to die with in the aikaikkuna
            if (overlappingDeaths.length >= deathsWithInTimeFrame) {
                continue;
            }
            result.push(currentDeath);
            deathsCount++;
        }
        return result;
    }
    async function processReports(guildsReports, accessToken) {
        const allDeathsByFight = {};
        const playerSummaries = {};
        console.log("processReports");
        for (const reportCode of guildsReports) {
            try {
                // Fetch fight data for the report
                const reportData = await fetchReportIDs(accessToken, reportCode, firstKillTimestamps);
                // Fetch deaths grouped by encounter
                const reportDeaths = await fetchReportDeaths(accessToken, reportCode, reportData);
                // Merge the reportDeaths data into the main collection
                for (const [encounterName, players] of Object.entries(reportDeaths)) {
                    if (!allDeathsByFight[encounterName]) {
                        allDeathsByFight[encounterName] = [];
                    }
                    for (const player of players) {
                        // Update or add player death stats per encounter
                        const existingPlayer = allDeathsByFight[encounterName].find((p) => p.name === player.name);
                        if (existingPlayer) {
                            existingPlayer.deaths += player.deaths;
                            existingPlayer.total += player.total;
                        }
                        else {
                            allDeathsByFight[encounterName].push({ ...player });
                        }
                        // Update player summary stats across all encounters
                        if (!playerSummaries[player.name]) {
                            playerSummaries[player.name] = { deaths: 0, total: 0 };
                        }
                        playerSummaries[player.name].deaths += player.deaths;
                        playerSummaries[player.name].total += player.total;
                    }
                }
            }
            catch (error) {
                console.error(`Error processing report code ${reportCode}:`, error.message);
            }
        }
        // Sort each fight's players by deaths in descending order
        for (const encounterName in allDeathsByFight) {
            allDeathsByFight[encounterName].sort((a, b) => b.deaths - a.deaths);
        }
        // Generate player-specific summary sorted by percentage
        const playerSpecificSummaries = Object.entries(playerSummaries)
            .map(([playerName, { deaths, total }]) => {
            const percentage = ((deaths / total) * 100).toFixed(1); // Calculate percentage with 1 decimal
            return {
                playerName,
                deaths,
                total,
                percentage: parseFloat(percentage), // Convert percentage to a number for sorting
            };
        })
            .sort((a, b) => b.percentage - a.percentage) // Sort by percentage in descending order
            .map(({ playerName, deaths, total, percentage }) => {
            return `${playerName} - Deaths: ${deaths}, Pulls: ${total} - ${percentage.toFixed(1)}%`;
        })
            .join("\n");
        // Format detailed player stats
        const detailedReport = Object.entries(allDeathsByFight)
            .map(([encounterName, players]) => {
            const playersList = players
                .map(({ name, deaths, total }) => {
                const percentage = ((deaths / total) * 100).toFixed(1); // Calculate percentage
                return `${name} - Deaths: ${deaths} - Total: ${total} - ${percentage}%`;
            })
                .join("\n");
            return `**${encounterName}:**\n${playersList}`;
        })
            .join("\n\n");
        // Combine player-specific summary and detailed report
        const formattedReport = [
            `Tonttu lista for a guild: ${guildId}`,
            "**Player specific summary:**",
            playerSpecificSummaries,
            `Settings:\n- Ignore events after deaths: ${reportIgnoreDeathsAfter}\n- If ${deathsWithInTimeFrame} or more players die within ${timeFrame / 1000} seconds of players death the death is not counted`,
        ].join("\n\n");
        const fullReport = [
            `Tonttu lista for a guild: ${guildId}`,
            "**Player specific summary:**",
            playerSpecificSummaries,
            "\n**Detailed Reports:**",
            detailedReport,
            `Settings:\n- Ignore events after deaths: ${reportIgnoreDeathsAfter}\n- If ${deathsWithInTimeFrame} or more players die within ${timeFrame / 1000} seconds of players death the death is not counted`,
        ].join("\n\n");
        console.log(fullReport);
        await interaction.followUp(formattedReport);
    }
    interaction.reply(`Starting to collect tonttu lista for Guild ID: ${guildId}`);
    const accessToken = await getAccessToken();
    const firstKillTimestamps = await fetchFirstKillTimestamps(accessToken);
    const guildsReports = await fetchGuildsReports(accessToken);
    await processReports(guildsReports, accessToken);
}
exports.options = {
    deleted: false,
};
