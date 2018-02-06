#!/usr/bin/env node
const core = require("./index.js");
const commander = require("commander");
const fs = require("fs");
const watch = require("node-watch");
const Path = require("path");

commander.usage("[options] [targetpath]");
commander.option("-o --out <outfile>");
commander.option("-w --watch");
commander.parse(process.argv);
var thisPath = commander.args[0];
if (!thisPath || !thisPath.length) {
  thisPath = process.cwd();
}
var outfile = commander.out;
if (!outfile) outfile = core.getRootIOSPath(thisPath);
if (fs.existsSync(outfile) && fs.lstatSync(outfile).isDirectory()) {
  outfile = Path.join(outfile, "rn-swift-bridge.m");
}
if (commander.watch) {
  console.log("Watching for swift changes on " + thisPath);
  watch(thisPath, { recursive: true, filter: /\.swift$/ }, () => {
    const text = core.getBridgingModuleTextFromPath(thisPath);
    console.log("Detected change");
    if (core.writeIf(outfile, text)) console.log("Updated " + outfile);
  });
} else {
  const text = core.getBridgingModuleTextFromPath(thisPath);
  if (core.writeIf(outfile, text))
    console.log("Successfully wrote to ", outfile);
  else console.log("No changes to ", outfile);
}
