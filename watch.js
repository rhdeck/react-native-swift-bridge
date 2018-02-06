#!/usr/bin/env node
const cp = require("child_process");
const Path = require("path");
const fs = require("fs");
const thisPath = fs.realpathSync(process.argv[1]);
const clipath = Path.join(Path.dirname(thisPath), "cli.js");
const args = [...process.argv.slice(2, process.argv.length), "--watch"];
cp.spawnSync(clipath, args, { stdio: "inherit" });
