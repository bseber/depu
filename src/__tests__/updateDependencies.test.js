jest.mock("../logger");
jest.mock("../shell-exec", () => jest.fn((/*command*/) => Promise.resolve()));

const semver = require("semver");
const exec = require("../shell-exec");
const {
  cleanupNodeModules,
  getUpdateable,
  getOutdated,
  doUpdate,
  doCommit,
} = require("../updateDependencies");

describe("updateDependencies", () => {
  // eslint-disable-next-line jest/no-hooks
  afterEach(() => {
    jest.resetAllMocks();
    semver.valid.mock && semver.valid.mockRestore();
  });

  describe("cleanupNodeModules", () => {
    it("invokes 'npm prune'", async () => {
      expect.assertions(3);
      expect(exec).not.toHaveBeenCalled();
      cleanupNodeModules();
      expect(exec).toHaveBeenCalledTimes(1);
      expect(exec).toHaveBeenCalledWith("npm", ["prune"]);
    });
  });

  describe("getOutdated", () => {
    it("returns outdated dependencies", async () => {
      expect.assertions(1);

      const outdatedResponse = {
        moduleA: {
          latest: "3.0.0",
          wanted: "2.0.0",
          type: "dependencies",
        },
        moduleB: {
          latest: "4.0.0",
          wanted: "1.0.0",
          type: "dependencies",
        },
        devModule: {
          latest: "1337.0.0",
          wanted: "42.0.0",
          type: "devDependencies",
        },
      };

      exec.mockImplementation(command => {
        if (/^npm outdated/.test(command)) {
          return resolveExec(JSON.stringify(outdatedResponse));
        }
        return Promise.resolve();
      });

      const config = {
        mode: "patch",
      };

      const outdated = await getOutdated(config);
      expect(outdated).toEqual([
        {
          latest: "3.0.0",
          moduleName: "moduleA",
          type: "dependencies",
          wanted: "2.0.0",
        },
        {
          latest: "4.0.0",
          moduleName: "moduleB",
          type: "dependencies",
          wanted: "1.0.0",
        },
        {
          latest: "1337.0.0",
          moduleName: "devModule",
          type: "devDependencies",
          wanted: "42.0.0",
        },
      ]);
    });

    it("ignores 'npm outdated' error sigint when there is stdout", async () => {
      expect.assertions(2);

      const outdatedResponse = {
        moduleA: {
          latest: "3.0.0",
          wanted: "2.0.0",
          type: "dependencies",
        },
      };
      exec.mockImplementation(command => {
        if (/^npm outdated/.test(command)) {
          return rejectExec(
            new Error("sigint is 1 when there are outdated packages"),
            JSON.stringify(outdatedResponse),
          );
        }
        return Promise.resolve();
      });

      const config = {
        mode: "major",
      };

      await getOutdated(config);
      expect(exec).toHaveBeenCalledTimes(1);
      expect(exec).toHaveBeenCalledWith("npm outdated --depth=0 -l --json");
    });

    it("returns empty list when node_modules directory contains latest versions", async () => {
      expect.assertions(1);

      exec.mockImplementation(command => {
        if (/^npm outdated/.test(command)) {
          return resolveExec("");
        }
        return Promise.resolve();
      });

      const config = {
        mode: "patch",
      };

      const outdated = await getOutdated(config);
      expect(outdated).toEqual([]);
    });
  });

  describe("getUpdateable", () => {
    it("returns dev-/dependency data for major update", async () => {
      expect.assertions(2);

      const data = [
        {
          latest: "3.0.0",
          moduleName: "moduleA",
          type: "dependencies",
          wanted: "2.0.0",
        },
        {
          latest: "4.0.0",
          moduleName: "moduleB",
          type: "dependencies",
          wanted: "1.0.0",
        },
        {
          latest: "1337.0.0",
          moduleName: "devModule",
          type: "devDependencies",
          wanted: "42.0.0",
        },
      ];

      const config = {
        mode: "major",
      };

      const actual = await getUpdateable(data, config);
      expect(exec).not.toHaveBeenCalled();
      expect(actual).toEqual({
        dependencies: [
          {
            install: "3.0.0",
            latest: "3.0.0",
            moduleName: "moduleA",
            type: "dependencies",
            wanted: "2.0.0",
          },
          {
            install: "4.0.0",
            latest: "4.0.0",
            moduleName: "moduleB",
            type: "dependencies",
            wanted: "1.0.0",
          },
        ],
        devDependencies: [
          {
            install: "1337.0.0",
            latest: "1337.0.0",
            moduleName: "devModule",
            type: "devDependencies",
            wanted: "42.0.0",
          },
        ],
      });
    });

    it("returns dev-/dependency data for minor update", async () => {
      expect.assertions(4);

      const data = [
        {
          latest: "3.0.0",
          moduleName: "moduleA",
          type: "dependencies",
          wanted: "2.0.0",
        },
        {
          latest: "4.0.0",
          moduleName: "moduleB",
          type: "dependencies",
          wanted: "1.0.0",
        },
        {
          latest: "1337.0.0",
          moduleName: "devModule",
          type: "devDependencies",
          wanted: "42.0.0",
        },
      ];
      const viewResponse = {
        moduleA: ["2.1.0", "2.2.0", "2.3.0"],
        moduleB: ["1.0.0", "1.1.0"],
        devModule: ["42.0.0", "42.1.0", "42.2.0"],
      };
      exec.mockImplementation(command => {
        if (/^npm view/.test(command)) {
          if (/moduleA/.test(command)) {
            return resolveExec(JSON.stringify(viewResponse.moduleA));
          } else if (/moduleB/.test(command)) {
            return resolveExec(JSON.stringify(viewResponse.moduleB));
          } else if (/devModule/.test(command)) {
            return resolveExec(JSON.stringify(viewResponse.devModule));
          }
        }
        return Promise.resolve();
      });

      const config = {
        mode: "minor",
      };

      const actual = await getUpdateable(data, config);
      const mockCalls = exec.mock.calls;
      expect(mockCalls[0][0]).toEqual("npm view moduleA@2 version --json");
      expect(mockCalls[1][0]).toEqual("npm view moduleB@1 version --json");
      expect(mockCalls[2][0]).toEqual("npm view devModule@42 version --json");
      expect(actual).toEqual({
        dependencies: [
          {
            install: "2.3.0",
            latest: "3.0.0",
            moduleName: "moduleA",
            type: "dependencies",
            wanted: "2.0.0",
          },
          {
            install: "1.1.0",
            latest: "4.0.0",
            moduleName: "moduleB",
            type: "dependencies",
            wanted: "1.0.0",
          },
        ],
        devDependencies: [
          {
            install: "42.2.0",
            latest: "1337.0.0",
            moduleName: "devModule",
            type: "devDependencies",
            wanted: "42.0.0",
          },
        ],
      });
    });

    it("returns dev-/dependency data for patch update", async () => {
      expect.assertions(4);

      const data = [
        {
          latest: "3.0.0",
          moduleName: "moduleA",
          type: "dependencies",
          wanted: "2.0.0",
        },
        {
          latest: "4.0.0",
          moduleName: "moduleB",
          type: "dependencies",
          wanted: "1.0.0",
        },
        {
          latest: "1337.0.0",
          moduleName: "devModule",
          type: "devDependencies",
          wanted: "42.0.0",
        },
      ];
      const viewResponse = {
        moduleA: ["2.0.0", "2.0.1", "2.0.2"],
        moduleB: ["1.0.0"],
        devModule: ["42.0.0", "42.0.1"],
      };

      exec.mockImplementation(command => {
        if (/^npm view/.test(command)) {
          if (/moduleA/.test(command)) {
            return resolveExec(JSON.stringify(viewResponse.moduleA));
          } else if (/moduleB/.test(command)) {
            return resolveExec(JSON.stringify(viewResponse.moduleB));
          } else if (/devModule/.test(command)) {
            return resolveExec(JSON.stringify(viewResponse.devModule));
          }
        }
        return Promise.resolve();
      });

      const config = {
        mode: "patch",
      };

      const actual = await getUpdateable(data, config);
      const mockCalls = exec.mock.calls;
      expect(mockCalls[0][0]).toEqual("npm view moduleA@2.0.x version --json");
      expect(mockCalls[1][0]).toEqual("npm view moduleB@1.0.x version --json");
      expect(mockCalls[2][0]).toEqual(
        "npm view devModule@42.0.x version --json",
      );
      expect(actual).toEqual({
        dependencies: [
          {
            install: "2.0.2",
            latest: "3.0.0",
            moduleName: "moduleA",
            type: "dependencies",
            wanted: "2.0.0",
          },
          {
            install: "1.0.0",
            latest: "4.0.0",
            moduleName: "moduleB",
            type: "dependencies",
            wanted: "1.0.0",
          },
        ],
        devDependencies: [
          {
            install: "42.0.1",
            latest: "1337.0.0",
            moduleName: "devModule",
            type: "devDependencies",
            wanted: "42.0.0",
          },
        ],
      });
    });

    it("ignores dependencies with non valid semver versions", async () => {
      expect.assertions(3);
      jest.spyOn(semver, "valid").mockReturnValue(false);

      const data = [
        {
          moduleName: "moduleB",
          latest: "4.0.0",
          wanted: "linked",
          type: "dependencies",
        },
      ];

      const config = {
        mode: "minor",
      };

      const actual = await getUpdateable(data, config);
      expect(semver.valid).toHaveBeenCalledTimes(1);
      expect(semver.valid).toHaveBeenCalledWith("linked");
      expect(actual).toEqual({ dependencies: [], devDependencies: [] });
    });

    it("recognizes prefix", async () => {
      expect.assertions(3);

      const data = [
        {
          moduleName: "@myNamespace/moduleA",
          latest: "3.0.0",
          wanted: "2.0.0",
          type: "dependencies",
        },
        {
          moduleName: "moduleB",
          latest: "4.0.0",
          wanted: "1.0.0",
          type: "dependencies",
        },
      ];
      const viewResponse = {
        moduleA: ["2.1.0", "2.2.0", "2.3.0"],
        moduleB: ["1.0.0", "1.1.0"],
        devModule: ["42.0.0", "42.1.0", "42.2.0"],
      };
      exec.mockImplementation(command => {
        if (/^npm view/.test(command)) {
          return resolveExec(JSON.stringify(viewResponse.moduleA));
        }
        return Promise.resolve();
      });

      const config = {
        mode: "minor",
        prefix: "@myNamespace",
      };

      const actual = await getUpdateable(data, config);
      expect(exec).toHaveBeenCalledTimes(1);
      expect(exec).toHaveBeenCalledWith(
        "npm view @myNamespace/moduleA@2 version --json",
      );
      expect(actual).toEqual({
        dependencies: [
          {
            install: "2.3.0",
            latest: "3.0.0",
            moduleName: "@myNamespace/moduleA",
            type: "dependencies",
            wanted: "2.0.0",
          },
        ],
        devDependencies: [],
      });
    });
  });

  describe("doUpdate", () => {
    it("installs dependencies", async () => {
      expect.assertions(2);
      const dependencies = [
        {
          install: "3.0.0",
          latest: "3.0.0",
          moduleName: "moduleA",
          type: "dependencies",
          wanted: "2.0.0",
        },
        {
          install: "4.0.0",
          latest: "4.0.0",
          moduleName: "moduleB",
          type: "dependencies",
          wanted: "1.0.0",
        },
      ];
      const devDependencies = [
        {
          install: "1337.0.0",
          latest: "1337.0.0",
          moduleName: "devModule",
          type: "devDependencies",
          wanted: "42.0.0",
        },
      ];
      await doUpdate(dependencies, devDependencies);
      expect(exec).toHaveBeenCalledWith(
        "npm install --save moduleA@3.0.0 moduleB@4.0.0",
      );
      expect(exec).toHaveBeenCalledWith(
        "npm install --save-dev devModule@1337.0.0",
      );
    });

    it("does nothing when lists are empty", async () => {
      expect.assertions(1);
      const dependencies = [];
      const devDependencies = [];
      await doUpdate(dependencies, devDependencies);
      expect(exec).not.toHaveBeenCalled();
    });
  });

  describe("doCommit", () => {
    it("commits package.json and package-lock.json", async () => {
      expect.assertions(3);
      await doCommit();
      expect(exec.mock.calls[0][0]).toEqual("git add package.json");
      expect(exec.mock.calls[1][0]).toEqual("git add package-lock.json");
      expect(exec.mock.calls[2][0]).toEqual(
        "git commit -m 'updated dependencies'",
      );
    });
  });

  function resolveExec(stdout) {
    return Promise.resolve({ stdout });
  }

  function rejectExec(error, stdout) {
    return Promise.reject({ error, stdout });
  }
});
