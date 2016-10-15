'use strict';

import {
  ExtensionContext,
  commands,
  window,
  Disposable,
  InputBoxOptions
} from "vscode";
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import * as os from "os";
import {getSettings} from "./settings";
import * as request from "request";
const Promise = require("bluebird");
const extract = require("extract-zip");

const projectType: Array<string> = [];

const projectMap: Map<string, string> = new Map();
projectMap.set("C++", "cplusplus");
projectMap.set("TypeScript", "typescript");
projectMap.set("Python", "python");
projectMap.set("PHP", "php");
projectMap.set("Go", "go");
projectMap.set("Node.js", "node.js");
projectMap.set("C", "c");
projectMap.set("Hexo", "hexo");

projectMap.forEach((value, index) => {
  projectType.push(index);
});

const mkdirAsync: (path: string | Buffer) => Promise<void> = Promise.promisify(fs.mkdir);
const unlinkAsync: (path: string | Buffer) => Promise<void> = Promise.promisify(fs.unlink);
const extractAsync: (fromPath: string | Buffer, options?: Object) => Promise<void> = Promise.promisify(extract);
const readdirAsync: (path: string | Buffer) => Promise<Array<string>> = Promise.promisify(fs.readdir);
const writeFileAsync: (path: string | Buffer, data: any) => Promise<void> = Promise.promisify(fs.writeFile);

/**
 * promise version of fs.exists
 * 
 * @param {string} path
 * @returns {Promise<boolean>}
 */
function existsAsync(path: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    fs.exists(path, (exists: boolean): void => {
      return resolve(exists);
    });
  });
};

/**
 * promise version
 * 
 * @param {string} path
 * @returns {Promise<void>}
 */
function existsOrMkdirAsync(path: string): Promise<void> {
  return existsAsync(path)
    .then((exist) => { 
      if (!exist) {
        return mkdirAsync(path);
      }
      return Promise.resolve(() => { });
    }).catch((err) => {
      console.error("wtf??", err);
    });
};

/**
 * using pipe to copy files
 * 
 * @param {string} fromPath
 * @param {string} toPath
 */
function copyFileSync(fromPath: string, toPath: string) {
  if (fs.existsSync(toPath)) {
    fs.unlinkSync(toPath);
  }
  const fromStream = fs.createReadStream(fromPath);
  const toStream = fs.createWriteStream(toPath);
  fromStream.pipe(toStream);
}

/**
 * remove a dir
 * 
 * @param {string} path_
 * @returns
 */
function removeDirSync(path_: string) {
  if (!fs.existsSync(path_)) {
    return;
  }
  const files = fs.readdirSync(path_);
  for (const file of files) {
    const currentPath = path.join(path_, file);
    if (fs.statSync(currentPath).isDirectory()) {
      removeDirSync(currentPath);
    } else {
      fs.unlinkSync(currentPath);
    }
  }
  fs.rmdirSync(path_);
}

/**
 * downlaod `dotvscodeGenerator.zip` from internet and unzip it
 * 
 * @returns {Promise<void>}
 */
function installAsync(): Promise<void> {
  const settings = getSettings();
  return new Promise((resolve, reject) => {
    request(settings.downloadUrl)
      .pipe(fs.createWriteStream(settings.zipDir))
      .on("finish", () => {
        extractAsync(settings.zipDir, { dir: settings.homeVSCodeDir })
          .then(() => {
            window.showInformationMessage("Installating completed!");
          }).catch((err) => {
            window.showErrorMessage(JSON.stringify(err));
          });
      }).on("error", (err) => {
        console.error("error", err);
        return reject(err);
      });
  });
}

/**
 * install needed
 * remove the `.vscode.generator` dir
 * 
 * @returns {Promise<void>}
 */
