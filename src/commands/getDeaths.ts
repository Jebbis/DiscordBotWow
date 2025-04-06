import { CommandData, CommandOptions, SlashCommandProps } from "commandkit";
import axios from "axios";
import { ApplicationCommandOptionType } from "discord.js";

export const data: CommandData = {
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
      type: ApplicationCommandOptionType.Integer,
      required: true,
    },
  ],
};

export async function run({ interaction, client, handler }: SlashCommandProps) {
  //const reportId = interaction.options.get("report-id")?.value as string;
  const guildId = interaction.options.get("guild-id")?.value as string;
  const reportDifficulty = interaction.options.get("difficulty")?.value;
  const reportIgnoreDeathsAfter = interaction.options.get("ignore-deaths-after")
    ?.value as number;
  const difficulty = 5; // 5 = Mythic
  const timeFrame: number = 3000;
  const deathsWithInTimeFrame: number = 4;

  interface Encounter {
    id: string;
    killedAtTimestamp: number;
  }

  interface FirstKillTimestamps {
    [encounterId: string]: number;
  }

  interface ReportID {
    startTime: number;
    fights: Array<{
      id: number;
      name: string;
      encounterID: number;
    }>;
  }

  interface Fight {
    encounterID: number; // Or string, depending on the data type of `encounterID`
    name: string;
    id: number;
    // Add other fields that are in the fight object as needed
  }

  interface DeathEvent {
    deathTime: number;
    name: string;
  }

  interface LogData {
    composition: Array<{ name: string }>;
    deathEvents: DeathEvent[];
  }

  interface Fight {
    encounterID: number;
  }

  interface Report {
    code: string;
    fights: Fight[];
  }

  interface ReportData {
    reports: {
      data: Report[];
    };
  }

  async function getAccessToken(): Promise<string> {
    const tokenUri = "https://www.warcraftlogs.com/oauth/token";

    try {
      const response = await axios.post(
        tokenUri,
        new URLSearchParams({ grant_type: "client_credentials" }), // Form data
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          auth: {
            username: process.env.WLOGS_CLIENT_ID || "",
            password: process.env.WLOGS_CLIENT_SECRET || "", // Basic HTTP auth
          },
        }
      );

      console.log("got token");
      return response.data.access_token as string; // Access token
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error(
          "Error fetching access token:",
          error.response?.data || error.message
        );
      } else {
        console.error(
          "An unexpected error occurred:",
          (error as Error).message
        );
      }
      throw new Error("Failed to obtain access token");
    }
  }

  async function fetchFirstKillTimestamps(
    accessToken: string
  ): Promise<FirstKillTimestamps> {
    const graphqlApiUrl = "https://www.warcraftlogs.com/api/v2/client";
    const query = `
      query {
        progressRaceData {
          progressRace(guildID: ${guildId})
        }
      }
    `;

    try {
      const response = await axios.post(
        graphqlApiUrl,
        { query },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const encounters: Encounter[] =
        response.data.data.progressRaceData.progressRace[0].encounters;

      const firstKillTimestamps: FirstKillTimestamps = {};
      for (const encounter of encounters) {
        firstKillTimestamps[encounter.id] = encounter.killedAtTimestamp;
      }

      console.log(firstKillTimestamps);
      return firstKillTimestamps;
    } catch (error: unknown) {
      console.error(
        "Error fetching first kill timestamps:",
        error instanceof Error ? error.message : error
      );
      throw error;
    }
  }

  async function fetchGuildsReports(accessToken: string): Promise<string[]> {
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
      const response = await axios.post(
        graphqlApiUrl,
        { query }, // GraphQL query as the request body
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`, // Bearer token for auth
          },
        }
      );

      const ReportsWithMythicFights =
        response.data.data.reportData.reports.data;

      console.log(response.data.data.reportData.reports);

      // Select only fights with mythic fights
      const filteredData = ReportsWithMythicFights.filter(
        (record: Report) => record.fights && record.fights.length > 0
      ) // Specify type here
        .map((record: Report) => record.code); // Specify type here

      console.log(filteredData);

      return filteredData;
    } catch (error: any) {
      console.error(
        "Error fetching report data:",
        error.response?.data || error.message
      );
      throw new Error("Failed to fetch report data");
    }
  }

  async function fetchReportIDs(
    accessToken: string,
    reportCode: string,
    firstKillTimestamps: FirstKillTimestamps
  ): Promise<ReportID> {
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
      const response = await axios.post(
        graphqlApiUrl,
        { query },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const { startTime, fights } = response.data.data.reportData.report;

      const filteredFights = fights.filter((fight: Fight) => {
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
    } catch (error: unknown) {
      console.error(
        "Error fetching report data:",
        error instanceof Error ? error.message : error
      );
      throw new Error("Failed to fetch report data");
    }
  }

  async function fetchReportDeaths(
    accessToken: string,
    reportCode: string,
    reportIDs: ReportID
  ): Promise<
    Record<string, Array<{ name: string; deaths: number; total: number }>>
  > {
    const graphqlApiUrl = "https://www.warcraftlogs.com/api/v2/client";
    const groupedStats: Record<
      string,
      Record<string, { deaths: number; total: number }>
    > = {};

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
        const response = await axios.post(
          graphqlApiUrl,
          { query },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const logData: LogData = {
          composition:
            response.data.data.reportData.report.table.data.composition,
          deathEvents:
            response.data.data.reportData.report.table.data.deathEvents,
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
      } catch (error: unknown) {
        console.error(
          "Error fetching report data:",
          error instanceof Error ? error.message : error
        );
        throw new Error("Failed to fetch report data");
      }
    }

    // Convert groupedStats into the desired format
    const formattedOutput: Record<
      string,
      Array<{ name: string; deaths: number; total: number }>
    > = {};

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

  function getFilteredDeathEvents(deathEvents: DeathEvent[]): DeathEvent[] {
    const result: DeathEvent[] = [];
    let deathsCount = 0;

    for (let i = 0; i < deathEvents.length; i++) {
      if (deathsCount >= reportIgnoreDeathsAfter) break;

      const currentDeath = deathEvents[i];
      const overlappingDeaths = deathEvents.filter(
        (event) =>
          //Time in milliseconds that is determined to be the aikaikkuna
          event.deathTime <= currentDeath.deathTime + timeFrame
      );

      //This indicates how many player has to die with in the aikaikkuna
      if (overlappingDeaths.length >= deathsWithInTimeFrame) {
        continue;
      }

      result.push(currentDeath);
      deathsCount++;
    }

    return result;
  }

  async function processReports(
    guildsReports: string[],
    accessToken: string
  ): Promise<void> {
    const allDeathsByFight: Record<
      string,
      { name: string; deaths: number; total: number }[]
    > = {};

    const playerSummaries: Record<string, { deaths: number; total: number }> =
      {};
    console.log("processReports");

    for (const reportCode of guildsReports) {
      try {
        // Fetch fight data for the report
        const reportData: ReportID = await fetchReportIDs(
          accessToken,
          reportCode,
          firstKillTimestamps
        );

        // Fetch deaths grouped by encounter
        const reportDeaths = await fetchReportDeaths(
          accessToken,
          reportCode,
          reportData
        );

        // Merge the reportDeaths data into the main collection
        for (const [encounterName, players] of Object.entries(reportDeaths)) {
          if (!allDeathsByFight[encounterName]) {
            allDeathsByFight[encounterName] = [];
          }

          for (const player of players) {
            // Update or add player death stats per encounter
            const existingPlayer = allDeathsByFight[encounterName].find(
              (p) => p.name === player.name
            );

            if (existingPlayer) {
              existingPlayer.deaths += player.deaths;
              existingPlayer.total += player.total;
            } else {
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
      } catch (error: any) {
        console.error(
          `Error processing report code ${reportCode}:`,
          error.message
        );
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
        return `${playerName} - Deaths: ${deaths}, Pulls: ${total} - ${percentage.toFixed(
          1
        )}%`;
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
      `Settings:\n- Ignore events after deaths: ${reportIgnoreDeathsAfter}\n- If ${deathsWithInTimeFrame} or more players die within ${
        timeFrame / 1000
      } seconds of players death the death is not counted`,
    ].join("\n\n");

    const fullReport = [
      `Tonttu lista for a guild: ${guildId}`,
      "**Player specific summary:**",
      playerSpecificSummaries,
      "\n**Detailed Reports:**",
      detailedReport,
      `Settings:\n- Ignore events after deaths: ${reportIgnoreDeathsAfter}\n- If ${deathsWithInTimeFrame} or more players die within ${
        timeFrame / 1000
      } seconds of players death the death is not counted`,
    ].join("\n\n");

    console.log(fullReport);
    await interaction.followUp(formattedReport);
  }

  interaction.reply(
    `Starting to collect tonttu lista for Guild ID: ${guildId}`
  );
  const accessToken: string = await getAccessToken();
  const firstKillTimestamps = await fetchFirstKillTimestamps(accessToken);
  const guildsReports = await fetchGuildsReports(accessToken);
  await processReports(guildsReports, accessToken);
}

export const options: CommandOptions = {
  deleted: false,
};
