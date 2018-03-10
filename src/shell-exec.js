const childProcess = require("child_process");

module.exports = function exec(command) {
  return new Promise((resolve, reject) => {
    console.log("exec: ", command);
    const child = childProcess.exec(command);
    child.stdout.on("data", data => resolve(data));
  });
};