function uninstallAsync(): Promise<void> {
  return checkInstallAsync().then(() => {
    return new Promise((resolve, reject) => {
      const settings = getSettings();
      removeDirSync(settings.homeVSCodeDir);
      removeDirSync(settings.homeUserVSCodeDir);
      resolve();

      // unlinkAsync(settings.homeUserVSCodeDir).then(() => {
      //   return unlinkAsync(settings.home);
      // }).then(() => {
      //   window.showInformationMessage("Uninstallting completed!");
      // }).catch((err) => {
      //   window.showErrorMessage(JSON.stringify(err));
      // });
    });
  });  
}

/**
 * check if install has been called
 * 
 * @returns {Promise<void>}
 */
function checkInstallAsync(): Promise<void> {
  const settings = getSettings();
  return new Promise((resolve, reject) => {
    existsAsync(settings.homeVSCodeDir).then((installed) => {
      if (installed) {
        return resolve();
      } else {
        return reject("Please ensure you did install first");
      }
    });
  });
}

/**
 * 
 * 
 * @class Generator
 */
class Generator {
  /**
   * type of project
   * 
   * @type {string}
   * @memberOf Generator
   */
  type: string = null;

  /**
   * Creates an instance of Generator.
   * 
   * @param {string} type
   * 
   * @memberOf Generator
   */
  constructor(type: string) {
    this.type = projectMap.get(type);
  }

  /**
   * generate .vscode dir inside workspace
   * 
   * @returns {Promise<void>}
   * 
   * @memberOf Generator
   */
  public generate(): Promise<void> {
    return checkInstallAsync().then(() => {
      const settings = getSettings();
      const homeVSCodeType: string = path.join(settings.homeVSCodeDir, this.type);
      const homeUserVSCodeType: string = path.join(settings.homeUserVsCodeDir, this.type);
      return existsOrMkdirAsync(settings.workspaceVSCode)
        .then(() => {
          return readdirAsync(homeVSCodeType);
        })
        .then((files) => {
          for (const file of files) {
            let filePath = path.join(homeVSCodeType, file);
            const userFilePath = path.join(homeUserVSCodeType, file);
            if (fs.existsSync(userFilePath)) {
              filePath = userFilePath;
            }
            copyFileSync(
              filePath, path.join(settings.workspaceVSCode, file)
            );
          }
        })
        .catch((err) => { console.error("err", err); });
    })
  }

  /**
   * //todo
   * customize your own json file
   * 
   * @returns {Promise<void>}
   * 
   * @memberOf Generator
   */
  public customize(): Promise<void> {
    const settings = getSettings();
    const homeVSCodeType: string = path.join(settings.homeVSCodeDir, this.type);
    const homeUserVSCodeType: string = path.join(settings.homeUserVsCodeDir, this.type);
    return checkInstallAsync().then(() => {
      return existsOrMkdirAsync(settings.homeUserVsCodeDir);
    }).then(() => {
      return existsOrMkdirAsync(homeUserVSCodeType);
      }).then(() => {
        //todo
    });
  }
}

export function activate(context: ExtensionContext) {
  const install: Disposable =
    commands.registerCommand("extension.installDotVSCodeGenerator", () => {
      uninstallAsync().then(() => {
        return installAsync();
      }).catch((err) => {
        window.showErrorMessage(JSON.stringify(err));
      });
    });

  const uninstall: Disposable = commands.registerCommand(
    "extension.uninstallDotVSCodeGenerator", () => {
      uninstallAsync().then(() => {
        window.showInformationMessage("Uninstallting completed!");
      });
    });

  const generate: Disposable =
    commands.registerCommand("extension.generateDotVSCode", () => {
      window.showQuickPick(projectType).then((token) => {
        if (token === undefined) {
          return;
        }
        const generator = new Generator(token);
        return generator.generate();
      }).then(() => {
        window.showInformationMessage("Generating completed!");
      });
    });
  
  const customize: Disposable =
    commands.registerCommand("extenstion.customizeDotVSCode", () => {
      window.showQuickPick(projectType).then((token) => {
        if (token === undefined) {
          return;
        }
        const generator = new Generator(token);
        return generator.customize();
      });
    });

  context.subscriptions.push(install);
  context.subscriptions.push(uninstall);
  context.subscriptions.push(generate);
}

export function deactivate() {}
