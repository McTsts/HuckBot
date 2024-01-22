/* Discord */
const { Client, Intents, ApplicationCommandOptionType, GatewayIntentBits } = require('discord.js');
global.client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildWebhooks, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.DirectMessages, GatewayIntentBits.DirectMessageReactions] });
config = require("./config.json");


require("./sql.js")();

/* Setup */
client.on("ready", async () => {
	sqlSetup();
    registerCommands();
    global.client.guilds.fetch(stats.log_guild).then(guild => {
        guild.members.fetch().then((members) => {
            //members.forEach(el => console.log(el.user.id));
            //console.log(members.map(el => el.user.id));
        });
    });
});

function isGameMaster(member) {
    if(!member) return false;
    return member && member.roles && member.roles.cache.find(role  => role.name == "Game Master");
}

function isParticipant(member) {
    if(!member) return false;
    return member && member.roles && member.roles.cache.find(role  => role.name == "Participant");
}


/* New Slash Command */
client.on('interactionCreate', async interaction => {
    if(!interaction.isCommand()) return; // ignore non-slash commands
    switch(interaction.commandName) {
        case "ping":
            // Send pinging message
            interaction.reply({ content: "? Ping", fetchReply: true, ephemeral: true })
            .then(m => {
                // Get values
                let latency = m.createdTimestamp - interaction.createdTimestamp;
                let ping = Math.round(client.ws.ping);
                interaction.editReply("? Pong! Latency is " + latency + "ms. API Latency is " + ping + "ms");
            })
        break;
        case "help":
            // Send pinging message
            interaction.reply({ content: "help" });
        break;
        break;
    }
})

/* Register Slash Commands */
function registerCommands() {
    client.application?.commands.create({
        name: 'ping',
        description: 'Gives the ping of the bot, and checks if the bot is running.'
    });
    client.application?.commands.create({
        name: 'help',
        description: 'Lists the commands'
    });
    client.application?.commands.create({
        name: 'signup',
        description: 'Join the game'
    });
    client.application?.commands.create({
        name: 'signout',
        description: 'Leave the game'
    });
}


function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
} 

/* 
	LOGIN
*/
client.login(config.token);
