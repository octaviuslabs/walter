import winston from "winston";
const logger = winston.createLogger();

logger.add(
  new winston.transports.Console({
    format: winston.format.simple(),
  })
);

export default logger;
