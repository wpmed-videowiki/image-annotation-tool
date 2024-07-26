const amqp = require("amqplib");

const QUEUES = {
  COLLECT_FILE_STATS: "file-stats",
};

async function connectRabbitMQ() {
  const connection = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue("file-stats", { durable: true });

  return channel;
}
const publishers = {
  publishCollectFileStats(channel, data) {
    channel.sendToQueue(
      QUEUES.COLLECT_FILE_STATS,
      Buffer.from(JSON.stringify(data))
    );
  },
};

module.exports = { connectRabbitMQ, QUEUES, publishers };
