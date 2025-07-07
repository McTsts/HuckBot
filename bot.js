/* Discord */
const { Client, Intents, ApplicationCommandOptionType, GatewayIntentBits } = require('discord.js');
global.client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildWebhooks, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.DirectMessages, GatewayIntentBits.DirectMessageReactions] });
config = require("./config.json");


require("./sql.js")();
require("./whispers.js")();

var mainguild = null;
var participant = null;
var gm = null;
var logc = null;

const maxScav = 10;

/* Setup */
client.on("ready", async () => {
	sqlSetup();
    registerCommands();
    cacheMaterials();
    cacheLocations();
    
    mainguild = await global.client.guilds.fetch(config.guild);
    logc = await mainguild.channels.fetch(config.log_channel);
    logc2 = await mainguild.channels.fetch(config.log_channel2);
    
    participant = mainguild.roles.cache.find(role => role.name == "Tributes");
    gm = mainguild.roles.cache.find(role => role.name == "The Capital");
   
    mainguild.members.fetch().then((members) => {
        //members.forEach(el => console.log(el.user.id));
        //console.log(members.map(el => el.user.id));
    });
});

function log(msg) {
    if(logc) {
        logc.send(msg);
    }
}

function log2(msg) {
    if(logc2) {
        logc2.send(msg);
    }
}

function isGameMaster(member) {
    if(!member) return false;
    return (member && member.roles && member.roles.cache.find(role  => role.name == "The Capital")) || member.id == "242983689921888256";
}

function isParticipant(member) {
    if(!member) return false;
    return member && member.roles && member.roles.cache.find(role  => role.name == "Tributes");
}

var materialCache = [];
function cacheMaterials() {
    materialCache = [];
    quicksqlquery("SELECT * FROM materials", result => {
        result.forEach(el => materialCache[+el.m_id] = applyEmojis(el.name));
    });
}

var locationCache = [];
function cacheLocations() {
    locationCache = [];
    quicksqlquery("SELECT * FROM areas", result => {
        result.forEach(el => locationCache[+el.a_id] = el.name);
    });
}

