"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const guildProgressSchema = new mongoose_1.default.Schema({
    name: { type: String, required: true },
    rank: { type: Number, required: true },
    encounterName: { type: String, required: true },
    bestPercent: { type: Number, required: true },
}, {
    collection: "guilds", // <-- exact name in MongoDB
});
exports.default = mongoose_1.default.model("GuildData", guildProgressSchema);
