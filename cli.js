#!/usr/bin/env node
const core = require("./index.js");
const commander = require("commander");
const fs = require("fs");
const watch = require("node-watch");
const Path = require("path");
const cp = require("child_process");
commander.usage("[options] [targetpath]");
commander.option("-o --out <outfile>");
commander.option("-w --watch");
commander.parse(process.argv);
var thisPath = commander.args[0] ? commander.args[0] : process.cwd();
var jsFile = commander.js
  ? commander.js
  : Path.join(thisPath, "RNSwiftBridge.js");
var outfile = commander.out;
if (!outfile) outfile = core.getRootIOSPath(thisPath);
if (fs.existsSync(outfile) && fs.lstatSync(outfile).isDirectory()) {
  outfile = Path.join(outfile, "rn-swift-bridge.m");
}
if (commander.watch) {
  try {
    console.log("Watching for swift changes on " + thisPath);
    watch(thisPath, { recursive: true, filter: /\.swift$/ }, () => {
      const text = core.getBridgingModuleTextFromPath(thisPath);
      console.log("Detected change");
      if (core.writeIf(outfile, text)) {
        core.addModuleToPBXProj(outfile, thisPath);
        console.log("Updated " + outfile);
        if (core.writeIf(jsFile, core.getJSFromPath(thisPath))) {
          console.log("Updated " + jsFile);
        }
      }
    });
  } catch (e) {
    console.log("Hit error ", e);
  }
} else {
  try {
    const text = core.getBridgingModuleTextFromPath(thisPath);
    if (core.writeIf(outfile, text)) {
      core.addModuleToPBXProj(outfile, thisPath);
    } else console.log("No changes to ", outfile);
    console.log("Updated " + outfile);
    if (core.writeIf(jsFile, core.getJSFromPath(thisPath))) {
      console.log("Updated " + jsFile);
    }
  } catch (e) {
    console.log("Hit error ", e);
  }
}
