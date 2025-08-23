const { joinVoiceChannel } = require("@discordjs/voice");
const {
    Client,
    Collection,
    GatewayIntentBits,
    Partials,
    ActivityType,
} = require("discord.js");
const colors = require("colors");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.GuildScheduledEvents,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [
        Partials.Channel,
        Partials.GuildMember,
        Partials.GuildScheduledEvent,
        Partials.Message,
        Partials.Reaction,
        Partials.ThreadMember,
        Partials.User,
    ],
    restTimeOffset: 0,
    failIfNotExists: false,
    allowedMentions: {
        parse: ["roles", "users", "everyone"],
        repliedUser: false,
    },
});

const config = require("./settings/config");
client.login(config.token);

module.exports = client;

client.slashCommands = new Collection();

// --- Dynamic Status Integration ---
const statuses = [
    {
        name: `Luv U`,
        type: ActivityType.Streaming,
        url: "https://open.spotify.com/track/2FDTHlrBguDzQkp7PVj16Q?si=d839e55d75934dc4",
    },
];

let i = 0;

client.on("ready", async () => {
    require("./handler")(client);
    const readyEvent = require("./events/client/ready");
    await readyEvent.execute(client);
    client.user.setPresence({
        activities: [statuses[i]],
        status: "online",
    });
    console.log(`Initial status set: ${statuses[i].name}`.green);
    setInterval(async () => {
        client.channels
            .fetch("1404888703880527994")
            .then((channel) => {
                const VoiceConnection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: channel.guild.id,
                    adapterCreator: channel.guild.voiceAdapterCreator,
                    selfDeaf: false,
                });
            })
            .catch((error) => {
                console.error("Error fetching or joining voice channel:", error);
            });
        i = (i + 1) % statuses.length;
        client.user.setPresence({
            activities: [statuses[i]],
            status: "online",
        });
        console.log(`Status changed to: ${statuses[i].name}`.green);
    }, 10000);
});

process.on("unhandledRejection", (error) => {
    if (error.code == 10062) return;
    console.log(`[ERROR] ${error}`.red);
});