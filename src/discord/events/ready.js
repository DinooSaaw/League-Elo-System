import database from '../../database/mongodb.js';

export default {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`✅ Discord bot logged in as ${client.user.tag}!`);
    console.log(`🤖 Bot is ready and serving ${client.guilds.cache.size} guilds!`);
    
    // Set bot status
    client.user.setActivity('League ELO System | /help', { type: ActivityType.Watching });
  },
};
