import { join } from "path";
import { pino } from "pino";

const transport = pino.transport({
  targets: [
    {
      level: process.env.PINO_LOG_LEVEL || "info",
      target: "pino-roll",
      options: {
        file: join("logs", "log"),
        frequency: "daily",
        mkdir: true,
        extension: "log",
        dateFormat: "yyyy-MM-dd",
        symlink: true,
      },
    },
    {
      level: process.env.PINO_LOG_LEVEL || "info",
      target: "pino-pretty",
      options: {
        colorize: true,
      },
    },
    // ENABLE AGAIN WHEN SERVER HAS LOKI
    // {
    //   level: process.env.PINO_LOG_LEVEL || 'info',
    //   target: 'pino-loki',
    //   options: {
    //     batching: false,
    //     convertArrays: true,
    //     host: 'http://localhost:3100',
    //     levelMap: {
    //       10: LokiLogLevel.Debug,
    //       20: LokiLogLevel.Debug,
    //       30: LokiLogLevel.Info,
    //       40: LokiLogLevel.Warning,
    //       50: LokiLogLevel.Error,
    //       60: LokiLogLevel.Critical,
    //     },
    //   },
    // },
  ],
});

export const logger = pino(
  {
    level: process.env.PINO_LOG_LEVEL || "info",
    base: undefined,
    nestedKey: "payload",
  },
  transport
);
