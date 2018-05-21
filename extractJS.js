#!/usr/bin/env node
const RNSB = require("./index");
const Path = require("path");
const fs = require("fs");
var thisPath = process.cwd();
if (process.argv[2]) thisPath = process.argv[2];
const out = RNSB.getJSFromPath(thisPath);
console.log(out);
fs.writeFileSync(Path.join(thisPath, "RNSwiftBridge.js"), out);
