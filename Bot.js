require('dotenv').config();
const Discord = require('discord.js');
const { Chatbot } = require('Bard'); // Assuming Bard is a custom module for the chatbot

const client = new Discord.Client();
const bard = new Chatbot(process.env.BARD_TOKEN);
const replyAll = process.env.REPLY_ALL === 'true';
const useImages = process.env.USE_IMAGES === 'true';
let allowDM = true;
const activeChannels = new Set();

client.on('ready', () => {
  client.user.setActivity('/help');
  console.log(`Logged in as ${client.user.tag}`);
  const inviteLink = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;
  console.log(`Invite link: ${inviteLink}`);
});

async function generateResponse(prompt) {
  const maxChunkLength = 1900;
  const response = bard.ask(prompt);
  if (!response || response.content.includes('Google Bard encountered an error')) {
    return 'I couldn\'t generate a response. Please try again.';
  }
  const { content, images } = response;
  const words = content.split(' ');
  const chunks = [];
  let currentChunk = [];

  for (const word of words) {
    if (currentChunk.join(' ').length + word.length + 1 > maxChunkLength) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [word];
    } else {
      currentChunk.push(word);
    }
  }

  if (currentChunk.length) {
    chunks.push(currentChunk.join(' '));
  }

  const formattedChunks = chunks.map(chunk => chunk.replace(' * ', '\n* '));
  return { chunks: formattedChunks, images };
}

client.on('message', async (message) => {
  if (replyAll) {
    if (message.author.bot || (message.reference && message.reference.resolved.author !== client.user)) {
      return;
    }

    const isDMChannel = message.channel.type === 'DM';

    if (activeChannels.has(message.channel.id) || (allowDM && isDMChannel)) {
      const userPrompt = message.content;
      message.channel.startTyping();

      try {
        const response = await generateResponse(userPrompt);

        for (const chunk of response.chunks) {
          await message.reply(chunk);
        }

        if (useImages && response.images) {
          for (const image of response.images) {
            await message.reply(image);
          }
        }
      } catch (error) {
        console.error('Error generating response:', error);
        await message.reply('I couldn\'t generate a response. Please try again.');
      } finally {
        message.channel.stopTyping();
      }
    }
  }
});

client.on('messageCreate', (interaction) => {
  if (interaction.isCommand() && interaction.commandName === 'toggledm') {
    allowDM = !allowDM;
    const dmStatus = allowDM ? 'allowed' : 'disallowed';
    interaction.reply(`DMs are now ${dmStatus} for active channels.`);
  } else if (interaction.isCommand() && interaction.commandName === 'togglechannel') {
    const channelID = interaction.channel.id;

    if (activeChannels.has(channelID)) {
      activeChannels.delete(channelID);
      interaction.reply(`${interaction.channel.toString()} has been removed from the list of active channels.`);
    } else {
      activeChannels.add(channelID);
      interaction.reply(`${interaction.channel.toString()} has been added to the list of active channels!`);
    }
  } else if (interaction.isCommand() && interaction.commandName === 'reset') {
    bard.conversationId = '';
    bard.responseId = '';
    bard.choiceId = '';
    interaction.reply('Bot context has been reset.');
  } else if (interaction.isCommand() && interaction.commandName === 'public') {
    if (!replyAll) {
      replyAll = true;
      interaction.reply('Bot will now respond to all messages in chat.');
    } else {
      interaction.reply('Bot is already in public mode.');
    }
  } else if (interaction.isCommand() && interaction.commandName === 'private') {
    if (replyAll) {
      replyAll = false;
      interaction.reply('Bot will now only respond to /chat.');
    } else {
      interaction.reply('Bot is already in private mode.');
    }
  } else if (interaction.isCommand() && interaction.commandName === 'images') {
    useImages = !useImages;
    const responseType = useImages ? 'images' : 'text';
    interaction.reply(`Bot will now respond with ${responseType}.`);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
