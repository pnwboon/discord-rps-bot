// commands/rps.js

const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Constants for file paths and game timeouts
const DATA_FILE = path.join(__dirname, '..', 'data.json');
const GAME_TIMEOUT_MS = 60_000; // 60 seconds for join/choice

// Map to store active game states. Key: publicMessageId
const activeGames = new Map(); // Key: publicMessageId, Value: { game_object }
const userActiveGames = new Map(); // Key: userId, Value: publicMessageId (สำหรับเช็คว่า user กำลังอยู่ในเกมไหน)

// --- Helper Functions ---

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
            console.log('data.json not found, creating new one.');
            return { gameResults: [], playerStats: {} };
        }
        console.error('Error reading data.json:', error.message);
        return { gameResults: [], playerStats: {} }; // Return a default empty structure
    }
}

/**
 * Writes game data to the JSON file.
 * @param {object} data The data object to write.
 */
function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 4), 'utf8');
    } catch (error) {
        console.error('Error writing data.json:', error.message);
    }
}

/**
 * Cleans up a game from activeMaps
 * @param {string} publicMessageId The ID of the public message associated with the game.
 * @param {string} challengerId The ID of the challenger.
 * @param {string} opponentId The ID of the opponent (optional).
 */
function cleanupGame(publicMessageId, challengerId, opponentId = null) {
    activeGames.delete(publicMessageId);
    userActiveGames.delete(challengerId);
    if (opponentId) {
        userActiveGames.delete(opponentId);
    }
}

/**
 * Updates player statistics after a game.
 * @param {string} userId The ID of the player.
 * @param {string} username The username of the player.
 * @param {boolean} isWinner True if the player won, false if lost.
 */
function updatePlayerStats(userId, username, isWinner) {
    const data = readData();
    if (!data.playerStats[userId]) {
        data.playerStats[userId] = {
            username: username,
            played: 0,
            wins: 0,
            losses: 0
        };
    }

    data.playerStats[userId].played++;
    data.playerStats[userId].username = username; // Update username in case it changed

    if (isWinner) {
        data.playerStats[userId].wins++;
    } else {
        data.playerStats[userId].losses++;
    }
    writeData(data);
}


// --- Main Command Logic ---

