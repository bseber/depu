## 0.1.0

* improved cli ui with [listr](https://github.com/SamVerschueren/listr)
* integrated [execa](https://github.com/sindresorhus/execa)
* [bugfix] sorting `npm view XXX version` response to get the latest version

## 0.0.1

* initial release
  * look for outdated packages (`npm outdated`)
  * look for available versions (`npm view myPackage version`)
  * install newer packages with `npm install myPackage@1.2.3` which also updates the package.json
  * commit the updated package.json and package-lock.json (`git commit -m "updated dependencies`)
