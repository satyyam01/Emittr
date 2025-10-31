// analytics.js
const { Kafka } = require('kafkajs');
const kafka = new Kafka({ clientId: 'connect4-analytics', brokers: [process.env.KAFKA_BROKER || 'localhost:9092'] });
const consumer = kafka.consumer({ groupId: 'analytics-group' });

(async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: 'connect4-events', fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const payload = JSON.parse(message.value.toString());
        console.log('Analytics event:', payload.type, payload.payload);
        // Optionally insert into Postgres analytics table
      } catch(e){ console.error(e); }
    }
  });
})();
