const os = require("os");
const hasFlag = require("has-flag");
const parseArgs = require("minimist");
const columnify = require("columnify");
const logger = require("./logger");
const {
  doCommit,
  doUpdate,
  getOutdated,
  getUpdateable,
} = require("./updateDependencies");

const LINE_BREAK = os.EOL;

const mode = hasFlag("major", process.argv)
  ? "major"
  : hasFlag("patch") ? "patch" : "minor";

const args = parseArgs(process.argv.slice(2));

const config = {
  mode,
  prefix: args.prefix || "",
};

async function updateDependencies() {
  const data = await getOutdated();
  const { dependencies, devDependencies } = await getUpdateable(data, config);
  await doUpdate(dependencies, devDependencies);
  if (dependencies.length !== 0 || devDependencies.length !== 0) {
    await doCommit();
    return Promise.resolve([...dependencies, ...devDependencies]);
  }
}

updateDependencies(config)
  .then(dependencies => {
    if (dependencies.length === 0) {
      logger.info("dependencies are up to date 😎");
    } else {
      logger.info(`updated ${dependencies.length} dependencies 💪`);
      logger.info(LINE_BREAK);
      const data = dependencies.reduce(
        (data, dep) => [
          ...data,
          { name: dep.moduleName, from: dep.current, to: dep.install },
        ],
        [],
      );
      logger.info(columnify(data));
    }
  })
  .catch(error => logger.error("Whoops... 😱", error));
