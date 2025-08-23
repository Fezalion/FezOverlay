export default {
  name: "ping",
  description: "Replies with pong",
  execute: (client, channel, userstate, args) => {
    client.say(channel, "Pong!");
  },
};
