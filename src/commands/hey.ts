import { CommandData, CommandOptions, SlashCommandProps } from "commandkit";
import axios from "axios";

export const data: CommandData = {
  name: "hey",
  description: "Reply with hey",
};

export async function run({ interaction, client, handler }: SlashCommandProps) {
  interaction.reply("Hey!");

  const graphqlApiUrl = "https://www.warcraftlogs.com/api/v2/client";

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

      console.log(response.data);
    } catch (error) {
      console.log(`Error fetching data: ${error}`);
    }
  }

  const accessToken = await getAccessToken();
  await getAPILimit();
}

export const options: CommandOptions = {
  deleted: false,
};
