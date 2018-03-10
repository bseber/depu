const semver = require("semver");
const logger = require("./logger");
const exec = require("./shell-exec");

module.exports = async function updateDependencies(config) {
  const data = await getOutdated();
  const dependencies = [];
  const devDependencies = [];
  for (const entry of data) {
    if (semver.valid(entry.wanted)) {
      if (!config.prefix || entry.moduleName.startsWith(config.prefix)) {
        const install = await getToInstallVersion(config, entry);
        if (entry.type === "devDependencies") {
          devDependencies.push({ ...entry, install });
        } else {
          dependencies.push({ ...entry, install });
        }
      }
    }
  }
  if (dependencies.length !== 0) {
    await exec(
      dependencies.reduce(
        (command, info) => `${command} ${info.moduleName}@${info.install}`,
        "npm install --save",
      ),
    );
  }
  if (devDependencies.length !== 0) {
    await exec(
      devDependencies.reduce(
        (command, info) => `${command} ${info.moduleName}@${info.install}`,
        "npm install --save-dev",
      ),
    );
  }
  if (dependencies.length !== 0 || devDependencies.length !== 0) {
    await exec("git commit -am 'updated dependencies'");
    return Promise.resolve([...dependencies, ...devDependencies]);
  }
};

async function getOutdated() {
  let response;
  try {
    const { stdout } = await exec("npm outdated --depth=0 -l --json");
    response = stdout;
  } catch ({ error, stdout, stderr }) {
    // `npm outdated` exits with 1 when there are outdated packages
    // therefore we have to handle this case
    // since we want to update these packages later
    if (stdout) {
      response = stdout;
    }
  }
  const data = JSON.parse(response);
  return Object.entries(data).map(([moduleName, info]) => ({
    moduleName,
    ...info,
  }));
}

async function getToInstallVersion(config, entry) {
  const { mode } = config;

  if (mode === "major") {
    return Promise.resolve(entry.latest);
  }

  const major = semver.major(entry.wanted);
  const minor = semver.minor(entry.wanted);
  const version = mode === "minor" ? major : `${major}.${minor}.x`;
  const { stdout: response } = await exec(
    `npm view ${entry.moduleName}@${version} version --json`,
  );
  const versions = JSON.parse(response);
  return versions[versions.length - 1];
}
