const childProcess = require("child_process");
const logger = require("./logger");

module.exports = function exec(command) {
  return new Promise((resolve, reject) => {
    logger.info("exec: ", command);
    const child = childProcess.exec(command);
    child.stdout.on("data", data => resolve(data));
  });
};
