const fs = require("fs");
const Path = require("path");
const glob = require("glob");
const xcode = require("xcode");
function getRootIOSPath(initialPath) {
  if (!initialPath) initialPath = process.cwd();
  else initialPath = Path.resolve(process.cwd(), initialPath);
  const globs = glob.sync(Path.join(initialPath, "**", "*xcodeproj"));
  if (!globs) return false;
  return Path.dirname(globs[0]);
}
function getBridgingModuleTextFromPath(initialPath) {
  const newdir = getRootIOSPath(initialPath);
  const out = processDir(newdir);
  //Convert file output to class-based output independent of files
  var classes = {};
  Object.keys(out).forEach(path => {
    const cls = out[path];
    Object.keys(cls).forEach(cl => {
      const obj = cls[cl];
      classes[cl] = obj;
    });
  });
  //Distill processed classes
  var processedClasses = {};
  Object.keys(classes).forEach(classname => {
    const obj = classes[classname];
    if (!obj.lines) return;
    var p = {
      name: classname,
      subclasses: obj.subclasses
    };
    if (obj.view) p.view = obj.view;
    obj.lines.forEach(line => {
      switch (line.type) {
        case "func":
          if (!p.methods) p.methods = {};
          p.methods[line.info.name] = line.info;
          break;
        case "var":
          if (!p.properties) p.properties = {};
          p.properties[line.info.name] = line.info;
      }
    });
    processedClasses[classname] = p;
  });
  usedEmitter = false;
  usedViewManager = false;
  outlines = ["#import <React/RCTBridgeModule.h>"];
  Object.keys(processedClasses).forEach(c => {
    //make the class header
    //Look for special classes
    var obj = processedClasses[c];
    if (!obj.methods && !obj.view) return;
    var useEmitter = false;
    var useViewManager = false;
    if (obj.subclasses) {
      if (obj.subclasses.indexOf("RCTEventEmitter") > -1) {
        useEmitter = true;
        usedEmitter = true;
      }
      if (obj.subclasses.indexOf("RCTViewManager") > -1) {
        useViewManager = true;
        usedViewManager = true;
      }
    }
    if (useEmitter) {
      outlines.push("@interface RCT_EXTERN_MODULE(" + c + ", RCTEventEmitter)");
    } else if (useViewManager) {
      outlines.push("@interface RCT_EXTERN_MODULE(" + c + ", RCTViewManager)");
    } else {
      outlines.push("@interface RCT_EXTERN_MODULE(" + c + ", NSObject)");
    }
    if (obj.methods) {
      Object.keys(obj.methods).forEach(methodName => {
        txt = "RCT_EXTERN_METHOD(" + methodName;
        const m = obj.methods[methodName];
        if (m.args) {
          m.args.forEach(arg => {
            var name = arg.name;
            var type = arg.type;
            var isDefault = arg.isDefault;
            if (!isDefault) {
              txt += name;
            }
            txt += ":(" + type + ")" + name + " ";
          });
        }
        txt = txt.trim() + ");";
        outlines.push(txt);
      });
    }
    if (useViewManager && obj.view) {
      const ps = getProperties(obj.view, processedClasses);
      Object.keys(ps).forEach(propertyName => {
        const p = ps[propertyName];
        const type = p.type;
        const txt =
          "RCT_EXPORT_VIEW_PROPERTY(" + propertyName + ", " + type + ");";
        outlines.push(txt);
      });
    }
    outlines.push("@end");
  });

  if (usedEmitter) outlines.unshift("#import <React/RCTEventEmitter.h>");
  if (usedViewManager) outlines.unshift("#import <React/RCTViewManager.h>");
  const finalText = outlines.join("\n");
  return finalText;
}
function processDir(rootPath) {
  var out = {};
  const contents = fs.readdirSync(rootPath).filter(v => {
    if (v == "Pods") return false;
    if (v.indexOf(".") == 0) return false;
    return true;
  });
  contents.forEach(subdir => {
    const fullSubDir = Path.resolve(rootPath, subdir);
    if (fs.lstatSync(fullSubDir).isDirectory()) {
      const o = processDir(fullSubDir);
      out = { ...out, ...o };
    } else {
      const t = processFile(fullSubDir);
      if (t) out[fullSubDir] = t;
    }
  });
  return out;
}
function processFile(filePath) {
  const extension = Path.extname(filePath);
  if (extension.toLowerCase() !== ".swift") return null;
  const txt = fs.readFileSync(filePath, "utf8");
  const lines = txt.split("\n").filter(l => {
    if (l.trim().length > 0) return true;
    return false;
  });
  var foundLines = [];
  lines.filter;
  for (var x = 0; x < lines.length; x++) {
    var line = lines[x];
    if (line.match(/^\s*@objc/)) {
      //if (line.indexOf("@objc") > -1) {
      var obj = { line: x, text: line };
      if (x > 0) obj.before = lines[x - 1];
      if (x < lines.length - 1) obj.after = lines[x + 1];
      var l = processLine(obj);
      if (l) foundLines.push(l);
    }
  }
  //Reprocess lines into classes
  var classes = {};
  var thisClass;
  foundLines.forEach(obj => {
    if (obj.type == "class") {
      var name = obj.info.name;
      if (obj.objcname) {
        name = obj.objcname;
      }
      thisClass = { name: name, subclasses: obj.info.subclasses, lines: [] };
      if (obj.view) thisClass.view = obj.view;
      classes[name] = thisClass;
    } else if (thisClass) {
      thisClass.lines.push(obj);
    } else {
      console.log("Hit error situation with line", obj, filePath);
    }
  });
  return classes;
}
function processLine(v) {
  var t = v.text.trim();
  if (v.text.indexOf("@objc") > -1) {
    var t = v.text.split("@objc")[1].trim();
  }
  const firstspace = t.indexOf(" ");
  const type = t.substr(0, firstspace);
  if (t.indexOf("class func") > -1) {
    //Here's a tricky thing - special exception for class functions, that should never be exported
    return null;
  }
  var rest = t.substr(firstspace);
  var info;
  [v.before, v.after].forEach(line => {
    if (line && line.indexOf("@rn") > -1) {
      //after rn look for the tuples
      const after = line.substr(line.indexOf("@rn") + 3, line.length);
      const tuples = after.split(/[\s&]/);
      tuples.forEach(raw => {
        if (raw.indexOf("=" > 0)) {
          raw = raw.trim();
          const key = raw.substr(0, raw.indexOf("=")).trim();
          const val = raw.substr(raw.indexOf("=") + 1, raw.length).trim();
          if (!key.length) return;
          v[key] = val;
        } else {
          v[raw] = true;
        }
      });
    }
  });
  if (v.before && v.before.indexOf("@rn") > -1) {
  }
  switch (type) {
    case "":
      //This could be because I have a class in the next line. Check it out?
      if (v.after && v.after.indexOf("class") > -1) {
        v.objcname = t.substr(1, t.length - 2);
        v.text = v.after;
        delete v.after;
        return processLine(v);
      }
      return null;
    case "class":
      //Get the subclasses
      //Remove curlybrace

      if (rest.indexOf("{") > -1) {
        rest = rest.substr(0, rest.indexOf("{"));
      }
      if (rest.indexOf(":") > -1) {
        var subclasses = rest
          .substr(rest.indexOf(":") + 1, rest.length)
          .split(",")
          .map(v => {
            return v.trim();
          });
        info = {
          name: rest.substr(0, rest.indexOf(":")).trim(),
          subclasses: subclasses
        };
      } else {
        info = { name: rest.trim() };
      }
      break;
    case "func":
      const name = rest.substr(0, rest.indexOf("(")).trim();
      var argstr = rest.substr(rest.indexOf("(") + 1, rest.length);
      if (argstr.indexOf("{") > -1) {
        argstr = argstr.substr(0, argstr.indexOf("{"));
      }
      if (argstr.indexOf(")") > -1) {
        argstr = argstr.substr(0, argstr.indexOf(")"));
      }
      args = argstr.split(",").map(v => {
        return v.trim();
      });
      args = args.map(arg => {
        const colonpos = arg.indexOf(":");
        const name = arg.substr(0, colonpos).trim();
        const type = arg.substr(colonpos + 1, arg.length).trim();

        if (!name) return null;
        return { name: name, type: getOCType(type) };
      });
      if (args[0] && args[0].name.indexOf("_") === 0) {
        const pieces = args[0].name.split(" ");
        args[0].name = pieces[1];
        args[0].isDefault = true;
      }
      info = { name: name, args: args };
      break;
    case "var":
      //Check for a type
      const colonPos = rest.indexOf(":");
      const eqPos = rest.indexOf(":");
      if (colonPos > -1 && (eqPos > -1 || colonPos > eqPos)) {
        const name = rest.substr(0, colonPos).trim();
        if (v.type) {
          info = { name: name, type: getOCType(v.type) };
          break;
        }
        //The word following the colon is the type
        var afterColon = rest.substr(colonPos + 1, rest.length);
        if (afterColon.indexOf("{") > -1)
          afterColon = afterColon.substr(0, afterColon.indexOf("{"));
        const eqPos2 = afterColon.indexOf("=");
        if (eqPos2 > -1) {
          const type = getOCType(afterColon.substr(0, eqPos2).trim());
          info = { name: name, type: type };
          break;
        } else {
          const type = getOCType(afterColon.trim());
          info = { name: name, type: type };
          break;
        }
      }
      console.log("I don't know what to do with ", rest);
  }
  v["type"] = type;
  v["info"] = info;
  return v;
}
function getOCType(type) {
  if (type.substr(-1) == "?") type = type.substr(0, type.length - 1);
  switch (type) {
    case "Int":
    case "Int32":
    case "Integer":
    case "Float":
    case "Double":
      return "NSNumber *";
    case "NSInteger":
      return type;
    case "String":
      return "NSString *";
    case "jsonType":
      return "NSDictionary *";
    case "Bool":
      return "BOOL";
    default:
      //Try some new techniques
      if (type.indexOf("[") === 0) {
        if (type.indexOf(":") > 0) {
          return "NSDictionary *";
        } else {
          return "NSArray *";
        }
      }
      if (type.indexOf("Block") > -1) {
        return type;
      } else {
        return type + " *";
      }
  }
  return type;
}
function getProperties(className, processedClasses) {
  const obj = processedClasses[className];
  if (obj && obj.properties) {
    return obj.properties;
  }
  return null;
}
function writeIf(outfile, text) {
  if (fs.existsSync(outfile)) {
    const oldText = fs.readFileSync(outfile, "utf8");
    if (oldText == text) {
      return false;
    } else {
      fs.unlinkSync(outfile);
    }
  }
  const result = fs.writeFileSync(outfile, text);
  if (!result) console.log("Could not write file", outfile);
  return true;
}
function getProjectPath(path) {
  if (!path) path = process.cwd();
  const iosPath = getRootIOSPath(path);
  const globs = glob.sync(
    Path.join(iosPath, "**", "*xcodeproj", "project.pbxproj")
  );
  if (!globs || !globs.length) return false;
  return globs[0];
}
function addModuleToPBXProj(outfile, iosPath) {
  const projpath = getProjectPath(iosPath);
  if (!projpath) return false;
  const project = xcode.project(projpath);
  project.parseSync();
  //Find my file - outfile!
  const basename = Path.basename(outfile);
  project.addSourceFileNew(basename);

  const out = project.writeSync();
  fs.writeFileSync(projpath, out);
}

module.exports = {
  getBridgingModuleTextFromPath,
  getRootIOSPath,
  writeIf,
  addModuleToPBXProj
};
