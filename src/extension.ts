'use strict';

import {
  ExtensionContext,
  commands,
  window,
  Disposable,
  InputBoxOptions
} from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import * as os from "os";
import {getSettings} from "./settings";
import * as request from "request";
const Promise = require("bluebird");
const extract = require("extract-zip");


const ProjectType = [];

const ProjectMap: Map<string, string> = new Map();
ProjectMap.set("C++", "cplusplus");
ProjectMap.set("TypeScript", "typescript");

ProjectMap.forEach((value, index) => {
  ProjectType.push(value);
});

const errors = {
  "installNeeded": "Please run `install` command first"
};

function existsAsync(path: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    fs.exists(path, (exists: boolean): void => { return resolve(exists); });
  });
};

const mkdirAsync = Promise.promisify(fs.mkdir);
const unlinkAsync = Promise.promisify(fs.unlink);
const extractAsync = Promise.promisify(extract);
const readdirAsync = Promise.promisify(fs.readdir);
const writeFileAsync = Promise.promisify(fs.writeFile);

function copyFileSync(fromPath: string, toPath: string) {
  if (fs.existsSync(toPath)) {
    fs.unlinkSync(toPath);
  }
  const fromStream = fs.createReadStream(fromPath);
  const toStream = fs.createWriteStream(toPath);
  fromStream.pipe(toStream);
}

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

function uninstallAsync(): Promise<void> {
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
}

class Generator {
  type: string = null;
  constructor(type: string) { this.type = type; }

  public generate(): Promise<void> {
    const settings = getSettings();
    const homeVSCodeType: string = path.join(settings.homeVSCodeDir, this.type);
    const homeUserVSCodeType: string = path.join(settings.homeUserVsCodeDir, this.type);
    return existsAsync(settings.workspaceVSCode).then((exists): void => {
      let mkdir = null;
      if (!exists) {
        mkdir = mkdirAsync(settings.workspaceVSCode);
      } else {
        mkdir = Promise.resolve(() => { });
      }
      return mkdir.then(() => {
        return readdirAsync(homeVSCodeType)
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
          .catch((err) => { console.error(err); });
      });
    });
  }
}

export function activate(context: ExtensionContext) {
  const install: Disposable =
    commands.registerCommand("extension.installDotVSCodeGenerator", () => {
      installAsync().catch((err) => {
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
      window.showQuickPick(ProjectType).then((token) => {
        if (token === undefined) {
          return;
        }
        const generator = new Generator(token);
        return generator.generate();
      }).then(() => {
        window.showInformationMessage("Generating completed!");
      });
    });

  context.subscriptions.push(install);
  context.subscriptions.push(uninstall);
  context.subscriptions.push(generate);
}

export function deactivate() {}
