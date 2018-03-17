const semver = require("semver");
const exec = require("execa");

async function cleanupNodeModules() {
  await exec("npm", ["prune"]);
}

async function getOutdated() {
  let response;
  try {
    const { stdout } = await exec("npm", [
      "outdated",
      "--depth=0",
      "-l",
      "--json",
    ]);
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

async function getUpdateable(data, config) {
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
  return { dependencies, devDependencies };
}

async function getToInstallVersion(config, entry) {
  const { mode } = config;

  if (mode === "major") {
    return Promise.resolve(entry.latest);
  }

  const major = semver.major(entry.wanted);
  const minor = semver.minor(entry.wanted);
  const version = mode === "minor" ? major : `${major}.${minor}.x`;
  const { stdout: response } = await exec("npm", [
    "view",
    `${entry.moduleName}@${version}`,
    "version",
    "--json",
  ]);
  const versions = JSON.parse(response);
  return versions[versions.length - 1];
}

async function doUpdate(dependencies, devDependencies) {
  if (dependencies.length !== 0) {
    await exec("npm", [
      "install",
      "--save",
      ...dependencies.map(d => `${d.moduleName}@${d.install}`),
    ]);
  }
  if (devDependencies.length !== 0) {
    await exec("npm", [
      "install",
      "--save-dev",
      ...devDependencies.map(d => `${d.moduleName}@${d.install}`),
    ]);
  }
}

async function doCommit() {
  const add = async file => exec("git", ["add", file]);
  const commit = async msg => exec("git", ["commit", "-m", msg]);
  await add("package.json");
  await add("package-lock.json");
  await commit("updated dependencies");
}

module.exports = {
  cleanupNodeModules,
  getOutdated,
  getUpdateable,
  doUpdate,
  doCommit,
};
