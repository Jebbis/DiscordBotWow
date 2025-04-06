import { Message, Client } from "discord.js";
import type { CommandKit } from "commandkit";

export default function (
  message: Message<true>,
  client: Client<true>,
  handler: CommandKit
) {
  if (message.content.startsWith("!hey")) {
    message.reply("Hi!");
  }
}
