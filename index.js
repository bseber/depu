const hasFlag = require("has-flag");
const updateDependencies = require("./updateDependencies");

const mode = hasFlag("major", process.argv)
    ? "major"
    : hasFlag("patch")
        ? "patch"
        : "minor";

updateDependencies(mode);