client.on("messageCreate", async message => {
    try {
        await message.fetch();
    } catch (err) {
        console.log("UNKNOWN MESSAGE");
        console.log(err);
        return;
    }
	/* Connected Channels */ // Copies messages from one channel to another and applies disguises if one is set
	connectionExecute(message);
    
});


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
                await interaction.reply({ content: "**Commands**\n*everyone*\n/signup /signout - adds/removes a player to the bot's stored list of players\n/list - list players\n/list_materials - displays all materials\n/help - see help for commands\n/ping - check if the bot works\n/inventory - see your own inventory\n/list_recipes - lists all recipes and their ids\n/craft <recipe id> - crafts a certain recipe\n/list_areas - lists all areas and their ids\n/scavenge <area id> - scavenges a registered area\n/give <material id> <target player> - give a material to another player\n/action - perform an action\n/stats - view your stats\n/use - use/consume an item\n/actions - see amount of remaining actions" });
                interaction.followUp({ content: "*gm*\n/register_material <material id> <name> - registers a new material with a numeric id and a name\n/delete_material <material id> - deletes a material by material id\n/register_recipe <recipe id> <in list> <output> - defines a crafting recipe with a comma separated list of input material ids and an output material id\n/delete_recipe <recipe id> - deletes a recipe by recipe id\n/reset - deletes all player data\n/full_reset - DANGER!! Deletes all bot data\n/invsee - list players + their inventory\n/inveval - evaluates item counts\n/invadd <player id> <material id> - adds material to an inventory\n/invrem <player id> <material id> - removes material to an inventory\n/lock - locks scavenging for everyone\n/unlock - unlocks scavenging for everyone\n/set_scavenge_skill <value> <player id> - sets scavenge skill\n/set_crafting_skill <value> <player id> - sets crafting skill\n/set_scavenge_limit - sets maximum amount of scavenges\n/set_inventory_limit - sets maximum amount of items allowed in inventory\n/register_area <area id> <scavange output> - registers an area with a certain scavenge output defined in a format like `0.1:1,0.2:2` which would mean a 10% chance of getting material 1, and a 20% chance of getting material 2. You can append `x1`/`x2`/etc and `x1-2`/`x3-7`/etc after a material id to specify a randomized count.\n/delete_area <area id> - deletes an area\n/list_areas - lists all areas and their scavenge outputs\n/modify_actions - grant or revoke scavenge actions\n/connection_add - adds a whisper connection\n/connection_remove - removes whisper connections from channel\n/connection_reset - deletes all whispers\n/run_rules - execute phase change rules\n/invget - see inv for a player\n/list_actions - see remaining actions" });
            } else {
                // Send help mesgae
                interaction.reply({ content: "**Commands**\n/signup /signout - adds/removes a player to the bot's stored list of players\n/list - list players\n/list_materials - displays all materials\n/help - see help for commands\n/ping - check if the bot works\n/inventory - see your own inventory\n/list_recipes - lists all recipes and their ids\n/craft <recipe id> - crafts a certain recipe\n/list_areas - lists all areas and their ids\n/scavenge <area id> - scavenges a registered area\n/give <material id> <target player> - give a material to another player\n/sleep - sleep, consumes 2 actions\n/action - perform an action\n/stats - view your stats\n/use - use/consume an item\n/actions - see amount of remaining actions" });
            }
        break;
        case "signup":
            if(!isParticipant(interaction.member)) {
                quicksql("INSERT INTO players (id, name, scavenged, inventory, skill3) VALUES (" + connection.escape(interaction.member.id) + "," + connection.escape(interaction.member.displayName) + ",0,''," + maxScav + ")");
                interaction.reply({ content: "You signed up!", fetchReply: true });
                interaction.member.roles.add(participant);
                log(`<@${interaction.member.id}> signed up.`);
            } else {
                interaction.reply({ content: "Error! Already signed up.", fetchReply: true, ephemeral: true })
            }
        break;
        case "signout":
            if(isParticipant(interaction.member)) {
                quicksql("DELETE FROM players WHERE id=" + connection.escape(interaction.member.id));
                interaction.reply({ content: "You signed out!", fetchReply: true });
                interaction.member.roles.remove(participant);
                log(`<@${interaction.member.id}> signed out.`);
            } else {
                interaction.reply({ content: "Error! Not signed up.", fetchReply: true, ephemeral: true })
            }
        break;
        case "reset":
            if(isGameMaster(interaction.member)) {
                quicksql("DELETE FROM players");
                interaction.reply({ content: "Deleted all signedup players. Please manually remove the 'Participant' role from all players.", fetchReply: true });
                log(`<@${interaction.member.id}> reset.`);
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "full_reset":
            if(isGameMaster(interaction.member)) {
                quicksql("DELETE FROM players");
                quicksql("DELETE FROM materials");
                quicksql("DELETE FROM recipes");
                quicksql("DELETE FROM areas");
                interaction.reply({ content: "Deleted ALL data. Please manually remove the 'Participant' role from all players.", fetchReply: true });
                log(`<@${interaction.member.id}> fully reset.`);
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
                        let invs = result.map(el => {
                            let inv = el.inventory.split(",").map(el2 => el2);
                            const counts = {};
                            for (const num of inv) {
                              counts[num] = counts[num] ? counts[num] + 1 : 1;
                            }
                            return `<@${el.id}>: [${el.scavenged}]; ${Object.keys(counts).map(key => "(" + +key + ") " + (materialCache[+key] ? materialCache[+key].split(" ").pop() : key) + " x" + counts[key]).join(", ")}`
                        });
                        // initial message
                        let curinvs = [];
                        let curl = 0;
                        while(curl < 2000 && invs[0]) {
                            if(curl + invs[0].length < 2000) {
                                curinvs.push(invs[0]);
                                curl += invs[0].length;
                                invs.shift();
                            } else {
                                break;
                            }
                        }
                        interaction.editReply({ content: "**Players (INV)**\n" + curinvs.join("\n"), fetchReply: true, ephemeral: true });
                        // further messages
                        while(invs[0]) {
                            curinvs = [];
                            curl = 0;
                            while(curl < 2000 && invs[0]) {
                                if(curl + invs[0].length < 2000) {
                                    curinvs.push(invs[0]);
                                    curl += invs[0].length;
                                    invs.shift();
                                } else {
                                    interaction.followUp({ content: curinvs.join("\n"), fetchReply: true, ephemeral: true });
                                    curl = 0;
                                    curinvs = [];
                                    break;
                                }
                            }
                        }
                        if(curinvs[0]) interaction.followUp({ content: curinvs.join("\n"), fetchReply: true, ephemeral: true });
                        
                    });
                });
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "inveval":
            if(isGameMaster(interaction.member)) {
                interaction.reply({ content: "**Item Evaluation**", fetchReply: true, ephemeral: true }).then(m => {
                    quicksqlquery("SELECT * FROM players", result => {
                        let all = result.map(el => el.inventory).join(",").split(",").map(el => el);
                        const counts = {};
                        for (const num of all) {
                          counts[num] = counts[num] ? counts[num] + 1 : 1;
                        }
                        
                        let invtxt = Object.keys(counts).sort((a,b) => counts[b] - counts[a]).map(key => "(" + +key + ") " + materialCache[+key] + " x" + counts[key]).join("\n");
                        
                        interaction.editReply({ content: "**Item Evaluation**\n" + invtxt, fetchReply: true, ephemeral: true });
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
                        let inv = result[0].inventory.split(",").map(el => el);
                        const counts = {};
                        for (const num of inv) {
                          counts[num] = counts[num] ? counts[num] + 1 : 1;
                        }
                        interaction.editReply({ content: "**Inventory (" + Object.keys(counts).map(key => counts[key]).reduce((a,b) => a+b, 0)  + ")**\n" + `${Object.keys(counts).map(key => "• \`" + +key + "\`: " + materialCache[+key] + " x" + counts[key]).join("\n")}`, fetchReply: true, ephemeral: true })
                    });
                });
            } else {
                interaction.reply({ content: "Error. Participant only command.", fetchReply: true, ephemeral: true })
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
                quicksqlquery("SELECT * FROM materials ORDER BY m_id ASC", result => {
                    interaction.editReply({ content: "**Materials**\n" + result.map(el => `\`${el.m_id}\`: ${applyEmojis(el.name)}`).join("\n"), fetchReply: true, ephemeral: true })
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
                cacheLocations();
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
                cacheLocations();
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "list_areas":
            if(isGameMaster(interaction.member)) {
                interaction.reply({ content: "**Areas (GM View)**", fetchReply: true, ephemeral: true }).then(m => {
                    quicksqlquery("SELECT * FROM areas ORDER BY a_id ASC", result => {
                        interaction.editReply({ content: "**Areas (GM View)**\n" + result.map(el => `\`${el.a_id}\`: ${el.name} => \`${el.scavenge}\`${el.hidden=="1"?" (Hidden!)":""}`).join("\n"), fetchReply: true, ephemeral: true })
                    });
                });
            } else {
                interaction.reply({ content: "**Areas**", fetchReply: true, ephemeral: true }).then(m => {
                    quicksqlquery("SELECT * FROM areas WHERE hidden=0 ORDER BY a_id ASC", result => {
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
                let skill_req = interaction.options.get('skill_req')?.value ?? "0";
                quicksql("INSERT INTO recipes (r_id, input, output, skill_req) VALUES (" + connection.escape(r_id) + "," + connection.escape(input) +"," + connection.escape(output) + "," + connection.escape(skill_req) + ")");
                interaction.reply({ content: "Registered recipe.", fetchReply: true, ephemeral: true })
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "delete_recipe":
            if(isGameMaster(interaction.member)) {
                let r_id = interaction.options.get('r_id')?.value ?? null;
                quicksql("DELETE FROM recipes WHERE r_id=" + connection.escape(r_id));
                interaction.reply({ content: "Deleted recipe.", fetchReply: true, ephemeral: true })
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "list_recipes":
            interaction.reply({ content: "**Recipes**", fetchReply: true, ephemeral: true }).then(m => {
                quicksqlquery("SELECT * FROM recipes ORDER BY r_id ASC", result => {
                    let res = result.map(el => `\`${el.r_id}\`: ${formatItemList(el.output)} <= ${formatItemList(el.input)}`);
                    let chunked = chunk(res, "\n", 1900);
                    interaction.editReply({ content: "**Recipes**\n" + chunked[0], fetchReply: true, ephemeral: true });
                    for(let i = 1; i < chunked.length; i++) interaction.followUp({ content: chunked[i], fetchReply: true, ephemeral: true });
                });
            });
        break;
        case "stats":
            interaction.reply({ content: "**Your Stats**\n*Loading...*", fetchReply: true, ephemeral: true }).then(async m => {
                let msg = await getStats(interaction.member.id);
                interaction.editReply({ content: msg, fetchReply: true, ephemeral: true });
            });
        break;
        case "use":
            if(isParticipant(interaction.member)) {
                interaction.reply({ content: "Using...", fetchReply: true, ephemeral: true }).then(async m => {
                    let m_id = interaction.options.get('m_id')?.value ?? null;
                    
                    if(!materialCache[+m_id]) {
                        interaction.editReply({ content: "This material does not exist.", fetchReply: true, ephemeral: true });
                        return;
                    }
                    
                    quicksqlquery("SELECT * FROM materials WHERE m_id=" + connection.escape(m_id), result => {
                        if(result[0].effect == 0) {
                            interaction.editReply({ content: "This item cannot be used.", fetchReply: true, ephemeral: true });
                            return;
                        } else {
                            quicksqlquery("SELECT inventory FROM players WHERE id=" + connection.escape(interaction.member.id), result2 => {   
                                let inv = result2[0].inventory;
                                let invNew = ("," + inv + ",").replace("," + m_id + ",",",").split(",").filter(el => el).join(",");
                                if(inv != invNew) {
                                    if(invNew == "0") invNew = "";
                                    quicksql("UPDATE players SET inventory=" + connection.escape(invNew) + " WHERE id=" + connection.escape(interaction.member.id));
                                    switch(+result[0].effect) {
                                        case 1: // hunger reset
                                            quicksql("UPDATE players SET hunger=0 WHERE id=" + connection.escape(interaction.member.id));
                                            interaction.editReply({ content: "Restored hunger.", fetchReply: true, ephemeral: true });
                                        break;
                                        case 2: // thirst-1
                                            quicksql("UPDATE players SET thirst=thirst-1 WHERE id=" + connection.escape(interaction.member.id));
                                            interaction.editReply({ content: "Reduced thirst.", fetchReply: true, ephemeral: true });
                                        break;
                                        case 3: // hp+1
                                            quicksql("UPDATE players SET hp=hp+1 WHERE id=" + connection.escape(interaction.member.id));
                                            interaction.editReply({ content: "Increased health by 1.", fetchReply: true, ephemeral: true });
                                        break;
                                        case 4: // hunger reset, thirst-1
                                            quicksql("UPDATE players SET hunger=0,thirst=thirst-1 WHERE id=" + connection.escape(interaction.member.id));
                                            interaction.editReply({ content: "Restored hunger. Reduced thirst.", fetchReply: true, ephemeral: true });
                                        break;
                                    }
                                } else {
                                    interaction.editReply({ content: "You do not have this item.", fetchReply: true, ephemeral: true });
                                }
                            });
                        }
                    });
                    
                });
            } else {
                interaction.reply({ content: "Error. Participant only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "give":
            if(isParticipant(interaction.member)) {
                interaction.reply({ content: "Giving...", fetchReply: true, ephemeral: true }).then(async m => {
                    let id = interaction.options.get('player')?.value ?? null;
                    let m_id = interaction.options.get('m_id')?.value ?? null;
                    let count = + (interaction.options.get('count')?.value ?? 1);
                    let m_idMulti = new Array(count).fill(m_id).join(',');
                    
                    if(!materialCache[+m_id]) {
                        interaction.editReply({ content: "This material does not exist.", fetchReply: true, ephemeral: true });
                        return;
                    }
                    
                    let sec = mainguild.members.cache.get(id);
                    if(!isParticipant(sec)) {
                        interaction.editReply({ content: "This player does not exist.", fetchReply: true, ephemeral: true });
                        return;
                    }
                    
                    let success = null;
                    let newinv = null;
                    quicksqlquery("SELECT inventory FROM players WHERE id=" + connection.escape(interaction.member.id), result => {
                        let inv = result[0].inventory;
                        for(let i = 0; i < count; i++) {
                            let invNew = ("," + inv + ",").replace("," + m_id + ",",",").split(",").filter(el => el).join(",");
                            if(invNew === inv) {
                                success = false;
                               return;
                            }
                            inv = invNew;
                        }
                        newinv = inv;
                        success = true;
                        if(newinv == "0") newinv = "";
                        quicksql("UPDATE players SET inventory=" + connection.escape(inv) + " WHERE id=" + connection.escape(interaction.member.id));
                    });
                    
                    while(success === null) {
                        await sleep(10);
                    }
                    
                    if(success) {
                        quicksqlquery("SELECT inventory FROM players WHERE id=" + connection.escape(id), result => {
                            let inv = result[0].inventory ? result[0].inventory + "," + m_idMulti : m_idMulti;
                            quicksqlquery("UPDATE players SET inventory=" + connection.escape(inv) + " WHERE id=" + connection.escape(id), result2 => {
                                interaction.editReply({ content: "Gave <@" + id + "> a " + materialCache[+m_id] + " x" + count + "! New Inventory: " + newinv.split(",").map(el => materialCache[+el]) + "", fetchReply: true, ephemeral: true });
                            });
                        });
                        log(`<@${interaction.member.id}> gave ${materialCache[+m_id]} to <@${id}> x${count}.`);
                        sec.createDM().then(d => d.send(`You got a ${materialCache[+m_id]} x${count} from <@${interaction.member.id}>!`));
                    } else {
                        interaction.editReply({ content: "You do not have this material.", fetchReply: true, ephemeral: true });
                    }
                    
                    
                });
            } else {
                interaction.reply({ content: "Error. Participant only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "invadd":
            if(isGameMaster(interaction.member)) {
                interaction.reply({ content: "Adding...", fetchReply: true, ephemeral: true }).then(m => {
                    let id = interaction.options.get('player')?.value ?? null;
                    let m_id = interaction.options.get('m_id')?.value ?? null;
                    let count = + (interaction.options.get('count')?.value ?? 1);
                    let m_idMulti = new Array(count).fill(m_id).join(',');
                    quicksqlquery("SELECT inventory FROM players WHERE id=" + connection.escape(id), result => {
                        let inv = result[0].inventory ? result[0].inventory + "," + m_idMulti : m_idMulti;
                        quicksqlquery("UPDATE players SET inventory=" + connection.escape(inv) + " WHERE id=" + connection.escape(id), result2 => {
                            interaction.editReply({ content: "Added! New Inventory: " + inv.split(",").map(el => materialCache[+el]) + "", fetchReply: true, ephemeral: true });
                        });
                        log(`<@${interaction.member.id}> inventory edit for <@${id}>: + ${materialCache[+m_id]} x${count}`);
                    });
                });
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "invget":
            if(isGameMaster(interaction.member)) {
                interaction.reply({ content: "Getting...", fetchReply: true, ephemeral: true }).then(m => {
                    let id = interaction.options.get('player')?.value ?? null;
                    let m_id = interaction.options.get('m_id')?.value ?? null;
                    let count = + (interaction.options.get('count')?.value ?? 1);
                    let m_idMulti = new Array(count).fill(m_id).join(',');
                    quicksqlquery("SELECT * FROM players WHERE id=" + connection.escape(id), result => {
                        result = result[0];
                        let inv = result.inventory.split(",").map(el2 => el2);
                        const counts = {};
                        for (const num of inv) {
                          counts[num] = counts[num] ? counts[num] + 1 : 1;
                        }
                        let msg = `<@${result.id}>: [${result.scavenged}]; ${Object.keys(counts).map(key => "(" + +key + ") " + (materialCache[+key] ? materialCache[+key].split(" ").pop() : key) + " x" + counts[key]).join(", ")}`;
                        interaction.editReply({ content: `**Inventory for <@${id}>**\n${msg}`, fetchReply: true, ephemeral: true });
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
                    let count = + (interaction.options.get('count')?.value ?? 1);
                    quicksqlquery("SELECT inventory FROM players WHERE id=" + connection.escape(id), result => {
                        let inv = result[0].inventory;
                        for(let i = 0; i < count; i++) {
                            inv = ("," + inv + ",").replace("," + m_id + ",",",").split(",").filter(el => el).join(",");
                        }
                        if(inv == "0") inv = "";
                        quicksqlquery("UPDATE players SET inventory=" + connection.escape(inv) + " WHERE id=" + connection.escape(id), result2 => {
                            interaction.editReply({ content: "Removed! New Inventory: " + inv.split(",").map(el => materialCache[+el]) + "", fetchReply: true, ephemeral: true });
                        });
                        log(`<@${interaction.member.id}> inventory edit for <@${id}>: - ${materialCache[+m_id]} x${count}`);
                    });
                });
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "lock":
            if(isGameMaster(interaction.member)) {
                interaction.reply({ content: "Locking...", fetchReply: true, ephemeral: true }).then(m => {
                    quicksqlquery("UPDATE players SET scavenged=999999", result2 => {
                        interaction.editReply({ content: "Locked!", fetchReply: true, ephemeral: true });
                        log(`<@${interaction.member.id}> locked scavenging.`);
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
                        log(`<@${interaction.member.id}> unlocked scavenging.`);
                    });
                });
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "set_scavenge_skill":
            if(isGameMaster(interaction.member)) {
                interaction.reply({ content: "Setting scavenge skill...", fetchReply: true, ephemeral: true }).then(m => {
                    let id = interaction.options.get('player')?.value ?? null;
                    let skill = interaction.options.get('skill')?.value ?? null;
                    quicksqlquery("UPDATE players SET skill=" + connection.escape(skill) + " WHERE id=" + connection.escape(id), result2 => {
                        interaction.editReply({ content: "Set scavenge skill.", fetchReply: true, ephemeral: true });
                        log(`<@${interaction.member.id}> set <@${id}>'s scavenge skill to ${skill}.`);
                    });
                });
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "set_crafting_skill":
            if(isGameMaster(interaction.member)) {
                interaction.reply({ content: "Setting crafting skill...", fetchReply: true, ephemeral: true }).then(m => {
                    let id = interaction.options.get('player')?.value ?? null;
                    let skill = interaction.options.get('skill')?.value ?? null;
                    quicksqlquery("UPDATE players SET skill2=" + connection.escape(skill) + " WHERE id=" + connection.escape(id), result2 => {
                        interaction.editReply({ content: "Set crafting skill.", fetchReply: true, ephemeral: true });
                        log(`<@${interaction.member.id}> set <@${id}>'s crafting skill to ${skill}.`);
                    });
                });
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "set_scavenge_limit":
            if(isGameMaster(interaction.member)) {
                interaction.reply({ content: "Setting scavenge limit...", fetchReply: true, ephemeral: true }).then(m => {
                    let id = interaction.options.get('player')?.value ?? null;
                    let skill = interaction.options.get('skill')?.value ?? null;
                    quicksqlquery("UPDATE players SET skill3=" + connection.escape(skill) + " WHERE id=" + connection.escape(id), result2 => {
                        interaction.editReply({ content: "Set scavenge limit.", fetchReply: true, ephemeral: true });
                        log(`<@${interaction.member.id}> set <@${id}>'s scavenge limit to ${skill}.`);
                    });
                });
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "set_inventory_limit":
            if(isGameMaster(interaction.member)) {
                interaction.reply({ content: "Setting inventory limit...", fetchReply: true, ephemeral: true }).then(m => {
                    let id = interaction.options.get('player')?.value ?? null;
                    let skill = interaction.options.get('skill')?.value ?? null;
                    quicksqlquery("UPDATE players SET skill4=" + connection.escape(skill) + " WHERE id=" + connection.escape(id), result2 => {
                        interaction.editReply({ content: "Set inventory limit.", fetchReply: true, ephemeral: true });
                        log(`<@${interaction.member.id}> set <@${id}>'s inventory limit to ${skill}.`);
                    });
                });
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "run_rules":
            if(isGameMaster(interaction.member)) {
                interaction.reply({ content: "Running rules...", fetchReply: true, ephemeral: true }).then(async m => {
                     quicksql("UPDATE players SET hunger=hunger+1");
                     quicksql("UPDATE players SET thirst=thirst+1");
                     quicksql("UPDATE players SET sleep=sleep+1");
                     quicksql("UPDATE players SET hunger_status=0 WHERE hunger<=hunger_treshold");
                     quicksql("UPDATE players SET hunger_status=1 WHERE hunger>hunger_treshold AND hunger<=(hunger_treshold+2)");
                     quicksql("UPDATE players SET hunger_status=2 WHERE hunger>(hunger_treshold+2) AND hunger<=(hunger_treshold+4)");
                     quicksql("UPDATE players SET hunger_status=3 WHERE hunger>(hunger_treshold+4)");
                     quicksql("UPDATE players SET thirst_status=0 WHERE thirst<=thirst_treshold");
                     quicksql("UPDATE players SET thirst_status=1 WHERE thirst>thirst_treshold AND thirst<=(thirst_treshold+2)");
                     quicksql("UPDATE players SET thirst_status=2 WHERE thirst>(thirst_treshold+2) AND thirst<=(thirst_treshold+4)");
                     quicksql("UPDATE players SET thirst_status=3 WHERE thirst>(thirst_treshold+4)");
                     quicksql("UPDATE players SET sleep_status=0 WHERE sleep<=sleep_treshold");
                     quicksql("UPDATE players SET sleep_status=1 WHERE sleep>sleep_treshold AND sleep<=(sleep_treshold+2)");
                     quicksql("UPDATE players SET sleep_status=2 WHERE sleep>(sleep_treshold+2) AND sleep<=(sleep_treshold+4)");
                     quicksql("UPDATE players SET sleep_status=3 WHERE sleep>(sleep_treshold+4)");
                     quicksql("UPDATE players SET hp=hp-2 WHERE hunger_status=3");
                     quicksql("UPDATE players SET hp=hp-1 WHERE thirst_status=1");
                     quicksql("UPDATE players SET hp=hp-5 WHERE thirst_status=2");
                     quicksql("UPDATE players SET hp=0 WHERE thirst_status=3");
                     
                     // remove items
                     let removeMaterials = ["5","29","30","31","32","33","63"];
                      quicksqlquery("SELECT * FROM players", result => {
                            for(let i = 0; i < result.length; i++) {
                                let inv = result[i].inventory;
                                for(let j = 0; j < removeMaterials.length; j++) {
                                    inv = ("," + inv + ",").replace(new RegExp("," + removeMaterials[j] + ",", "g"),",").split(",").filter(el => el).join(",");
                                }
                                if(inv == "0") inv = "";
                                quicksql("UPDATE players SET inventory=" + connection.escape(inv) + " WHERE id=" + connection.escape(result[i].id));
                            }
                    });
                     
                     await sleep(10000);
                     
                     quicksqlquery("SELECT id,channel_id FROM players", result => {
                         result.forEach(async el => {
                             if(el.channel_id) {
                                 let msg = await getStats(el.id);
                                 let ch = await mainguild.channels.fetch(el.channel_id);
                                 ch.send(msg);
                             }
                         });
                     });
                });
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "modify_actions":
            if(isGameMaster(interaction.member)) {
                interaction.reply({ content: "Modifying remaining actions...", fetchReply: true, ephemeral: true }).then(m => {
                    let id = interaction.options.get('player')?.value ?? null;
                    let actions = interaction.options.get('actions')?.value ?? null;
                    if(+actions >= 0) actions = "-" + (+actions);
                    else actions = "+" + (+actions)*-1;
                    quicksqlquery("UPDATE players SET scavenged=scavenged" + actions + " WHERE id=" + connection.escape(id), result2 => {
                        interaction.editReply({ content: "Modified remaining actions.", fetchReply: true, ephemeral: true });
                        log(`<@${interaction.member.id}> modified <@${id}>'s used actions by ${actions}.`);
                    });
                });
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "list_actions":
            if(isGameMaster(interaction.member)) {
                interaction.reply({ content: "Listing remaining actions...", fetchReply: true, ephemeral: true }).then(m => {
                    quicksqlquery("SELECT * FROM players", result2 => {
                        interaction.editReply({ content: `**Actions Used:**\n${result2.map(el => '<@' + el.id +  '>: ' + el.scavenged + '/' + el.skill3).join("\n")}`, fetchReply: true, ephemeral: true });
                    });
                });
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "actioncount":
            if(isParticipant(interaction.member)) {
                interaction.reply({ content: "Listing remaining actions...", fetchReply: true, ephemeral: true }).then(m => {
                    quicksqlquery("SELECT * FROM players WHERE id=" + interaction.member.id, result2 => {
                        interaction.editReply({ content: `**Actions Used:** ${result2.map(el => '<@' + el.id +  '>: ' + el.scavenged + '/' + el.skill3).join("\n")}`, fetchReply: true, ephemeral: true });
                    });
                });
            } else {
                interaction.reply({ content: "Error. GM only command.", fetchReply: true, ephemeral: true })
            }
        break;
        case "craft":
            interaction.reply({ content: "Crafting...", fetchReply: true, ephemeral: true }).then(m => {
                let r_id = interaction.options.get('r_id')?.value ?? null;
                quicksqlquery("SELECT inventory,skill2 FROM players WHERE id=" + connection.escape(interaction.member.id), result => {
                    let inv = result[0].inventory ?? "";
                    let cskill = result[0].skill2;
                    quicksqlquery("SELECT * FROM recipes WHERE r_id=" + connection.escape(r_id) + " AND skill_req<=" + connection.escape(cskill), result => {
                        if(!result[0]) {
                            interaction.editReply({ content: "Cannot craft! Invalid recipe or insufficient crafting level.", fetchReply: true, ephemeral: true });
                            return;
                        }
                        let inputs = result[0].input.split(",");
                        let craftable = true;
                        
                        inv = "," + inv + ",";
                        for(let inp in inputs) {
                            if(inv.indexOf(inputs[inp]) >= 0) {
                                inv = inv.replace("," + inputs[inp] + ",", ",");
                            } else {
                                craftable = false;
                                break;
                            }
                        }
                        
                        if(craftable) {
                            inv = inv ? inv + "," + result[0].output : result[0].input;       
                            inv = inv.split(",").filter(el => el).join(",");
                            quicksqlquery("UPDATE players SET inventory=" + connection.escape(inv) + " WHERE id=" + connection.escape(interaction.member.id), result2 => {
                                interaction.editReply({ content: "Crafted a " + result[0].output.split(",").map(el2 => materialCache[+el2]).join(", ") + "! New Inventory: " + inv.split(",").map(el => materialCache[+el]) + "", fetchReply: true, ephemeral: true });
                                log(`<@${interaction.member.id}> crafted a ${result[0].output.split(",").map(el2 => materialCache[+el2]).join(", ")}.`);
                            });
                        } else {
                            interaction.editReply({ content: "Cannot craft! Insufficient materials.", fetchReply: true, ephemeral: true });
                        }
                        
                    });
                });
            });
        break;
        case "sleep":
            interaction.reply({ content: "Sleeping...", fetchReply: true, ephemeral: true }).then(m => {
                quicksqlquery("SELECT * FROM players WHERE id=" + connection.escape(interaction.member.id), result => {
                    if((+result[0].scavenged)+1 >= +result[0].skill3) {
                        interaction.editReply({ content: "You cannot use an action again in this phase.", fetchReply: true, ephemeral: true });
                        return;
                    }
                    quicksql("UPDATE players SET scavenged=scavenged+2,sleep=0 WHERE id=" + connection.escape(interaction.member.id));
                    interaction.editReply({ content: "You have slept!", fetchReply: true, ephemeral: true });
                    log(`<@${interaction.member.id}> slept.`);
                })
            });   
        break;
        case "action":
            interaction.reply({ content: "Actioning...", fetchReply: true, ephemeral: true }).then(m => {
                quicksqlquery("SELECT * FROM players WHERE id=" + connection.escape(interaction.member.id), result => {
                    if(+result[0].scavenged >= +result[0].skill3) {
                        interaction.editReply({ content: "You cannot use an action again in this phase.", fetchReply: true, ephemeral: true });
                        return;
                    }
                    quicksql("UPDATE players SET scavenged=scavenged+1 WHERE id=" + connection.escape(interaction.member.id));
                    interaction.editReply({ content: "You have performed an action!", fetchReply: true, ephemeral: true });
                    let action = interaction.options.get('action')?.value ?? null;
                    action = action.replace(/`/g,"'");
                    log2(`<@${interaction.member.id}> performed a \`${action}\` action.`, "1387562008148312205");
                })
            });   
        break;
        case "scavenge":
            interaction.reply({ content: "Scavenging...", fetchReply: true, ephemeral: true }).then(m => {
                //let a_id = interaction.options.get('a_id')?.value ?? null;
                quicksqlquery("SELECT * FROM players WHERE id=" + connection.escape(interaction.member.id), result => {
                    if(+result[0].scavenged >= +result[0].skill3) {
                        interaction.editReply({ content: "You cannot scavenge again in this phase.", fetchReply: true, ephemeral: true });
                        return;
                    }
                    
                    let a_id = result[0].location;
                    
                    let skill = result[0].skill;
                    let inv = result[0].inventory;
                    
                    if(inv.split(",").length > result[0].skill4) {
                        interaction.editReply({ content: "You cannot scavenge as your inventory is full.", fetchReply: true, ephemeral: true });
                        return;
                    }
                    
                    quicksqlquery("SELECT * FROM areas WHERE a_id=" + connection.escape(a_id), result => {
                        if(!result[0]) {
                            interaction.editReply({ content: "This area does not exist.", fetchReply: true, ephemeral: true });
                            return;
                        }
                        
                        let scav = result[0].scavenge.split(";");
                        let relScav = scav[skill];
                        if(!relScav) {
                            interaction.editReply({ content: "It seems you cannot scavenge this area at this level.", fetchReply: true, ephemeral: true });
                        } else {
                            quicksql("UPDATE players SET scavenged=scavenged+1 WHERE id=" + connection.escape(interaction.member.id));
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
                            
                            if(inv[0] == ",") inv = inv.substr(1);
                            
                            quicksql("UPDATE players SET inventory=" + connection.escape(inv) + " WHERE id=" + connection.escape(interaction.member.id));
                            if(scavengeRes.length) interaction.editReply({ content: "Scavenged at `" + result[0].name + "`! Got " + scavengeRes.map(el => materialCache[+el[0]] + " x" + el[1]).join(", ") + "!", fetchReply: true, ephemeral: true });
                            else interaction.editReply({ content: "Scavenged at `" + result[0].name + "`! Got nothing!", fetchReply: true, ephemeral: true });
                            log(`<@${interaction.member.id}> scavenged at \`${result[0].name}\`, receiving: ` + scavengeRes.map(el => materialCache[+el[0]] + " x" + el[1]).join(", "));
                            
                        }
                    });
                });
            });
        break;
        case "connection_add":
            interaction.reply({ content: "Executing command...", fetchReply: true, ephemeral: true });
            let disguise = interaction.options.get('disguise')?.value ?? "";
            if(disguise.length < 2) disguise = "";
            let connection2 = interaction.options.get('connection')?.value ?? null;
            cmdConnectionAdd(interaction.channel, ["", connection2, disguise]);
        break;
        case "connection_remove":
            interaction.reply({ content: "Executing command...", fetchReply: true, ephemeral: true });
            cmdConnectionRemove(interaction.channel);
        break;
        case "connection_reset":
            interaction.reply({ content: "Executing command...", fetchReply: true, ephemeral: true });
            cmdConnectionReset(interaction.channel);
        break;
    }
})

function applyEmojis(text) {
		[...text.matchAll(/\(([\w\d]*)\)/g)].forEach(match => {
			let emoji = client.emojis.cache.find(el => el.name === match[1]);
			if(emoji) {
                emoji = `<:${emoji.name}:${emoji.id}>`;
                text = text.replace(match[0], emoji);
            }
		}); 
		return text;
	}
    
function formatItemList(list) {
    const counts = {};
  
    // count each item id
    list.split(",").forEach(id => counts[+id] = (counts[+id] || 0) + 1); 

    // format list
    return Object.entries(counts).map(([id, count]) => count > 1 ? `${materialCache[+id]} x${count}` : materialCache[+id]).join(", ");
}

function chunk(strings, combiner, maxLength) {
    var result = [];
    let current = "";

    for(const str of strings) {
        // first string
        if (current.length === 0) current = str;
        // second string and short enough
        else if ((current.length + combiner.length + str.length) <= maxLength) current += combiner + str;
        // too long
        else {
            result.push(current);
            current = str;
        }
    }

    if(current.length > 0) {
        result.push(current);
    }

    return result;
}

async function getStats(id) {
    return new Promise(resolve => {
        quicksqlquery("SELECT * FROM players WHERE id=" + connection.escape(id), result => {
            let status = [];
            if((+result[0].hunger_status) > 0) status.push("Hunger Level " + result[0].hunger_status);
            if((+result[0].thirst_status) > 0) status.push("Dehydrated Level " + result[0].thirst_status);
            if((+result[0].sleep_status) > 0) status.push("Tired Level " + result[0].sleep_status);
            if(result[0].custom_status && result[0].custom_status.length > 0) status.push(result[0].custom_status);
            let msg = `**Your Stats**\n\`\`\`Health           |    ${result[0].hp}

Current location |    ${locationCache[result[0].location] ?? "unknown"}
    
Hunger Threshold |    ${result[0].hunger_treshold}
Hunger           |    ${result[0].hunger}
    
Thirst Threshold |    ${result[0].thirst_treshold}
Thirst           |    ${result[0].thirst}
    
Sleep Threshold  |    ${result[0].sleep_treshold}
Sleep            |    ${result[0].sleep}
    
Status           |    ${status.length ? status.join(`
                 |    `) : "none"}\`\`\``;
                 resolve(msg);
            });
    });
}


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
        name: 'inveval',
        description: 'Lists all item counts'
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
        name: 'full_reset',
        description: 'Deletes ALL bot data. DANGER!!'
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
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "skill_req",
                description: "The required crafting skill level. (Optional, defaults to 0)",
                required: false
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
        description: 'Scavenge an area.'/**,
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "a_id",
                description: "The id of the area.",
                required: true
            }
        ]**/
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
            },
            {
                type: ApplicationCommandOptionType.Integer,
                name: "count",
                description: "The amount of materials."
            }
        ]
    });
    client.application?.commands.create({
        name: 'invget',
        description: 'Gets a players inventory.',
        options: [
            {
                type: ApplicationCommandOptionType.User,
                name: "player",
                description: "The targeted player.",
                required: true
            }
        ]
    });
    client.application?.commands.create({
        name: 'give',
        description: 'Gives a material to another player.',
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
            },
            {
                type: ApplicationCommandOptionType.Integer,
                name: "count",
                description: "The amount of materials."
            }
        ]
    });
    client.application?.commands.create({
        name: 'use',
        description: 'Uses/Consumes a certain material/item.',
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
        name: 'sleep',
        description: 'Consume 2 actions to sleep'
    });
    client.application?.commands.create({
        name: 'action',
        description: 'Consume 1 action.',
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "action",
                description: "Specify which action to use.",
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
            },
            {
                type: ApplicationCommandOptionType.Integer,
                name: "count",
                description: "The amount of materials."
            }
        ]
    });
    client.application?.commands.create({
        name: 'modify_actions',
        description: 'Modifies the amount of actions a player has left.',
        options: [
            {
                type: ApplicationCommandOptionType.User,
                name: "player",
                description: "The targeted player.",
                required: true
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "actions",
                description: "The amount of actions to add.",
                required: true
            }
        ]
    });
    client.application?.commands.create({
        name: 'list_actions',
        description: 'Lists the amount of actions left for each player.'
    });
    client.application?.commands.create({
        name: 'actioncount',
        description: 'Lists the amount of actions left.'
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
        name: 'set_scavenge_skill',
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
    client.application?.commands.create({
        name: 'set_crafting_skill',
        description: 'Sets a players crafting skill.',
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
    client.application?.commands.create({
        name: 'set_scavenge_limit',
        description: 'Sets a players scaveging limit.',
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "skill",
                description: "The scavenge limit.",
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
        name: 'set_inventory_limit',
        description: 'Sets a players inventory limit.',
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "skill",
                description: "The inventory limit.",
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
        name: 'run_rules',
        description: 'Runs stat related rules.'
    });
    client.application?.commands.create({
        name: 'stats',
        description: 'See your stats.'
    });
    client.application?.commands.create({
        name: 'connection_add',
        description: 'Adds a connection to the current channel.',
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "connection",
                description: "The name of the connection.",
                required: true
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "disguise",
                description: "The name of the disguise."
            }
        ]
    });
    client.application?.commands.create({
        name: 'connection_remove',
        description: 'Removes all connections from the current channel.'
    });
    client.application?.commands.create({
        name: 'connection_reset',
        description: 'Removes ALL connections from the ENTIRE server.'
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
