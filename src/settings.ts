
import * as vscode from "vscode";
import * as Promsie from "bluebird";
import * as fs from "fs";
import * as path from "path";
const semver = require("semver");
import * as os from "os";


let settings = null;

/**
 * to get the settings object
 * 
 * @export
 * @returns
 */
export function getSettings() {
  if (settings) {
    return settings;
  }
  const isInsiders = /insiders/i.test(vscode.env.appName);
  const version = semver(vscode.version);
  const isWin = /^win/.test(process.platform);
  const homeDir = os.homedir();
  // my static file on qiniu.com
  const downloadUrl =
    `http://7xk052.com1.z0.glb.clouddn.com/defaults.zip`;
  // like `~/.vscod/.vsc-generatore`
  const homeVSCodeDir: string = path.join(
    homeDir,
    ".vscode",
    ".vsc-generator"
  );
  // like `~/.vscod/.vsc-generator.user`
  const homeUserVsCodeDir: string = path.join(
    homeDir,
    ".vscode",
    ".vsc-generator.user"
  );
  const workspaceVSCode: string =
    path.join(vscode.workspace.rootPath, ".vscode");
  // like `/tmp/dotvscodeGenerator.zip`
  const zipDir = path.join(os.tmpdir(), "dotvscodeGenerator.zip");
  settings = {
    isWin,
    isInsiders,
    version,
    homeDir,
    downloadUrl,
    zipDir,
    homeUserVsCodeDir,
    homeVSCodeDir,
    workspaceVSCode
  };
  return settings;
};