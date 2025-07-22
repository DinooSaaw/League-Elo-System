import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadEvents(client) {
  const eventsPath = path.join(__dirname, '..', 'events');
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  console.log(`🔄 Loading ${eventFiles.length} events...`);

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    try {
      const event = await import(`file://${filePath}`);
      const eventData = event.default;

      if ('name' in eventData && 'execute' in eventData) {
        if (eventData.once) {
          client.once(eventData.name, (...args) => eventData.execute(...args));
        } else {
          client.on(eventData.name, (...args) => eventData.execute(...args));
        }
        console.log(`✅ Loaded event: ${eventData.name}`);
      } else {
        console.log(`⚠️ [WARNING] The event at ${filePath} is missing a required "name" or "execute" property.`);
      }
    } catch (error) {
      console.error(`❌ Error loading event ${file}:`, error);
    }
  }

  console.log(`✅ Successfully loaded ${eventFiles.length} events!`);
}
