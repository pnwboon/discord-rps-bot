// commands/rps-check.js

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const DATA_FILE = path.join(__dirname, '..', 'data.json');

/**
 * Reads game data from the JSON file.
 * @returns {object} The parsed data or a default structure if an error occurs.
 */
function readData() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        const parsedData = JSON.parse(data);
        // Ensure playerStats exists
        if (!parsedData.playerStats) {
            parsedData.playerStats = {};
        }
        return parsedData;
    } catch (error) {
        if (error.code === 'ENOENT') { // File not found
            console.log('data.json not found for rps-check, returning empty.');
            return { gameResults: [], playerStats: {} };
        }
        console.error('Error reading data.json for rps-check:', error.message);
        return { gameResults: [], playerStats: {} };
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rpscheck')
        .setDescription('ดูสถิติเป่ายิงฉุบของคุณและกระดานผู้นำในที่เดียว!'),

    async execute(interaction) {
        const data = readData();
        const playerStats = data.playerStats || {};
        const userId = interaction.user.id;
        const currentUserStats = playerStats[userId];

        // --- ส่วนของสถิติส่วนตัว ---
        let personalStatsText = '';
        if (currentUserStats && currentUserStats.played > 0) {
            const winRate = ((currentUserStats.wins / currentUserStats.played) * 100).toFixed(2);
            personalStatsText = `**สถิติของคุณ:**\n` +
                                `⚔️ เล่น: \`${currentUserStats.played}\` ครั้ง\n` +
                                `✅ ชนะ: \`${currentUserStats.wins}\` ครั้ง\n` +
                                `❌ แพ้: \`${currentUserStats.losses}\` ครั้ง\n` +
                                `📈 อัตราการชนะ: \`${winRate}%\`\n`;
        } else {
            personalStatsText = 'คุณยังไม่เคยเล่นเป่ายิงฉุบเลยนะ! ลองใช้ `/rps` เพื่อเริ่มเกมแรกของคุณสิ!\n';
        }

        // --- ส่วนของ Leaderboard ---
        const sortedPlayers = Object.values(playerStats)
            .filter(p => p.played > 0) // กรองเฉพาะผู้เล่นที่เคยเล่นแล้ว
            .sort((a, b) => b.wins - a.wins || b.played - a.played); // เรียงตามชนะมากสุด, ถ้าชนะเท่ากันเรียงตามจำนวนเล่น

        const topPlayers = sortedPlayers.slice(0, 10); // เอาแค่ 10 อันดับแรก

        let leaderboardText = '\n**🏆 กระดานผู้นำเป่ายิงฉุบยอดฝีมือ! 🏆**\n';
        if (topPlayers.length === 0) {
            leaderboardText += 'ยังไม่มีข้อมูลกระดานผู้นำ! เริ่มเล่นเป่ายิงฉุบเพื่อเป็นคนแรกสิ!';
        } else {
            for (let i = 0; i < topPlayers.length; i++) {
                const player = topPlayers[i];
                leaderboardText += `**${i + 1}. ${player.username}** - ชนะ: \`${player.wins}\` | เล่น: \`${player.played}\`\n`;
            }
        }

        // --- สร้าง Embed เดียวกัน ---
        const combinedEmbed = new EmbedBuilder()
            .setColor(0x8B008B) // สีม่วงเข้ม เพื่อความแตกต่าง
            .setTitle('✨ สถิติเป่ายิงฉุบและกระดานผู้นำ ✨')
            .setDescription(personalStatsText + '\n' + leaderboardText) // รวมข้อความสถิติส่วนตัวและ leaderboard
            .setThumbnail(interaction.user.displayAvatarURL()) // ใช้รูปโปรไฟล์ของผู้ใช้ที่เรียกคำสั่ง
            .setTimestamp()
            .setFooter({ text: 'มาเล่นกันเยอะๆ นะ!', iconURL: interaction.client.user.displayAvatarURL() });

        await interaction.reply({ embeds: [combinedEmbed] });
    },
};