"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const commandkit_1 = require("commandkit");
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const race_1 = require("./recurring/race");
const node_cron_1 = __importDefault(require("node-cron"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const fs_1 = __importDefault(require("fs"));
require("./keep_alive");
dotenv_1.default.config();
const anthropic = new sdk_1.default({
    apiKey: process.env.ANTHROPIC_API_KEY,
});
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
    ],
});
const DATA_FILE = path_1.default.resolve(process.cwd(), "data/guilds.json");
new commandkit_1.CommandKit({
    client,
    commandsPath: path_1.default.join(__dirname, "commands"),
    eventsPath: path_1.default.join(__dirname, "events"),
    //validationsPath: path.join(__dirname, "validations"),
    //devGuildIds: [process.env.GUILD_ID || ""],
    //devUserIds: ["DEV_USER_ID_1", "DEV_USER_ID_2"],
    //devRoleIds: ["DEV_ROLE_ID_1", "DEV_ROLE_ID_2"],
    //skipBuiltInValidations: true,
    //bulkRegister: true,
});
client.once("ready", async () => {
    const channel = client.channels.cache.get("1310994800727560273");
    node_cron_1.default.schedule("* 15-23 * * *", async () => {
        try {
            console.log("Running scheduled race check (Helsinki time)...");
            const guild_data = await (0, race_1.race)();
            for (const guild of guild_data) {
                const { name, encounterName, bestPercent, pulls, rank } = guild;
                /*
                let message = "";
      
                if (bestPercent === 0) {
                  message = `${name} has just defeated ${encounterName} in just ${pulls} pulls! ${name}'s new rank is now ${rank}`;
                } else {
                  message = `${name} has just got a new best pull ${bestPercent} on ${encounterName}! Total pull count is ${pulls} now.`;
                } */
                const guildsData = JSON.parse(fs_1.default.readFileSync(DATA_FILE, "utf-8"));
                console.log(guildsData);
                const readableMessage = guildsData
                    .map((guild) => {
                    return `
              **${guild.rank}. ${guild.name}**:
              Encounter: ${guild.encounterName}
              Best Percent: ${guild.bestPercent}%
              Pulls: ${guild.pulls}
              ------------------------
            `;
                })
                    .join("\n");
                console.log(readableMessage);
                const msg = await anthropic.messages.create({
                    model: "claude-3-7-sonnet-20250219",
                    max_tokens: 1000,
                    temperature: 1,
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: `Based on the data i provide you can you write a edgy sarcastic meme like tweet about ${name} based on their ranking, pull count, bestpercent and where they are in the raid meaning how many encounters they have killed. Take into account how they are doing compared to other guilds on the same encounterName. Context to use: This is a race and its called Mudleague. If best Percent is 0% that means the guild slained the encouter. If a guild is doing very good its called smurffing. If a guild has a lot of pulls compared to others it referenced as "X guild is in shambles". Mayhem. You can also use words "horror", "madness" if the guild is not doing great. The tone should be sarcastic style, humorous, friendly banter, sometimes dramatic. It should reflect competitive nature of the race. You can use some emojis but not too much(No need to use everytime), maximum of three per tweet. If a guild goes past another guilds best percentage make sure to mention that. The first guild to get Gallywix to 0% will be crowded as the winner of Mudleague. Provide only the tweet and not explanation how it was made. 
                    Raids encounters from start to end:
                      1. Vexie
                      2. Cauldron of Carnage
                      3. Rik Reverb
                      4. Stix Bunkjunker
                      5. Sprocketmonger
                      6. One-Armed Bandit
                      7. Mug'Zee
                      8. Gallywix
                  Data set of all guilds and their progress:
                  ${readableMessage}
                  `,
                                },
                            ],
                        },
                    ],
                });
                let messageTwo = getTextFromContent(msg.content[0]);
                if (messageTwo.startsWith('"') && messageTwo.endsWith('"')) {
                    // Remove the first and last character (the quotes)
                    messageTwo = messageTwo.slice(1, -1);
                }
                const exampleEmbed = new discord_js_1.EmbedBuilder()
                    .setColor(`#ff073a`)
                    .setTitle("Race to Stormreaver first!")
                    .setAuthor({
                    name: "Secret reporter",
                    iconURL: "https://cdn.discordapp.com/emojis/1313933120042434591.webp?size=40",
                })
                    .addFields({
                    name: (0, discord_js_1.bold)(`${name} - Rank ${rank}`),
                    value: messageTwo,
                })
                    .addFields({
                    name: "",
                    value: "",
                })
                    .addFields({
                    name: "Boss",
                    value: encounterName,
                    inline: true,
                }, {
                    name: "Pull count",
                    value: String(pulls),
                    inline: true,
                }, {
                    name: "Best pull",
                    value: bestPercent === 0 ? "Defeated" : `${bestPercent}%`,
                    inline: true,
                });
                await channel.send({ embeds: [exampleEmbed] });
                console.log("message sent");
            }
        }
        catch (error) {
            console.error("Error in cron job:", error);
        }
    }, {
        timezone: "Europe/Helsinki",
    });
    console.log("Bot is ready and cron job is scheduled (Helsinki time).");
});
function getTextFromContent(contentBlock) {
    if (contentBlock && contentBlock.text) {
        return contentBlock.text; // For blocks with a `text` property
    }
    else if (contentBlock && contentBlock.content) {
        return contentBlock.content; // For blocks with a `content` property (or any other fallback)
    }
    return "No text available"; // Fallback if no text property exists
}
client.login(process.env.TOKEN);
