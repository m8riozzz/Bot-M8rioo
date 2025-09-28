const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType,
    PermissionsBitField,
    Events 
} = require('discord.js');

// Load environment variables from .env file
require('dotenv').config();

// --- CONFIGURATION ---
// Variables are now loaded from process.env
const TOKEN = process.env.DISCORD_TOKEN;          // Bot token
const GUILD_ID = process.env.GUILD_ID;        // Server ID
const SUPPORT_ROLE_ID = process.env.SUPPORT_ROLE_ID; // ID of the role to mention (e.g., 'Mod', 'Helper')
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID; // ID of the category to create tickets in
const PANEL_CHANNEL_ID = process.env.PANEL_CHANNEL_ID; // ID of the channel where the panel should be posted
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID; // ID of the channel to send ticket transcripts/logs to

// Custom IDs for the buttons (must be unique)
const CUSTOM_ID_TICKET = 'create_support_ticket';
const CUSTOM_ID_CLOSE = 'close_support_ticket';

// --- BOT SETUP ---
// Required intents: Guilds, GuildMembers, and MessageContent (for fetching logs/transcripts)
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent 
    ] 
});

// --- BOT EVENTS ---

// 1. Bot Ready Event (Auto-Post Panel)
client.once(Events.ClientReady, async c => {
    console.log(`✅ Ready! Logged in as ${c.user.tag}`);
    
    try {
        // Validation check for mandatory IDs
        if (!PANEL_CHANNEL_ID) {
             return console.error(`❌ Panel channel ID missing. Check PANEL_CHANNEL_ID in .env.`);
        }

        // Fetch the channel where the support panel should be posted
        const panelChannel = await client.channels.fetch(PANEL_CHANNEL_ID);

        // Basic validation
        if (!panelChannel || panelChannel.type !== ChannelType.GuildText) {
            return console.error(`❌ Panel channel not found or is not a text channel. Check PANEL_CHANNEL_ID.`);
        }

        // Create the "Support" button
        const ticketButton = new ButtonBuilder()
            .setCustomId(CUSTOM_ID_TICKET)
            .setLabel('Create Ticket')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎫');

        // Create an action row
        const row = new ActionRowBuilder().addComponents(ticketButton);

        // Send the initial support message with the button to the specified channel
        await panelChannel.send({
            content: '📌 **SUPPORT PANEL** 📌\n\nNeed help? Click the button below to open a support ticket!',
            components: [row]
        });

        console.log(`✅ Successfully posted support panel to channel ID: ${PANEL_CHANNEL_ID}`);

    } catch (error) {
        console.error('❌ Failed during auto-post routine (Is GUILD_ID correct and is the bot in the server?):', error);
    }
});

