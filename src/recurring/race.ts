import axios from "axios";
import * as dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";

dotenv.config();

type FilteredProgress = {
  name: string;
  rank: number;
  encounterName: string;
  bestPercent: number;
  pulls: number;
};

const DATA_FILE = path.resolve(process.cwd(), "data/guilds.json");

async function saveDataToFile(data: FilteredProgress[]): Promise<void> {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

async function loadDataFromFile(): Promise<FilteredProgress[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn(
      "No previous data found or error reading file, returning empty array."
    );
    return [];
  }
}

async function compareWithFile(
  newData: FilteredProgress[]
): Promise<FilteredProgress[]> {
  const previousData = await loadDataFromFile();
  const changed: FilteredProgress[] = [];

  for (const guild of newData) {
    const match = previousData.find(
      (prev) =>
        prev.name === guild.name && prev.encounterName === guild.encounterName
    );

    if (!match || match.bestPercent !== guild.bestPercent) {
      changed.push(guild);
    }
  }

  await saveDataToFile(newData);
  return changed;
}

export async function race(): Promise<any> {
  async function getAccessToken(): Promise<string> {
    const tokenUri = "https://www.warcraftlogs.com/oauth/token";

    try {
      const response = await axios.post(
        tokenUri,
        new URLSearchParams({ grant_type: "client_credentials" }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          auth: {
            username: process.env.WLOGS_CLIENT_ID || "",
            password: process.env.WLOGS_CLIENT_SECRET || "",
          },
        }
      );

      console.log("got token");
      return response.data.access_token as string;
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

  async function get_guilds_data(accessToken: string): Promise<any> {
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

      return response.data; // Return the full JSON response
    } catch (error: unknown) {
      console.error(
        "Error fetching guilds data:",
        error instanceof Error ? error.message : error
      );
      throw error;
    }
  }

  async function get_pescorus_data(accessToken: string): Promise<any> {
    const graphqlApiUrl = "https://www.warcraftlogs.com/api/v2/client";

    const query = `
    query {
      progressRaceData {
        progressRace (
          serverRegion: "eu",
          serverSlug: "kazzak",
          guildID:238024)
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

      return response.data; // Return the full JSON response
    } catch (error: unknown) {
      console.error(
        "Error fetching guilds data:",
        error instanceof Error ? error.message : error
      );
      throw error;
    }
  }

  function filterGuildProgressData(responseData: any): FilteredProgress[] {
    const result: FilteredProgress[] = [];

    const races = responseData?.data?.progressRaceData?.progressRace ?? [];

    for (const guild of races) {
      const { name, rank, encounters } = guild;

      // Filter encounters with pullCount > 0
      const validEncounters = encounters.filter(
        (e: { pullCount: number }) =>
          e.pullCount > 0 && (rank < 11 || name === "Pescorus")
      );

      // Get the last one
      const lastEncounter = validEncounters.pop();

      if (lastEncounter) {
        result.push({
          name,
          rank: rank ?? 0,
          encounterName: lastEncounter.shortName || lastEncounter.name,
          bestPercent: lastEncounter.bestPercent,
          pulls: lastEncounter.pullCount,
        });
      }
    }

    return result;
  }

  const accessToken: string = await getAccessToken();
  const data = await get_guilds_data(accessToken);
  const pescorus_data = await get_pescorus_data(accessToken);
  data.data.progressRaceData.progressRace.push(
    pescorus_data.data.progressRaceData.progressRace[0]
  );
  const filtered = filterGuildProgressData(data);
  console.log(filtered);
  const changedResults = await compareWithFile(filtered);
  /* console.log(changedResults); */
  return changedResults;
}
