import mongoose from "mongoose";

const guildProgressSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    rank: { type: Number, required: true },
    encounterName: { type: String, required: true },
    bestPercent: { type: Number, required: true },
  },
  {
    collection: "guilds", // <-- exact name in MongoDB
  }
);

export default mongoose.model("GuildData", guildProgressSchema);
