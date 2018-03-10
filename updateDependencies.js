const exec = require("./shell-exec");

module.exports = async function updateDependencies(config) {
    const data = await getOutdated();
    const dependencies = [];
    const devDependencies = [];
    for (const entry of data) {
        if (!config.prefix || entry.moduleName.startsWith(config.prefix)) {
            const install = await getToInstallVersion(config, entry);
            if (entry.type === "devDependencies") {
                devDependencies.push({ ...entry, install });
            } else {
                dependencies.push({ ...entry, install });
            }
        }
    }
    if (dependencies.length !== 0) {
        await exec(dependencies.reduce((command, info) => `${command} ${info.moduleName}@${info.install}`, 'npm install --save'));
    }
    if (devDependencies.length !== 0) {
        await exec(devDependencies.reduce((command, info) => `${command} ${info.moduleName}@${info.install}`, 'npm install --save-dev'));
    }
    if (dependencies.length !== 0 || devDependencies.length !== 0) {
        await exec("git commit -am 'updated dependencies'");
        console.log ('succesfully updated modules');
    }
};

function getOutdated() {
    return exec("npm outdated --depth=0 -l --json")
        .then(data => JSON.parse(data))
        .then(data => Object.entries(data).map(([moduleName, info]) => ({ moduleName, ...info })));
}

function getToInstallVersion(config, entry) {
    const { mode } = config;

    if (mode === "major") {
        return Promise.resolve(entry.latest);
    }

    const major = entry.wanted.split('.')[0];
    const minor = entry.wanted.split('.')[1];
    const version = mode === "minor" ? major : `${major}.${minor}.x`;
    return exec(`npm view ${entry.moduleName}@${version} version --json`)
        .then(data => {
            const versions = JSON.parse(data);
            return versions[versions.length - 1];
        });
}
