const childProcess = require("child_process");

async function updateDependencies() {
    const data = await getOutdated();
    const dependencies = [];
    for (const entry of data) {
        const latestMinor = await getLatestMinorVersion(entry.moduleName, entry.wanted);
        dependencies.push({ ...entry, install: latestMinor });
    }
    const command = dependencies.reduce((command, info) => `${command} ${info.moduleName}@${info.install}`, 'npm install --save');
    await exec(command);
    await exec("git commit -am 'updated dependencies'");
    console.log ('succesfully updated modules');
}
updateDependencies();

function getOutdated() {
    return exec("npm outdated --depth=0 --json")
        .then(data => JSON.parse(data))
        .then(data => Object.entries(data).map(([moduleName, info]) => ({ moduleName, ...info })));
}

function getLatestMinorVersion(moduleName, wantedVersion) {
    const major = wantedVersion.split('.')[0];
    return exec(`npm view ${moduleName}@${major} version --json`)
        .then(data => {
            const versions = JSON.parse(data);
            return versions[versions.length - 1];
        });
}

function exec(command) {
    return new Promise((resolve, reject) => {
        console.log('exec: ', command);
        const child = childProcess.exec(command);
        child.stdout.on("data", data => resolve(data));
    });
}
