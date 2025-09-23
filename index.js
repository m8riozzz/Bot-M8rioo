// Importation des classes nécessaires de discord.js
const { Client, GatewayIntentBits, Partials, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
// Importation de la bibliothèque dotenv pour charger les variables d'environnement
require('dotenv').config();

// IDs des rôles à modifier. REMPLACEZ CES VALEURS par les vôtres.
const ON_DUTY_ROLE_ID = 'VOTRE_ID_DU_ROLE_ON_DUTY';
const OFF_DUTY_ROLE_ID = 'VOTRE_ID_DU_ROLE_OFF_DUTY';

// Création d'une nouvelle instance du client Discord avec les intents nécessaires
const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMembers, // Nécessaire pour gérer les rôles
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildModeration // Nécessaire pour la gestion des rôles de certains bots
],
partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Événement 'ready' : s'exécute une seule fois lorsque le bot est prêt
client.once('ready', () => {
console.log(`Bot prêt ! Connecté en tant que ${client.user.tag}`);

// --- ENVOI DU MESSAGE AVEC LES BOUTONS AU DÉMARRAGE DU BOT ---
// Vous pouvez commenter ce bloc si vous préférez envoyer le message manuellement avec une commande.
const channelId = 'ID_DU_CANAL_DE_SERVICE'; // Remplacez par l'ID du canal où le message doit être envoyé

const targetChannel = client.channels.cache.get(channelId);
if (targetChannel) {
sendDutyMessage(targetChannel);
} else {
console.error(`Le canal avec l'ID ${channelId} n'a pas été trouvé.`);
}
});

// Événement 'interactionCreate' : gère toutes les interactions (boutons, commandes, etc.)
client.on('interactionCreate', async interaction => {
// S'assurer que l'interaction est un clic de bouton
if (!interaction.isButton()) return;

const member = interaction.member;

try {
// Logique pour le bouton "On Duty"
if (interaction.customId === 'on_duty_button') {
await member.roles.add(ON_DUTY_ROLE_ID);
await member.roles.remove(OFF_DUTY_ROLE_ID);

// Réponse éphémère (visible uniquement par l'utilisateur)
await interaction.reply({ content: '✅ Vous êtes maintenant **On Duty**.', ephemeral: true });

// Logique pour le bouton "Off Duty"
} else if (interaction.customId === 'off_duty_button') {
await member.roles.add(OFF_DUTY_ROLE_ID);
await member.roles.remove(ON_DUTY_ROLE_ID);

await interaction.reply({ content: '💤 Vous êtes maintenant **Off Duty**.', ephemeral: true });
}
} catch (error) {
console.error('Erreur lors de la modification des rôles:', error);
await interaction.reply({ content: '❌ Une erreur est survenue lors de la modification de vos rôles. Assurez-vous d\'avoir les permissions nécessaires.', ephemeral: true });
}
});

/**
* Crée et envoie le message avec les boutons de service.
* @param {import('discord.js').TextChannel} channel Le canal où envoyer le message.
*/
async function sendDutyMessage(channel) {
const embed = new EmbedBuilder()
.setTitle('Statut de service du Staff')
.setDescription('Utilisez les boutons ci-dessous pour changer votre statut de service (`On Duty` ou `Off Duty`).')
.setColor('#0099ff');

const onDutyButton = new ButtonBuilder()
.setCustomId('on_duty_button')
.setLabel('On Duty')
.setStyle(ButtonStyle.Success)
.setEmoji('🟢');

const offDutyButton = new ButtonBuilder()
.setCustomId('off_duty_button')
.setLabel('Off Duty')
.setStyle(ButtonStyle.Danger)
.setEmoji('🔴');

const row = new ActionRowBuilder()
.addComponents(onDutyButton, offDutyButton);

try {
await channel.send({ embeds: [embed], components: [row] });
} catch (error) {
console.error('Impossible d\'envoyer le message de service:', error);
}
}

// Connexion du bot à Discord
client.login(process.env.DISCORD_TOKEN);

