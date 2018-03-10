const hasFlag = require("has-flag");
const parseArgs = require("minimist");
const updateDependencies = require("./updateDependencies");

const mode = hasFlag("major", process.argv)
    ? "major"
    : hasFlag("patch")
        ? "patch"
        : "minor";

const args = parseArgs(process.argv.slice(2));

const config = {
    mode,
    prefix: args.prefix || '',
};

updateDependencies(config);
