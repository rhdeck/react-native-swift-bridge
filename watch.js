#!/usr/bin/env node
const watch = require("node-watch");
const core = require("./index.js");
const commander = require("commander");
const Path = require("path");
commander.usage("[options] [targetpath]");
commander.option("-o --out <outfile>");
commander.parse(process.argv);
var thisPath = commander.args[0];
if (!thisPath) thisPath = process.cwd();
thisPath = core.getRootIOSPath(thisPath);
var outfile = commander.out;
if (!outfile) outfile = Path.join(thisPath, "rn-swift-bridge.m");
console.log("Watching for swift changes on " + thisPath);
watch(thisPath, { recursive: true, filter: /\.swift$/ }, () => {
  const text = core.getBridgingModuleTextFromPath(thisPath);
  console.log("Detected change");
  if (core.writeIf(outfile, text)) console.log("Updated " + outfile);
});
