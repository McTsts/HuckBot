/*
	ripped from WWR
    https://github.com/WerewolvesRevamped/Werewolves-Bot/blob/master/utility/utility.js
    bad error handling cause some utils dont exist here
*/
module.exports = function() {
	

	/* Adds a connection */
	this.cmdConnectionAdd = function(channel, args, hidden = false) {
		// Check arguments
		if(!args[1]) { 
			channel.send("⛔ Syntax error. Not enough parameters!"); 
			return; 
		} else if(!args[2]) { 
			args[2] = ""; 
		}
		// Add connection to DB
		sql("INSERT INTO connected_channels (channel_id, id, name) VALUES (" + connection.escape(channel.id) + "," + connection.escape(args[1]) + "," + connection.escape(args[2]) + ")", result => {
			if(args[2] != "") { 
				// Connection w/ disguise
				if(!hidden) channel.send("✅ Added connection `" + args[1] + "` with disguise `" + toTitleCase(args[2]) + "`!");
				//log("Whispers > Created connection `" + args[1] + "` with disguise `" + toTitleCase(args[2]) + "`!");
			} else { 
				// Connection w/o disguise
				if(!hidden) channel.send("✅ Added connection `" + args[1] + "` with no disguise!");
				//log("Whispers > Created connection `" + args[1] + "` with no disguise!");
			}
		}, () => {
			// Couldn't add connection
			channel.send("⛔ Database error. Couldn't add connection `" + args[1] + "`!");
		});
	}
	
	/* Removes a connection */
	this.cmdConnectionRemove = function(channel) {
		// Remove connections from DB
		sql("DELETE FROM connected_channels WHERE channel_id = " + connection.escape(channel.id), result => {
			channel.send("✅ Removed all connections from this channel!");
			//log("Whispers > Removed connections from `" + channel.id + "`!");
		}, () => {
			// Database error
			channel.send("⛔ Database error. Couldn't remove connections!");
		});
	}
	
	/* Rests all connections */
	this.cmdConnectionReset = function(channel) {
		sql("DELETE FROM connected_channels", result => {
			channel.send("✅ Successfully reset connections!");
		}, () => {
			channel.send("⛔ Database error. Could not reset connections!");
		});
	}
	
	this.cmdWebhook = function(channel, member, args) {
		// Create a webhook for the author
		let webhookName = member ? member.displayName : client.user.username;
		let webhookAvatar = member ? member.user.displayAvatarURL() : client.user.displayAvatarURL();
		let webhookMsg = args.join(" ");
		webhookMsg = webhookMsg.replace(/:~/g, ":");
		if(!(webhookMsg.length > 0)) webhookMsg = "|| ||";
		channel.fetchWebhooks()
			.then(webhooks => {
				// search for webhook 
				let webhook = webhooks.find(w => w.name == webhookName);
				// webhook exists
				if(webhook) {
					webhook.send(webhookMsg);
				} else { // no webhook
					if(webhooks.size < 10) { // empty slot
						channel.createWebhook({name: webhookName, avatar: webhookAvatar})
						.then(webhook => {
							// Send webhook
							webhook.send(webhookMsg)
						})
						.catch(err => { 
							// Webhook couldn't be created
							//logO(err); 
							//sendError(messsage.channel, err, "Could not create webhook");
						});
					} else { // no empty slot
						channel.send("**" + webhookName + "**: " + webhookMsg);
						webhooks.first().delete();
					}
				}
			});
	}
	
	/* Copies over messages */
	this.connectionExecute = function(message) {
		if(connection && !message.author.bot) {
			// Find connection id(s)
			sql("SELECT id, name FROM connected_channels WHERE channel_id = " + connection.escape(message.channel.id), result => {
				// For each connection id, find each connected channel
				result.forEach(source => {
					sql("SELECT channel_id, name FROM connected_channels WHERE id = " + connection.escape(source.id), result => {
						// Write message in each channel
						result.forEach(async destination => {
							// Ignore if it's same channel as source
							if(destination.channel_id != message.channel.id) { 	
								// Create webhook
                                let disguiseName = source.name.replace(/\-/," ");
                                let disguiseAvatar = client.user.displayAvatarURL();
                                
                                // role icon
                                //let roleIcon = await getIconFromName(disguiseName);
                                //if(roleIcon) disguiseAvatar = roleIcon;

								let webhookName = disguiseName != "" ? toTitleCase(disguiseName) : message.member.displayName;
								let webhookAvatar = disguiseName != "" ? disguiseAvatar : message.author.displayAvatarURL();
								let webhookMsg = message.content;
								webhookMsg = webhookMsg.replace(/:~/g, ":");
                                
								
								message.guild.channels.cache.get(destination.channel_id).fetchWebhooks()
								.then(webhooks => {
									// search for webhook 
									let webhook = webhooks.find(w => w.name == webhookName);
									// webhook exists
									if(webhook) {
										webhook.send(webhookMsg);
									} else { // no webhook
										if(webhooks.size < 10) { // empty slot
											message.guild.channels.cache.get(destination.channel_id).createWebhook({name: webhookName, avatar: webhookAvatar})
											.then(webhook => {
												// Send webhook
												webhook.send(webhookMsg)
											})
											.catch(err => { 
												// Webhook couldn't be created
												//logO(err); 
												//sendError(messsage.channel, err, "Could not create webhook");
											});
										} else { // no empty slot
											message.guild.channels.cache.get(destination.channel_id).send("**" + webhookName + "**: " + webhookMsg);
											webhooks.first().delete();
										}
									}
								});
							}		
						});
					}, () => {
						// Database error
						log("⛔ Database error. Could not access connected channels via id!");
					});
				});
			}, () => {
				// Database error
				log("⛔ Database error. Could not access connected channels via channel!");
			});
		}
	}
    
    this.toTitleCase = function(str) {
		return str.replace(/[a-zA-Z0-9][^\s-_]*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
	}    	
	
}