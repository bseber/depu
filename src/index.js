const os = require("os");
const hasFlag = require("has-flag");
const parseArgs = require("minimist");
const columnify = require("columnify");
const Listr = require("listr");
const logger = require("./logger");
const {
  cleanupNodeModules,
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

const tasks = new Listr([
  {
    title: "cleaning up node_modules directory",
    task: async () => {
      await cleanupNodeModules();
    },
  },
  {
    title: "get outdated dependencies",
    task: async ctx => {
      ctx.outdated = await getOutdated();
    },
  },
  {
    title: `get latest ${mode} versions`,
    skip: ctx => !hasOutdated(ctx),
    task: async ctx => {
      ctx.updateable = await getUpdateable(ctx.outdated, config);
    },
  },
  {
    title: "update dependencies",
    skip: ctx => !hasUpdateable(ctx),
    task: async ctx => {
      const { dependencies, devDependencies } = ctx.updateable;
      await doUpdate(dependencies, devDependencies);
      ctx.updated = [...dependencies, ...devDependencies];
    },
  },
  {
    title: "commit changes",
    skip: ctx => !hasUpdated(ctx),
    task: async () => {
      await doCommit();
    },
  },
]);

tasks
  .run()
  .then(ctx => {
    if (hasUpdated(ctx)) {
      const updated = ctx.updated;
      logger.info(`updated ${updated.length} dependencies 💪${LINE_BREAK}`);
      const data = updated.reduce(
        (data, dep) => [
          ...data,
          { name: dep.moduleName, from: dep.current, to: dep.install },
        ],
        [],
      );
      logger.info(columnify(data));
    } else {
      logger.info("dependencies are up to date 😎");
    }
  })
  .catch(error => logger.info("Whoops... 😱", error));

function hasOutdated(ctx) {
  return !empty(ctx.outdated);
}

function hasUpdateable(ctx) {
  if (!hasOutdated(ctx)) {
    return false;
  }
  return (
    !empty(ctx.updateable.dependencies) ||
    !empty(ctx.updateable.devDependencies)
  );
}

function hasUpdated(ctx) {
  return !empty(ctx.updated);
}

function empty(list) {
  return !list || list.length === 0;
}
