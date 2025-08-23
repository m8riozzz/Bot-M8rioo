const colors = require("colors");
const config = require("../../settings/config");
const {
    ActionRowBuilder,
    Colors,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");

module.exports = {
    name: "ready",
    once: false,
    execute: async (client) => {
        console.log(
            `[READY] ${client.user.tag} (${client.user.id}) is ready !`.green,
        );

        let channelTicket = client.channels.cache.get(config.ticket_channel);
        await channelTicket.send({ content: "." });
        await channelTicket.bulkDelete(2);

        await channelTicket.send({
            embeds: [
                {
                    title: "F8appe Support",
                    description:
                        "Do you need help with something? Contact our staff team privately so we can assist you with whatever you need.\n\n**Additional Information:**\n• If it's urgent, just mention one of our staff members.\n• Please give us clear information.",
                    color: Colors.DarkRed,
                    footer: {
                        name: "Staff Support",
                    },
                },
            ],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("ticket")
                        .setLabel("Open a ticket")
                        .setStyle(ButtonStyle.Secondary),
                ),
            ],
        });
    },
};
