// deploy-commands.js

require('dotenv').config();

const { REST, Routes } = require('discord.js');
// guildId จะไม่ถูกใช้ในโหมด Global deploy อีกต่อไป
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
// const guildId = process.env.DISCORD_GUILD_ID; // ลบบรรทัดนี้หรือคอมเมนต์ทิ้ง

const commands = [];
const path = require('node:path');
const fs = require('node:fs');

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

const rest = new REST().setToken(token);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands globally.`);

        // *** บรรทัดนี้คือส่วนที่สำคัญที่สุดที่ต้องเปลี่ยน ***
        // เปลี่ยนจาก Routes.applicationGuildCommands(clientId, guildId)
        // เป็น Routes.applicationCommands(clientId) เพื่อ deploy ทั่วโลก
        const data = await rest.put(
            Routes.applicationCommands(clientId), // *** ใช้บรรทัดนี้สำหรับ Global Commands ***
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands globally.`);
    } catch (error) {
        console.error(error);
    }
})();