// commands/ping.js

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping') // ชื่อคำสั่ง
        .setDescription('Replies with Pong!'), // คำอธิบายคำสั่ง
    async execute(interaction) {
        await interaction.reply('Pong!!'); // ตอบกลับเมื่อคำสั่งถูกเรียกใช้
    },
};