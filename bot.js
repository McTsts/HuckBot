/* Discord */
const { Client, Intents, ApplicationCommandOptionType, GatewayIntentBits } = require('discord.js');
global.client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildWebhooks, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.DirectMessages, GatewayIntentBits.DirectMessageReactions] });
config = require("./config.json");


require("./sql.js")();

var mainguild = null;
var participant = null;
var gm = null;

/* Setup */
client.on("ready", async () => {
	sqlSetup();
    registerCommands();
    cacheMaterials();
    
    mainguild = await global.client.guilds.fetch(config.guild);
    participant = mainguild.roles.cache.find(role => role.name == "Participant");
    gm = mainguild.roles.cache.find(role => role.name == "Game Master");
   
    mainguild.members.fetch().then((members) => {
        //members.forEach(el => console.log(el.user.id));
        //console.log(members.map(el => el.user.id));
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

var materialCache = [];
function cacheMaterials() {
    materialCache = [];
    quicksqlquery("SELECT * FROM materials", result => {
        result.forEach(el => materialCache[+el.m_id] = el.name);
    });
}


/* New Slash Command */
client.on('interactionCreate', async interaction => {
    if(!interaction.isCommand()) return; // ignore non-slash commands
    switch(interaction.commandName) {
        case "ping":
            // Send pinging message
            interaction.reply({ content: "Ping", fetchReply: true, ephemeral: true })
            .then(m => {
                // Get values
                let latency = m.createdTimestamp - interaction.createdTimestamp;
                let ping = Math.round(client.ws.ping);
                interaction.editReply("Pong! Latency is " + latency + "ms. API Latency is " + ping + "ms");
            })
        break;
        case "help":
            if(isGameMaster(interaction.member)) {
                // Send help mesgae
                interaction.reply({ content: "**Commands**\n*everyone*\n/signup /signout - adds/removes a player to the bot's stored list of players\n/list - list players\n/list_materials - displays all materials\n/help - see help for commands\n/ping - check if the bot works\n/inventory - see your own inventory\n/list_recipes - lists all recipes and their ids\n/craft <recipe id> - crafts a certain recipe\n/list_areas - lists all areas and their ids\n/scavenge <area id> - scavenges a registered area\n\n*gm*\n/register_material <material id> <name> - registers a new material with a numeric id and a name\n/delete_material <material id> - deletes a material by material id\n/register_recipe <recipe id> <in list> <output> - defines a crafting recipe with a comma separated list of input material ids and an output material id\n/delete_recipe <recipe id> - deletes a recipe by recipe id\n/reset - deletes all player data\n/invsee - list players + their inventory\n/invadd <player id> <material id> - adds material to an inventory\n/invrem <player id> <material id> - removes material to an inventory\n/lock - locks scavenging for everyone\n/unlock - unlocks scavenging for everyone\n/set_skill <value> <player id>\n/register_area <area id> <scavange output> - registers an area with a certain scavenge output defined in a format like `0.1:1,0.2:2` which would mean a 10% chance of getting material 1, and a 20% chance of getting material 2. You can append `x1`/`x2`/etc and `x1-2`/`x3-7`/etc after a material id to specify a randomized count.\n/delete_area <area id> - deletes an area\n/list_areas - lists all areas and their scavenge outputs" });
            } else {
                // Send help mesgae
                interaction.reply({ content: "**Commands**\n/signup /signout - adds/removes a player to the bot's stored list of players\n/list - list players\n/list_materials - displays all materials\n/help - see help for commands\n/ping - check if the bot works\n/inventory - see your own inventory\n/list_recipes - lists all recipes and their ids\n/craft <recipe id> - crafts a certain recipe\n/list_areas - lists all areas and their ids\n/scavenge <area id> - scavenges a registered area" });
            }
        break;
        case "signup":
            if(!isParticipant(interaction.member)) {
                quicksql("INSERT INTO players (id, scavenged, inventory) VALUES (" + connection.escape(interaction.member.id) + ",0,'')");
                interaction.reply({ content: "You signed up!", fetchReply: true });
                interaction.member.roles.add(participant);
            } else {
                interaction.reply({ content: "Error! Already signed up.", fetchReply: true, ephemeral: true })
            }
        break;
        case "signout":
            if(isParticipant(interaction.member)) {
                quicksql("DELETE FROM players WHERE id=" + connection.escape(interaction.member.id));
                interaction.reply({ content: "You signed out!", fetchReply: true });
                interaction.member.roles.remove(participant);
            } else {
                interaction.reply({ content: "Error! Not signed up.", fetchReply: true, ephemeral: true })
            }
        break;
        case "reset":
            if(isGameMaster(interaction.member)) {
                quicksql("DELETE FROM players");
                interaction.reply({ content: "Deleted all signedup players. Please manually remove the 'Participant' role from all players.", fetchReply: true });
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "list":
            interaction.reply({ content: "**Players**", fetchReply: true, ephemeral: true }).then(m => {
                quicksqlquery("SELECT * FROM players", result => {
                    interaction.editReply({ content: "**Players**\n" + result.map(el => `<@${el.id}>`).join("\n"), fetchReply: true, ephemeral: true })
                });
            });
        break;
        case "invsee":
            if(isGameMaster(interaction.member)) {
                interaction.reply({ content: "**Players (INV)**", fetchReply: true, ephemeral: true }).then(m => {
                    quicksqlquery("SELECT * FROM players", result => {
                        interaction.editReply({ content: "**Players (INV)**\n" + result.map(el => `<@${el.id}>: ${el.inventory.split(",").map(el => materialCache[+el])} (${el.scavenged})`).join("\n"), fetchReply: true, ephemeral: true })
                    });
                });
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "inventory":
            if(isParticipant(interaction.member)) {
                interaction.reply({ content: "**Inventory**", fetchReply: true, ephemeral: true }).then(m => {
                    quicksqlquery("SELECT * FROM players WHERE id=" + connection.escape(interaction.member.id), result => {
                        let inv = result[0].inventory.split(",").map(el => materialCache[+el]);
                        const counts = {};
                        for (const num of inv) {
                          counts[num] = counts[num] ? counts[num] + 1 : 1;
                        }
                        interaction.editReply({ content: "**Inventory**\n" + `${Object.keys(counts).map(key => "• " + key + " x" + counts[key]).join("\n")}`, fetchReply: true, ephemeral: true })
                    });
                });
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "register_material":
            if(isGameMaster(interaction.member)) {
                let m_id = interaction.options.get('m_id')?.value ?? null;
                let name = interaction.options.get('name')?.value ?? null;
                quicksql("INSERT INTO materials (m_id, name) VALUES (" + connection.escape(m_id) + "," + connection.escape(name) + ")");
                interaction.reply({ content: "Registered material.", fetchReply: true, ephemeral: true });
                cacheMaterials();
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "delete_material":
            if(isGameMaster(interaction.member)) {
                let m_id = interaction.options.get('m_id')?.value ?? null;
                quicksql("DELETE FROM materials WHERE m_id=" + connection.escape(m_id));
                interaction.reply({ content: "Deleted material.", fetchReply: true, ephemeral: true });
                cacheMaterials();
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "list_materials":
            interaction.reply({ content: "**Materials**", fetchReply: true, ephemeral: true }).then(m => {
                quicksqlquery("SELECT * FROM materials", result => {
                    interaction.editReply({ content: "**Materials**\n" + result.map(el => `\`${el.m_id}\`: ${el.name}`).join("\n"), fetchReply: true, ephemeral: true })
                });
            });
        break;
        case "register_area":
            if(isGameMaster(interaction.member)) {
                let a_id = interaction.options.get('a_id')?.value ?? null;
                let name = interaction.options.get('name')?.value ?? null;
                let scavenge  = interaction.options.get('scavenge')?.value ?? null;
                quicksql("INSERT INTO areas (a_id, name, scavenge) VALUES (" + connection.escape(a_id) + "," + connection.escape(name) +"," + connection.escape(scavenge) + ")");
                interaction.reply({ content: "Registered area.", fetchReply: true, ephemeral: true });
                cacheMaterials();
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "delete_area":
            if(isGameMaster(interaction.member)) {
                let a_id = interaction.options.get('a_id')?.value ?? null;
                quicksql("DELETE FROM areas WHERE a_id=" + connection.escape(a_id));
                interaction.reply({ content: "Deleted area.", fetchReply: true, ephemeral: true });
                cacheMaterials();
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "list_areas":
            if(isGameMaster(interaction.member)) {
                interaction.reply({ content: "**Areas (GM View)**", fetchReply: true, ephemeral: true }).then(m => {
                    quicksqlquery("SELECT * FROM areas", result => {
                        interaction.editReply({ content: "**Areas (GM View)**\n" + result.map(el => `\`${el.a_id}\`: ${el.name} => \`${el.scavenge}\``).join("\n"), fetchReply: true, ephemeral: true })
                    });
                });
            } else {
                interaction.reply({ content: "**Areas**", fetchReply: true, ephemeral: true }).then(m => {
                    quicksqlquery("SELECT * FROM areas", result => {
                        interaction.editReply({ content: "**Areas**\n" + result.map(el => `\`${el.a_id}\`: ${el.name}`).join("\n"), fetchReply: true, ephemeral: true })
                    });
                });
            }
        break;
        case "register_recipe":
            if(isGameMaster(interaction.member)) {
                let r_id = interaction.options.get('r_id')?.value ?? null;
                let input = interaction.options.get('input')?.value ?? null;
                let output = interaction.options.get('output')?.value ?? null;
                quicksql("INSERT INTO recipes (r_id, input, output) VALUES (" + connection.escape(r_id) + "," + connection.escape(input) +"," + connection.escape(output) + ")");
                interaction.reply({ content: "Registered recipe.", fetchReply: true, ephemeral: true })
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "delete_recipe":
            if(isGameMaster(interaction.member)) {
                let r_id = interaction.options.get('r_id')?.value ?? null;
                quicksql("DELETE FROM recipes WHERE r_id=" + connection.escape(m_id));
                interaction.reply({ content: "Deleted recipe.", fetchReply: true, ephemeral: true })
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "list_recipes":
            interaction.reply({ content: "**Recipes**", fetchReply: true, ephemeral: true }).then(m => {
                quicksqlquery("SELECT * FROM recipes", result => {
                    interaction.editReply({ content: "**Recipes**\n" + result.map(el => `\`${el.r_id}\`: ${el.input.split(",").map(el => materialCache[+el]).join(", ")} => ${materialCache[+el.output]}`).join("\n"), fetchReply: true, ephemeral: true })
                });
            });
        break;
        case "invadd":
            if(isGameMaster(interaction.member)) {
                interaction.reply({ content: "Adding...", fetchReply: true, ephemeral: true }).then(m => {
                    let id = interaction.options.get('player')?.value ?? null;
                    let m_id = interaction.options.get('m_id')?.value ?? null;
                    quicksqlquery("SELECT inventory FROM players WHERE id=" + connection.escape(id), result => {
                        let inv = result[0].inventory ? result[0].inventory + "," + m_id : m_id;
                        quicksqlquery("UPDATE players SET inventory=" + connection.escape(inv) + " WHERE id=" + connection.escape(id), result2 => {
                            interaction.editReply({ content: "Added! New Inventory: `" + inv.split(",").map(el => materialCache[+el]) + "`", fetchReply: true, ephemeral: true });
                        });
                    });
                });
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "invrem":
            if(isGameMaster(interaction.member)) {
                interaction.reply({ content: "Removing...", fetchReply: true, ephemeral: true }).then(m => {
                    let id = interaction.options.get('player')?.value ?? null;
                    let m_id = interaction.options.get('m_id')?.value ?? null;
                    quicksqlquery("SELECT inventory FROM players WHERE id=" + connection.escape(id), result => {
                        let inv = result[0].inventory.replace(m_id,"").split(",").filter(el => el).join(",");
                        quicksqlquery("UPDATE players SET inventory=" + connection.escape(inv) + " WHERE id=" + connection.escape(id), result2 => {
                            interaction.editReply({ content: "Removed! New Inventory: `" + inv.split(",").map(el => materialCache[+el]) + "`", fetchReply: true, ephemeral: true });
                        });
                    });
                });
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "lock":
            if(isGameMaster(interaction.member)) {
                interaction.reply({ content: "Locking...", fetchReply: true, ephemeral: true }).then(m => {
                    quicksqlquery("UPDATE players SET scavenged=1", result2 => {
                        interaction.editReply({ content: "Locked!", fetchReply: true, ephemeral: true });
                    });
                });
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "unlock":
            if(isGameMaster(interaction.member)) {
                interaction.reply({ content: "Unlocking...", fetchReply: true, ephemeral: true }).then(m => {
                    quicksqlquery("UPDATE players SET scavenged=0", result2 => {
                        interaction.editReply({ content: "Unlocked!", fetchReply: true, ephemeral: true });
                    });
                });
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "set_skill":
            if(isGameMaster(interaction.member)) {
                interaction.reply({ content: "Setting skill...", fetchReply: true, ephemeral: true }).then(m => {
                    let id = interaction.options.get('player')?.value ?? null;
                    let skill = interaction.options.get('skill')?.value ?? null;
                    quicksqlquery("UPDATE players SET skill=" + connection.escape(skill) + " WHERE id=" + connection.escape(id), result2 => {
                        interaction.editReply({ content: "Set skill.", fetchReply: true, ephemeral: true });
                    });
                });
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "craft":
            interaction.reply({ content: "Crafting...", fetchReply: true, ephemeral: true }).then(m => {
                let r_id = interaction.options.get('r_id')?.value ?? null;
                quicksqlquery("SELECT inventory FROM players WHERE id=" + connection.escape(interaction.member.id), result => {
                    let inv = result[0].inventory ?? "";
                    quicksqlquery("SELECT * FROM recipes WHERE r_id=" + connection.escape(r_id), result => {
                        let inputs = result[0].input.split(",");
                        let craftable = true;
                        
                        for(let inp in inputs) {
                            if(inv.indexOf(inputs[inp]) >= 0) {
                                inv = inv.replace(inputs[inp], "");
                            } else {
                                craftable = false;
                                break;
                            }
                        }
                        
                        if(craftable) {
                            inv = inv ? inv + "," + result[0].output : result[0].input;       
                            inv = inv.split(",").filter(el => el).join(",");
                            quicksqlquery("UPDATE players SET inventory=" + connection.escape(inv) + " WHERE id=" + connection.escape(interaction.member.id), result2 => {
                                interaction.editReply({ content: "Crafted! New Inventory: `" + inv.split(",").map(el => materialCache[+el]) + "`", fetchReply: true, ephemeral: true });
                            });
                        } else {
                            interaction.editReply({ content: "Cannot craft! Insufficient materials.", fetchReply: true, ephemeral: true });
                        }
                        
                    });
                });
            });
        break;
        case "scavenge":
            interaction.reply({ content: "Scavenging...", fetchReply: true, ephemeral: true }).then(m => {
                let a_id = interaction.options.get('a_id')?.value ?? null;
                quicksqlquery("SELECT * FROM players WHERE id=" + connection.escape(interaction.member.id), result => {
                    if(result[0].scavenged == "1") {
                        interaction.editReply({ content: "You cannot scavenge again in this phase.", fetchReply: true, ephemeral: true });
                        return;
                    }
                    
                    let skill = result[0].skill;
                    let inv = result[0].inventory;
                    quicksqlquery("SELECT * FROM areas WHERE a_id=" + connection.escape(a_id), result => {
                        let scav = result[0].scavenge.split(";");
                        let relScav = scav[skill];
                        if(!relScav) {
                            interaction.editReply({ content: "It seems you cannot scavenge this area at this level.", fetchReply: true, ephemeral: true });
                        } else {
                            quicksql("UPDATE players SET scavenged=1 WHERE id=" + connection.escape(interaction.member.id));
                            console.log("Scavening: " + relScav);
                            let relScavSplit = relScav.split(",").map(el => {
                                let sp = el.split(":");
                                let sp2 = sp[1].split("x");
                                let chance = sp[0];
                                let material = sp2[0];
                                let lower = 1;
                                let upper = 1;
                                if(sp2[1]) {
                                    let sp3 = sp2[1].split("-");
                                    lower = sp3[0];
                                    if(sp3[1]) {
                                        upper = sp3[1];
                                    } else {
                                        upper = lower;
                                    }
                                }
                                return [chance, material, lower, upper];
                            });
                            console.log("Converted: " + relScavSplit);
                            
                            let scavengeRes = [];
                            for(let el in relScavSplit) {
                                let chance = +relScavSplit[el][0];
                                let rch = Math.random();
                                if(chance > rch) {
                                    console.log("yes!", chance, rch);
                                    let count = Math.floor(Math.random() * (+relScavSplit[el][3])) + (+relScavSplit[el][2]);
                                    scavengeRes.push([relScavSplit[el][1], count]);
                                    while(count > 0) {
                                        count--;
                                        inv += "," + relScavSplit[el][1];
                                    }
                                } else {
                                    console.log("nope", chance, rch);
                                }
                            }
                            
                            quicksql("UPDATE players SET inventory=" + connection.escape(inv) + " WHERE id=" + connection.escape(interaction.member.id));
                            if(scavengeRes.length) interaction.editReply({ content: "Scavenged! Got " + scavengeRes.map(el => materialCache[+el[0]] + " x" + el[1]).join(", ") + "!", fetchReply: true, ephemeral: true });
                            else interaction.editReply({ content: "Scavenged! Got nothing!", fetchReply: true, ephemeral: true });
                            
                        }
                    });
                });
            });
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
    client.application?.commands.create({
        name: 'list',
        description: 'Lists all signed up players'
    });
    client.application?.commands.create({
        name: 'invsee',
        description: 'Lists all signed up players and their inventory data'
    });
    client.application?.commands.create({
        name: 'inventory',
        description: 'Shows your current inventory.'
    });
    client.application?.commands.create({
        name: 'reset',
        description: 'Resets the game'
    });
    client.application?.commands.create({
        name: 'register_material',
        description: 'Registers a new material.',
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "m_id",
                description: "The id of the material.",
                required: true
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "name",
                description: "The name of the material.",
                required: true
            }
        ]
    });
    client.application?.commands.create({
        name: 'delete_material',
        description: 'Deletes a material.',
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "m_id",
                description: "The id of the material.",
                required: true
            }
        ]
    });
    client.application?.commands.create({
        name: 'list_materials',
        description: 'Lists all materials'
    });
    client.application?.commands.create({
        name: 'register_area',
        description: 'Registers a new area.',
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "a_id",
                description: "The id of the area.",
                required: true
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "name",
                description: "The name of the area.",
                required: true
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "scavenge",
                description: "The scavenge data.",
                required: true
            }
        ]
    });
    client.application?.commands.create({
        name: 'delete_area',
        description: 'Deletes an area.',
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "a_id",
                description: "The id of the area.",
                required: true
            }
        ]
    });
    client.application?.commands.create({
        name: 'list_areas',
        description: 'Lists all areas'
    });
    client.application?.commands.create({
        name: 'register_recipe',
        description: 'Registers a new recipe.',
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "r_id",
                description: "The id of the recipe.",
                required: true
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "input",
                description: "The recipe inputs (comma separated)",
                required: true
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "output",
                description: "The recipe outputs (comma separated)",
                required: true
            }
        ]
    });
    client.application?.commands.create({
        name: 'delete_recipe',
        description: 'Deletes a recipe.',
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "r_id",
                description: "The id of the recipe.",
                required: true
            }
        ]
    });
    client.application?.commands.create({
        name: 'craft',
        description: 'Craft a recipe.',
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "r_id",
                description: "The id of the recipe.",
                required: true
            }
        ]
    });
    client.application?.commands.create({
        name: 'scavenge',
        description: 'Scavenge an area.',
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "a_id",
                description: "The id of the area.",
                required: true
            }
        ]
    });
    client.application?.commands.create({
        name: 'list_recipes',
        description: 'Lists all recipes'
    });
    client.application?.commands.create({
        name: 'invadd',
        description: 'Adds a material to a players inventory.',
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "m_id",
                description: "The id of the material.",
                required: true
            },
            {
                type: ApplicationCommandOptionType.User,
                name: "player",
                description: "The targeted player.",
                required: true
            }
        ]
    });
    client.application?.commands.create({
        name: 'invrem',
        description: 'Remove a material from a players inventory.',
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "m_id",
                description: "The id of the material.",
                required: true
            },
            {
                type: ApplicationCommandOptionType.User,
                name: "player",
                description: "The targeted player.",
                required: true
            }
        ]
    });
    client.application?.commands.create({
        name: 'lock',
        description: 'Locks scavenging'
    });
    client.application?.commands.create({
        name: 'unlock',
        description: 'Unlocks scavenging'
    });
    client.application?.commands.create({
        name: 'set_skill',
        description: 'Sets a players scavenge skill.',
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "skill",
                description: "The skill value.",
                required: true
            },
            {
                type: ApplicationCommandOptionType.User,
                name: "player",
                description: "The targeted player.",
                required: true
            }
        ]
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
