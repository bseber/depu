const childProcess = require("child_process");
const logger = require("./logger");

module.exports = async function exec(command) {
  return new Promise((resolve, reject) => {
    logger.info("exec: ", command);
    childProcess.exec(command, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
};
