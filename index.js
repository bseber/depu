const hasFlag = require("has-flag");
const parseArgs = require("minimist");
const updateDependencies = require("./updateDependencies");

const mode = hasFlag("major", process.argv)
    ? "major"
    : hasFlag("patch")
        ? "patch"
        : "minor";

const config = {
    mode,
};

updateDependencies(config);
