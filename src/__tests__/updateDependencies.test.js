jest.mock("../shell-exec", () => jest.fn((/*command*/) => Promise.resolve()));

const semver = require("semver");
const exec = require("../shell-exec");
const updateDependencies = require("../updateDependencies");

describe("updateDependencies", () => {
  // eslint-disable-next-line jest/no-hooks
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("does nothing when there are no dependencies to update", () => {
    exec.mockReturnValue(Promise.resolve("{}"));

    const config = {};
    updateDependencies(config);
    expect(exec).toHaveBeenCalledTimes(1);
    expect(exec).toHaveBeenCalledWith("npm outdated --depth=0 -l --json");
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

    await updateDependencies(config);
    const mockCalls = exec.mock.calls;
    expect(mockCalls[0][0]).toEqual("npm outdated --depth=0 -l --json");
    expect(mockCalls[1][0]).toEqual("npm install --save moduleA@3.0.0");
  });

  it("updates patch version", async () => {
    expect.assertions(6);

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
    const viewResponse = {
      moduleA: ["2.0.0", "2.0.1", "2.0.2"],
      moduleB: ["1.0.0"],
      devModule: ["42.0.0", "42.0.1"],
    };

    exec.mockImplementation(command => {
      if (/^npm outdated/.test(command)) {
        return resolveExec(JSON.stringify(outdatedResponse));
      } else if (/^npm view/.test(command)) {
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

    await updateDependencies(config);
    const mockCalls = exec.mock.calls;
    expect(mockCalls[0][0]).toEqual("npm outdated --depth=0 -l --json");
    expect(mockCalls[1][0]).toEqual("npm view moduleA@2.0.x version --json");
    expect(mockCalls[2][0]).toEqual("npm view moduleB@1.0.x version --json");
    expect(mockCalls[3][0]).toEqual("npm view devModule@42.0.x version --json");
    expect(mockCalls[4][0]).toEqual(
      "npm install --save moduleA@2.0.2 moduleB@1.0.0",
    );
    expect(mockCalls[5][0]).toEqual("npm install --save-dev devModule@42.0.1");
  });

  it("updates minor version", async () => {
    expect.assertions(6);

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
    const viewResponse = {
      moduleA: ["2.1.0", "2.2.0", "2.3.0"],
      moduleB: ["1.0.0", "1.1.0"],
      devModule: ["42.0.0", "42.1.0", "42.2.0"],
    };
    exec.mockImplementation(command => {
      if (/^npm outdated/.test(command)) {
        return resolveExec(JSON.stringify(outdatedResponse));
      } else if (/^npm view/.test(command)) {
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

    await updateDependencies(config);
    const mockCalls = exec.mock.calls;
    expect(mockCalls[0][0]).toEqual("npm outdated --depth=0 -l --json");
    expect(mockCalls[1][0]).toEqual("npm view moduleA@2 version --json");
    expect(mockCalls[2][0]).toEqual("npm view moduleB@1 version --json");
    expect(mockCalls[3][0]).toEqual("npm view devModule@42 version --json");
    expect(mockCalls[4][0]).toEqual(
      "npm install --save moduleA@2.3.0 moduleB@1.1.0",
    );
    expect(mockCalls[5][0]).toEqual("npm install --save-dev devModule@42.2.0");
  });

  it("updates major version", async () => {
    expect.assertions(3);

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
      mode: "major",
    };

    await updateDependencies(config);
    const mockCalls = exec.mock.calls;
    expect(mockCalls[0][0]).toEqual("npm outdated --depth=0 -l --json");
    expect(mockCalls[1][0]).toEqual(
      "npm install --save moduleA@3.0.0 moduleB@4.0.0",
    );
    expect(mockCalls[2][0]).toEqual(
      "npm install --save-dev devModule@1337.0.0",
    );
  });

  it("updates minor version of matching dependencies", async () => {
    expect.assertions(3);

    const outdatedResponse = {
      "@myNamespace/moduleA": {
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
    const viewResponse = {
      moduleA: ["2.1.0", "2.2.0", "2.3.0"],
      moduleB: ["1.0.0", "1.1.0"],
      devModule: ["42.0.0", "42.1.0", "42.2.0"],
    };
    exec.mockImplementation(command => {
      if (/^npm outdated/.test(command)) {
        return resolveExec(JSON.stringify(outdatedResponse));
      } else if (/^npm view/.test(command)) {
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
      prefix: "@myNamespace",
    };

    await updateDependencies(config);
    const mockCalls = exec.mock.calls;
    expect(mockCalls[0][0]).toEqual("npm outdated --depth=0 -l --json");
    expect(mockCalls[1][0]).toEqual(
      "npm view @myNamespace/moduleA@2 version --json",
    );
    expect(mockCalls[2][0]).toEqual(
      "npm install --save @myNamespace/moduleA@2.3.0",
    );
  });

  it("ignores dependencies with non valid semver versions", async () => {
    expect.assertions(3);
    jest.spyOn(semver, "valid").mockReturnValue(false);

    const outdatedResponse = {
      moduleB: {
        latest: "4.0.0",
        wanted: "linked",
        type: "dependencies",
      },
    };
    exec.mockImplementation(command => {
      if (/^npm outdated/.test(command)) {
        return resolveExec(JSON.stringify(outdatedResponse));
      }
      return Promise.resolve();
    });

    const config = {
      mode: "minor",
    };

    await updateDependencies(config);
    expect(exec).toHaveBeenCalledTimes(1);
    expect(semver.valid).toHaveBeenCalledTimes(1);
    expect(semver.valid).toHaveBeenCalledWith("linked");
  });

  function resolveExec(stdout) {
    return Promise.resolve({ stdout });
  }

  function rejectExec(error, stdout) {
    return Promise.reject({ error, stdout });
  }
});
