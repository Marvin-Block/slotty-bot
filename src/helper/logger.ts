import { pino } from 'pino';

const transport = pino.transport({
  targets: [
    {
      level: 'trace',
      target: 'pino/file',
      options: {
        destination: './logs/file.log',
        mkdir: true,
      },
    },
    {
      level: process.env.PINO_LOG_LEVEL || 'info',
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    },
  ],
});

export const logger = pino(
  {
    level: process.env.PINO_LOG_LEVEL || 'info',
    base: undefined,
    nestedKey: 'payload',
  },
  transport
);
