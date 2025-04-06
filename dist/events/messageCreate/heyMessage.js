"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
function default_1(message, client, handler) {
    if (message.content.startsWith("!hey")) {
        message.reply("Hi!");
    }
}
