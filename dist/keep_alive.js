"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.get("/", (_req, res) => {
    res.send("Bot is alive!");
});
app.listen(PORT, () => {
    console.log(`Keep-alive server running on port ${PORT}`);
});
