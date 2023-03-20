import Winston from "winston";

const logger = Winston.createLogger({
  level: process.env.LOG_LEVEL || "debug",
  format: Winston.format.combine(
    Winston.format((info) => {
      // TODO: redact items here
      return info;
    })(),
    Winston.format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    Winston.format.errors({ stack: true }),
    Winston.format.splat()
  ),
  transports: [
    //
    // - Write to all logs with level `info` and below to `quick-start-combined.log`.
    // - Write all logs error (and below) to `quick-start-error.log`.
    //
  ],
});

//
// If we're not in production then **ALSO** log to the `console`
// with the colorized simple format.
//
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new Winston.transports.Console({
      format: Winston.format.combine(
        Winston.format.colorize(),
        Winston.format.simple()
      ),
    })
  );
}

export default logger;