// 2. Interaction Handler (Button Clicks)
client.on(Events.InteractionCreate, async interaction => {
    // Check if the interaction is a button press
    if (!interaction.isButton()) return;
    
    const guild = interaction.guild;
    const user = interaction.user;
    const supportRole = guild.roles.cache.get(SUPPORT_ROLE_ID);

    if (!supportRole) {
        // Only return an error if a ticket or closure is attempted without the role
        if (interaction.customId === CUSTOM_ID_TICKET || interaction.customId === CUSTOM_ID_CLOSE) {
            await interaction.reply({ 
                content: '❌ Configuration Error: Support role not found. Please check SUPPORT_ROLE_ID in .env.', 
                ephemeral: true 
            });
        }
        return;
    }


    // --- Ticket Creation Handler ---
    if (interaction.customId === CUSTOM_ID_TICKET) {
        await interaction.deferReply({ ephemeral: true }); // Show "Bot is thinking..." privately

        // Check if the user already has a ticket open (basic check)
        const existingTicket = guild.channels.cache.find(c => 
            c.name.startsWith('ticket-') &&
            c.name.includes(user.username.toLowerCase().replace(/[^a-z0-9]/g, '-')) &&
            c.parentId === TICKET_CATEGORY_ID
        );

        if (existingTicket) {
            return interaction.editReply({ 
                content: `You already have a ticket open: ${existingTicket}`,
                ephemeral: true
            });
        }

        try {
            // Create the new channel (ticket)
            const ticketChannel = await guild.channels.create({
                name: `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
                type: ChannelType.GuildText,
                parent: TICKET_CATEGORY_ID,
                permissionOverwrites: [
                    {
                        id: guild.id, // @everyone role
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: user.id, // The user who clicked the button
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                    },
                    {
                        id: supportRole.id, // The support staff role ID
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                    },
                ],
            });

            // Create the "Close Ticket" button
            const closeButton = new ButtonBuilder()
                .setCustomId(CUSTOM_ID_CLOSE)
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Danger) // Red button for closing
                .setEmoji('🔒');

            const closeRow = new ActionRowBuilder().addComponents(closeButton);

            // Send a welcome message in the new ticket channel
            ticketChannel.send({
                content: `${user}, ${supportRole} \nWelcome to your support ticket! Please explain your issue here.`,
                components: [closeRow] // Include the close button
            });

            // Inform the user the ticket was created
            await interaction.editReply({ 
                content: `Your support ticket has been created: ${ticketChannel}`, 
                ephemeral: true 
            });

        } catch (error) {
            console.error('Ticket creation error (Check TICKET_CATEGORY_ID and bot permissions):', error);
            await interaction.editReply({ 
                content: 'There was an error creating your ticket. Please contact an administrator.', 
                ephemeral: true 
            });
        }
    }

    // --- Ticket Closure and Logging Handler ---
    else if (interaction.customId === CUSTOM_ID_CLOSE) {
        // Defer the reply publicly since the process (fetching logs, sending file) takes time
        await interaction.deferReply({ ephemeral: false }); 

        const channel = interaction.channel;
        const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);

        // Check 1: Ensure it's a ticket channel and the user has permission to close it.
        // A user can close the ticket if they are the creator OR if they have the support role.
        const isTicketCreator = channel.name.includes(user.username.toLowerCase().replace(/[^a-z0-9]/g, '-'));
        const isSupportStaff = interaction.member.roles.cache.has(SUPPORT_ROLE_ID);
        
        if (channel.parentId !== TICKET_CATEGORY_ID || (!isTicketCreator && !isSupportStaff)) {
            return interaction.editReply({ 
                content: 'You do not have permission to close this ticket.',
                ephemeral: true
            });
        }


        // Check 2: Ensure the log channel exists
        if (!logChannel || logChannel.type !== ChannelType.GuildText) {
            await interaction.editReply(`❌ Error: Log channel not found or incorrectly configured (Check LOG_CHANNEL_ID). Cannot save transcript. Deleting channel in 5 seconds...`);
            console.error('❌ Log channel issue. Check LOG_CHANNEL_ID.');
            // Proceed to delete the ticket anyway
            return setTimeout(() => channel.delete().catch(e => console.error('Error deleting channel:', e)), 5000);
        }

        await interaction.editReply(`Ticket closed by ${user.tag}. Generating transcript...`);

        // --- Fetch and Format Transcript ---
        let transcript = `TICKET TRANSCRIPT: ${channel.name}\nClosed by: ${user.tag}\nDate: ${new Date().toISOString()}\n\n--- MESSAGES ---\n\n`;

        // Fetch messages (fetching all messages by looping up to the limit of 1000)
        let lastId;
        let messagesArray = [];
        while (true) {
            const messages = await channel.messages.fetch({ limit: 100, before: lastId, cache: false });
            messagesArray.push(...Array.from(messages.values()));
            
            if (messages.size !== 100) break;
            
            lastId = messages.last().id;
        }

        // Reverse the array to show messages in chronological order (oldest first)
        messagesArray.reverse();


        for (const msg of messagesArray) {
            let logLine = `[${new Date(msg.createdTimestamp).toLocaleString()}] ${msg.author.tag}: ${msg.content}\n`;
            
            if (msg.attachments.size > 0) {
                logLine += `    [Attachment(s): ${msg.attachments.map(a => a.url).join(', ')}]\n`;
            }
            transcript += logLine;
        }

        // --- Save Log (Transcript) ---
        
        // 1. Send the transcript as a file to the log channel
        const attachment = Buffer.from(transcript, 'utf-8');
        // Extract the username part from 'ticket-username'
        const originalCreator = channel.name.split('-')[1] ? channel.name.split('-')[1].replace(/-/g, ' ') : 'Unknown User'; 
        
        await logChannel.send({
            content: `🔒 Transcript for **${channel.name}**\n*Creator:* \`${originalCreator}\`\n*Closed by:* ${user}`,
            files: [{
                attachment: attachment,
                name: `${channel.name}_transcript.txt`
            }]
        });

        // 2. Final closure message and channel deletion
        await interaction.channel.send(`Transcript saved successfully. This channel will be deleted in 5 seconds...`);
        
        // Delete the channel after a short delay
        setTimeout(() => {
            channel.delete()
                .then(() => console.log(`Deleted ticket channel: ${channel.name}`))
                .catch(e => console.error('Error deleting channel (Check bot permissions):', e));
        }, 5000);
        

    }
});

// --- LOGIN ---
client.login(TOKEN);