module.exports = {
    // Define the slash command
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('เริ่มต้นเกมเป่ายิงฉุบสุดมันส์! ใครก็มาร่วมท้าดวลได้เลย!'),

    /**
     * Executes the RPS command.
     * @param {Interaction} interaction The interaction object.
     */
    async execute(interaction) {
        const challenger = interaction.user; // The user who initiated the command (Player 1)

        // Check if the challenger is already in another game
        if (userActiveGames.has(challenger.id)) {
            return interaction.reply({
                content: 'ดูเหมือนคุณกำลังเล่นเป่ายิงฉุบกับคนอื่นอยู่แล้วนะ! รอให้เกมนั้นจบก่อนนะ.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Create "Join Game" and "Cancel Game" buttons
        const joinGameButton = new ButtonBuilder()
            .setCustomId(`rps_join_${challenger.id}`)
            .setLabel('🎮 เข้าร่วมดวล!')
            .setStyle(ButtonStyle.Primary);

        const cancelGameButton = new ButtonBuilder()
            .setCustomId(`rps_cancel_${challenger.id}`)
            .setLabel('🚫 ยกเลิกเกม')
            .setStyle(ButtonStyle.Danger);

        const actionRow = new ActionRowBuilder().addComponents(joinGameButton, cancelGameButton);

        // --- Initial Public Challenge Embed ---
        const initialEmbed = new EmbedBuilder()
            .setColor(0xFFA500) // สีส้มทอง เพื่อความสดใส
            .setTitle('✨ ขอเชิญมาร่วมดวลเป่ายิงฉุบ! ✨')
            .setDescription(`ผู้กล้าหาญ **${challenger.username}** กำลังประกาศหาคู่ท้าดวลในตำนาน!`)
            .addFields(
                { name: '🤔 จะเข้าร่วมได้อย่างไร?', value: 'เพียงแค่กดปุ่ม **"🎮 เข้าร่วมดวล!"** ด้านล่างนี้ คุณก็จะได้เข้าร่วมเกมทันที!', inline: false },
                { name: '⏳ เวลาจำกัด', value: `เกมนี้จะเปิดรับสมัครคู่ท้าดวลเป็นเวลา **${GAME_TIMEOUT_MS / 1000} วินาที**`, inline: false }
            )
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/3221/3221087.png') // ไอคอนเป่ายิงฉุบ
            .setTimestamp() // แสดงเวลาปัจจุบันที่ข้อความถูกสร้าง
            .setFooter({ text: `ผู้ท้าดวล: ${challenger.username}`, iconURL: challenger.displayAvatarURL() });

        await interaction.reply({
            embeds: [initialEmbed],
            components: [actionRow],
        });
        const publicMessage = await interaction.fetchReply(); // fetchReply() เป็น method ที่เรียกใช้แยก

        // Store initial game state in activeGames map
        const gameData = {
            challengerId: challenger.id,
            opponentId: null, // No opponent yet
            challengerChoice: null,
            opponentChoice: null,
            channelId: interaction.channelId,
            publicMessageId: publicMessage.id,
            challengerInteraction: interaction, // Store original interaction for followUp
            opponentInteraction: null, // Will store opponent's interaction later
            timestamp: Date.now() // For timeout tracking
        };
        activeGames.set(publicMessage.id, gameData);
        userActiveGames.set(challenger.id, publicMessage.id); // บันทึกว่า challenger กำลังเล่นเกมนี้

        // --- Collector for "Join Game" and "Cancel Game" buttons ---
        const joinCollector = publicMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: i => i.customId.startsWith('rps_join_') || i.customId.startsWith('rps_cancel_'),
            time: GAME_TIMEOUT_MS,
            max: 1 // Only one successful join or cancel is needed
        });

        joinCollector.on('collect', async i => {
            joinCollector.stop(); // Stop this collector immediately after a button is pressed

            const game = activeGames.get(publicMessage.id);
            if (!game) {
                const expiredEmbed = new EmbedBuilder()
                    .setColor(0x808080) // สีเทา
                    .setTitle('🕒 เกมนี้หมดอายุแล้ว!')
                    .setDescription('การท้าดวลเป่ายิงฉุบนี้ได้สิ้นสุดลงแล้ว หรือถูกยกเลิกไปแล้วค่ะ.')
                    .setTimestamp();
                return i.update({
                    embeds: [expiredEmbed],
                    components: []
                }).catch(() => {});
            }

            if (i.customId.startsWith('rps_join_')) {
                const opponent = i.user; // The user who pressed the join button (Player 2)

                // Prevent challenger from joining their own game
                if (opponent.id === challenger.id) {
                    await i.reply({
                        content: 'คุณจะเข้าร่วมเกมของตัวเองไม่ได้นะ! ต้องรอให้คนอื่นมาร่วมเล่นด้วย.',
                        flags: MessageFlags.Ephemeral
                    });
                    // Re-start the join collector as this interaction was invalid
                    startJoinCollector(publicMessage, challenger);
                    return;
                }
                // Prevent opponent from joining if already in another game
                if (userActiveGames.has(opponent.id)) { // ใช้ userActiveGames เพื่อเช็ค
                    await i.reply({
                        content: 'คุณกำลังอยู่ในเกมเป่ายิงฉุบอื่นอยู่! รอให้เกมนั้นจบก่อนนะ.',
                        flags: MessageFlags.Ephemeral
                    });
                    // Re-start the join collector as this interaction was invalid
                    startJoinCollector(publicMessage, challenger);
                    return;
                }

                // Update game state with opponent's info
                game.opponentId = opponent.id;
                game.opponentInteraction = i; // Store opponent's interaction for ephemeral replies
                userActiveGames.set(opponent.id, publicMessage.id); // บันทึกว่า opponent กำลังเล่นเกมนี้

                // --- Update Public Message to Game Started Embed ---
                const gameStartedEmbed = new EmbedBuilder()
                    .setColor(0x00BFFF) // สีฟ้าสดใส
                    .setTitle('🤝 การดวลเริ่มต้นขึ้นแล้ว! 🤝')
                    .setDescription(`ผู้ท้าดวล **${challenger.username}** ได้จับคู่กับ **${opponent.username}** เรียบร้อยแล้ว!\n\nเตรียมตัวเลือกท่าไม้ตายของคุณได้เลย!`)
                    .setThumbnail('https://cdn-icons-png.flaticon.com/512/11096/11096898.png') // ไอคอนต่อสู้
                    .setTimestamp()
                    .setFooter({ text: 'ขอให้โชคดีทั้งสองฝ่าย!', iconURL: interaction.client.user.displayAvatarURL() });

                await i.update({
                    embeds: [gameStartedEmbed],
                    components: [] // Remove join/cancel buttons
                });

                // Create Rock/Paper/Scissors choice buttons
                const choiceButtonsRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('choice_rock').setLabel('✊ ค้อน').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('choice_paper').setLabel('✋ กระดาษ').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('choice_scissors').setLabel('✌️ กรรไกร').setStyle(ButtonStyle.Primary),
                );

                // Send ephemeral choice messages to both players
                await game.challengerInteraction.followUp({
                    content: `ถึงตาคุณแล้ว! เลือกท่าเป่ายิงฉุบของคุณเลย:`,
                    components: [choiceButtonsRow],
                    flags: MessageFlags.Ephemeral // Only visible to the challenger
                });

                await game.opponentInteraction.followUp({
                    content: `ถึงตาคุณแล้ว! เลือกท่าเป่ายิงฉุบของคุณเลย:`,
                    components: [choiceButtonsRow],
                    flags: MessageFlags.Ephemeral // Only visible to the opponent
                });

                // Update game state in the map (important for the choice collector)
                activeGames.set(publicMessage.id, game);

                // --- Collector for Rock/Paper/Scissors choices ---
                const choiceCollector = publicMessage.channel.createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    filter: ci => (ci.user.id === game.challengerId || ci.user.id === game.opponentId) && ci.customId.startsWith('choice_'),
                    time: GAME_TIMEOUT_MS,
                    max: 2, // We need two choices (one from each player)
                    dispose: true // Ensure collector emits 'remove' when components are removed
                });

                const choiceEmojis = {
                    'rock': '✊',
                    'paper': '✋',
                    'scissors': '✌️'
                };

                choiceCollector.on('collect', async choiceInteraction => {
                    const currentGame = activeGames.get(publicMessage.id);
                    if (!currentGame) return; // Game might have already ended/timed out

                    const choice = choiceInteraction.customId.replace('choice_', '');

                    // Determine which player made the choice and store it
                    if (choiceInteraction.user.id === currentGame.challengerId) {
                        if (currentGame.challengerChoice) {
                            // Player already made a choice, prevent re-selection
                            await choiceInteraction.reply({ content: 'คุณเลือกไปแล้วนะ! โปรดรอคู่ต่อสู้.', flags: MessageFlags.Ephemeral });
                            return;
                        }
                        currentGame.challengerChoice = choice;
                    } else if (choiceInteraction.user.id === currentGame.opponentId) {
                        if (currentGame.opponentChoice) {
                            // Player already made a choice, prevent re-selection
                            await choiceInteraction.reply({ content: 'คุณเลือกไปแล้วนะ! โปรดรอคู่ต่อสู้.', flags: MessageFlags.Ephemeral });
                            return;
                        }
                        currentGame.opponentChoice = choice;
                    } else {
                        // Someone else tried to interact with the choice buttons
                        await choiceInteraction.reply({ content: 'คุณไม่ได้รับอนุญาตให้เลือกในเกมนี้!', flags: MessageFlags.Ephemeral });
                        return;
                    }

                    // Update the ephemeral message for the player who just chose
                    await choiceInteraction.update({
                        content: `คุณเลือก: ${choiceEmojis[choice]} ✅`,
                        components: [] // Remove choice buttons after selection
                    });

                    // Update game state in the map
                    activeGames.set(publicMessage.id, currentGame);

                    // If both players have made their choices, stop the collector
                    if (currentGame.challengerChoice && currentGame.opponentChoice) {
                        choiceCollector.stop();
                    }
                });

                choiceCollector.on('end', async (collected, reason) => {
                    const game = activeGames.get(publicMessage.id);
                    if (!game) return; // Game already processed or cleaned up

                    // Ensure we have the opponent's user object for messages
                    const opponentUser = await interaction.client.users.fetch(game.opponentId).catch(() => null);

                    // Handle cases where choices weren't made within the time limit
                    if (!game.challengerChoice || !game.opponentChoice) {
                        let missingPlayers = [];
                        if (!game.challengerChoice) missingPlayers.push(challenger.username);
                        if (!game.opponentChoice && opponentUser) missingPlayers.push(opponentUser.username);
                        else if (!game.opponentChoice) missingPlayers.push('คู่ต่อสู้ของคุณ'); // Fallback if opponent user object isn't found

                        const timeoutEmbed = new EmbedBuilder()
                            .setColor(0xCD5C5C) // สีแดงอิฐ
                            .setTitle('⏰ หมดเวลาการเลือกท่า!')
                            .setDescription(`❌ เกมเป่ายิงฉุบถูกยกเลิก: **${missingPlayers.join(' และ ')}** ไม่ได้เลือกท่าในเวลาที่กำหนด.`)
                            .setTimestamp();

                        await publicMessage.edit({
                            embeds: [timeoutEmbed],
                            components: []
                        }).catch(() => {});

                        // Attempt to delete ephemeral choice messages
                        try {
                            if (game.challengerInteraction.replied || game.challengerInteraction.deferred) {
                                const messages = await game.challengerInteraction.channel.messages.fetch({ limit: 5 });
                                const ephemeralMessage = messages.find(m =>
                                    m.interaction?.id === game.challengerInteraction.id && m.flags.has(MessageFlags.Ephemeral)
                                );
                                if (ephemeralMessage) await ephemeralMessage.delete();
                            }
                        } catch (err) {
                            console.error('Failed to delete challenger ephemeral reply:', err.message);
                        }
                        try {
                            if (game.opponentInteraction && (game.opponentInteraction.replied || game.opponentInteraction.deferred)) {
                                const messages = await game.opponentInteraction.channel.messages.fetch({ limit: 5 });
                                const ephemeralMessage = messages.find(m =>
                                    m.interaction?.id === game.opponentInteraction.id && m.flags.has(MessageFlags.Ephemeral)
                                );
                                if (ephemeralMessage) await ephemeralMessage.delete();
                            }
                        } catch (err) {
                            console.error('Failed to delete opponent ephemeral reply:', err.message);
                        }

                        cleanupGame(publicMessage.id, game.challengerId, game.opponentId); // Clean up game state
                        return;
                    }

                    // Both players have chosen, determine the winner!
                    const p1Choice = game.challengerChoice;
                    const p2Choice = game.opponentChoice;

                    let resultText;
                    let winnerId = null;
                    let resultColor;
                    let resultThumbnail;

                    if (p1Choice === p2Choice) {
                        resultText = 'เสมอ!';
                        resultColor = 0x808080; // สีเทาสำหรับเสมอ
                        resultThumbnail = 'https://cdn-icons-png.flaticon.com/512/1862/1862217.png'; // ไอคอนเสมอ
                        // Update stats for a draw (both played, no win/loss)
                        updatePlayerStats(challenger.id, challenger.username, false); // Just played, not win
                        updatePlayerStats(opponentUser.id, opponentUser.username, false); // Just played, not win
                    } else if (
                        (p1Choice === 'rock' && p2Choice === 'scissors') ||
                        (p1Choice === 'paper' && p2Choice === 'rock') ||
                        (p1Choice === 'scissors' && p2Choice === 'paper')
                    ) {
                        resultText = `🎉 **${challenger.username}** ชนะ!`;
                        winnerId = challenger.id;
                        resultColor = 0x00FF00; // สีเขียวสำหรับผู้ชนะ
                        resultThumbnail = challenger.displayAvatarURL(); // รูปโปรไฟล์ผู้ชนะ
                        // Update stats for challenger win, opponent loss
                        updatePlayerStats(challenger.id, challenger.username, true);
                        updatePlayerStats(opponentUser.id, opponentUser.username, false);
                    } else {
                        resultText = `🎉 **${opponentUser.username}** ชนะ!`;
                        winnerId = opponentUser.id;
                        resultColor = 0xFF0000; // สีแดงสำหรับผู้ชนะ
                        resultThumbnail = opponentUser.displayAvatarURL(); // รูปโปรไฟล์ผู้ชนะ
                        // Update stats for opponent win, challenger loss
                        updatePlayerStats(challenger.id, challenger.username, false);
                        updatePlayerStats(opponentUser.id, opponentUser.username, true);
                    }

                    // --- Result Embed ---
                    const resultEmbed = new EmbedBuilder()
                        .setColor(resultColor)
                        .setTitle('🏆 ผลการดวลเป่ายิงฉุบ! 🏆')
                        .setDescription(`การต่อสู้จบลงแล้ว! มาดูกันว่าใครคือผู้ชนะ!`)
                        .addFields(
                            { name: `${challenger.username} เลือก`, value: `\`${choiceEmojis[p1Choice]} ${p1Choice.toUpperCase()}\``, inline: true },
                            { name: `${opponentUser.username} เลือก`, value: `\`${choiceEmojis[p2Choice]} ${p2Choice.toUpperCase()}\``, inline: true },
                            { name: '\u200B', value: '\u200B', inline: false }, // ช่องว่าง
                            { name: '🌟 ผลลัพธ์', value: `**${resultText}**`, inline: false },
                        )
                        .setThumbnail(resultThumbnail)
                        .setTimestamp()
                        .setFooter({ text: 'ขอบคุณที่ร่วมสนุก! เล่นใหม่อีกครั้งได้เสมอ!', iconURL: interaction.client.user.displayAvatarURL() });

                    await publicMessage.edit({
                        embeds: [resultEmbed],
                        components: [] // Remove all buttons
                    }).catch(() => {});

                    // Save game results to the JSON file (historical data)
                    const data = readData();
                    data.gameResults.push({
                        timestamp: new Date().toISOString(),
                        gameType: 'PvP_PublicJoin',
                        player1: { id: challenger.id, username: challenger.username, choice: p1Choice },
                        player2: { id: opponentUser.id, username: opponentUser.username, choice: p2Choice },
                        result: resultText,
                        winnerId: winnerId
                    });
                    writeData(data);

                    cleanupGame(publicMessage.id, game.challengerId, game.opponentId); // Clean up game state
                });

            } else if (i.customId.startsWith('rps_cancel_')) {
                // Challenger pressed the "Cancel Game" button
                const gameChallengerId = i.customId.split('_')[2];
                if (i.user.id !== gameChallengerId) {
                    await i.reply({
                        content: 'คุณไม่ใช่ผู้เริ่มเกมนี้ คุณไม่สามารถยกเลิกได้ค่ะ!',
                        flags: MessageFlags.Ephemeral
                    });
                    // Re-start the join collector if someone else tried to cancel
                    startJoinCollector(publicMessage, challenger);
                    return;
                }

                // --- Cancel Game Embed ---
                const cancelEmbed = new EmbedBuilder()
                    .setColor(0xDC143C) // สีแดงเข้ม
                    .setTitle('🚫 เกมเป่ายิงฉุบถูกยกเลิกแล้ว!')
                    .setDescription(`ผู้ท้าดวล **${challenger.username}** ได้ยกเลิกการท้าดวลนี้แล้วค่ะ.`)
                    .setTimestamp()
                    .setFooter({ text: 'ลองเริ่มเกมใหม่ดูสิ!', iconURL: interaction.client.user.displayAvatarURL() });

                await i.update({
                    embeds: [cancelEmbed],
                    components: []
                });
                cleanupGame(publicMessage.id, challenger.id); // Clean up game state
            }
        });

        // --- Handle Timeout for no one joining/cancelling ---
        joinCollector.on('end', async (collected, reason) => {
            if (reason === 'time' && !collected.size) {
                // If the collector ended due to time and no buttons were collected
                const game = activeGames.get(publicMessage.id);
                if (game && !game.opponentId) { // Check if game still exists and no opponent joined
                    const timeoutNoJoinEmbed = new EmbedBuilder()
                        .setColor(0xFFA500) // สีส้ม
                        .setTitle('💤 ไม่มีใครเข้าร่วมเลย..')
                        .setDescription(`**${challenger.username}** ไม่พบคู่ท้าดวลในเวลาที่กำหนด! เกมถูกยกเลิกไปโดยอัตโนมัติค่ะ.`)
                        .setTimestamp()
                        .setFooter({ text: 'ลองชวนเพื่อนมาเล่นครั้งหน้าดูนะ!', iconURL: interaction.client.user.displayAvatarURL() });

                    await publicMessage.edit({
                        embeds: [timeoutNoJoinEmbed],
                        components: []
                    });
                    cleanupGame(publicMessage.id, game.challengerId); // Clean up game state
                }
            }
        });

        /**
         * Helper function to re-create the join collector.
         * This is used when an invalid interaction (e.g., challenger joining their own game) occurs.
         * @param {Message} message The public message to attach the collector to.
         * @param {User} challengerUser The original challenger's user object.
         */
        const startJoinCollector = (message, challengerUser) => {
            const newJoinCollector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                filter: i => i.customId.startsWith('rps_join_') || i.customId.startsWith('rps_cancel_'),
                time: GAME_TIMEOUT_MS,
                max: 1
            });

            newJoinCollector.on('collect', async i => {
                newJoinCollector.stop(); // Stop this new collector
                joinCollector.emit('collect', i); // Re-emit the collected interaction to the original joinCollector
            });

            newJoinCollector.on('end', async (collected, reason) => {
                // Re-implement the timeout logic for the new collector
                if (reason === 'time' && !collected.size) {
                    const game = activeGames.get(message.id);
                    if (game && !game.opponentId) {
                        const timeoutNoJoinEmbed = new EmbedBuilder()
                            .setColor(0xFFA500) // สีส้ม
                            .setTitle('💤 ไม่มีใครเข้าร่วมเลย..')
                            .setDescription(`**${challengerUser.username}** ไม่พบคู่ท้าดวลในเวลาที่กำหนด! เกมถูกยกเลิกไปโดยอัตโนมัติค่ะ.`)
                            .setTimestamp()
                            .setFooter({ text: 'ลองชวนเพื่อนมาเล่นครั้งหน้าดูนะ!', iconURL: message.client.user.displayAvatarURL() });

                        await message.edit({
                            embeds: [timeoutNoJoinEmbed],
                            components: []
                        });
                        cleanupGame(message.id, game.challengerId);
                    }
                }
            });
        };
    },
};