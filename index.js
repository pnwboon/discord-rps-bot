// index.js

// ต้องเพิ่มบรรทัดนี้ไว้บนสุดของไฟล์เสมอ เพื่อโหลดตัวแปรสภาพแวดล้อม
require('dotenv').config();

const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');
// ไม่ต้อง require('./config.json') อีกต่อไป

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // ตรวจสอบว่าได้เปิด Intent นี้ใน Developer Portal ด้วย!
        GatewayIntentBits.GuildMembers,   // ตรวจสอบว่าได้เปิด Intent นี้ใน Developer Portal ด้วย!
    ],
});

client.commands = new Collection();

const path = require('node:path');
const fs = require('node:fs');

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

client.once(Events.ClientReady, c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
    // ===>>> เพิ่มบรรทัด console.log ตรงนี้ <<<===
    console.log(`Interaction received: Type=${interaction.type}, CommandName=${interaction.commandName}`);

    if (!interaction.isChatInputCommand()) {
        console.log('Interaction is not a chat input command. Skipping.');
        return;
    }

    // ===>>> เพิ่มบรรทัด console.log ตรงนี้ <<<===
    console.log(`Attempting to find command: ${interaction.commandName}`);

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        // หากเห็นข้อความนี้ แสดงว่าบอทหาไฟล์คำสั่งไม่เจอ หรือชื่อคำสั่งไม่ตรง
        // ===>>> เพิ่มการตอบกลับผู้ใช้เมื่อไม่พบคำสั่ง <<<===
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'ไม่พบคำสั่งนี้! (Bot Error: Command not found in cache)', ephemeral: true });
        } else {
            await interaction.reply({ content: 'ไม่พบคำสั่งนี้! (Bot Error: Command not found in cache)', ephemeral: true });
        }
        return;
    }

    // ===>>> เพิ่มบรรทัด console.log ตรงนี้ <<<===
    console.log(`Executing command: ${interaction.commandName}`);

    try {
        await command.execute(interaction);
    } catch (error) {
        // ===>>> เพิ่มการแสดง Error ใน Console ให้ชัดเจน <<<===
        console.error(`Error executing command ${interaction.commandName}:`, error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'มีข้อผิดพลาดเกิดขึ้นขณะประมวลผลคำสั่งนี้! (Bot Error: Execution failed)', ephemeral: true });
        } else {
            await interaction.reply({ content: 'มีข้อผิดพลาดเกิดขึ้นขณะประมวลผลคำสั่งนี้! (Bot Error: Execution failed)', ephemeral: true });
        }
    }
});

// เข้าสู่ระบบบอทด้วย Token ที่โหลดจาก Environment Variables
client.login(process.env.DISCORD_TOKEN); // ใช้ process.env.KEY_NAME