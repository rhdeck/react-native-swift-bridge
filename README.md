# react-native-swift-bridge

Utility for never having to write Objective-C bridging code for your swift app again!

# Usage

```
cd /path/to/my/module
rnsb
```

This will scan your swift files, make the bridge based on exposed (with the `@objc` attribute) classes, methods and properties. A file called rn-swift-bridge will be created and - if it is not already - added to your module.

# Watch mode: rnsb --watch

Watches for changes in swift files in your module, and rebuilds the .m bridge on the fly.

```
cd /path/to/my/module
rnsb --watch
```

# Tips

1. The utility does not support `@objcmembers` yet so you need to indicate which classes, methods and properties to expose via individual `@objc` tags
2. When working with types it cannot identify (e.g. enums that are implicitly ints) it needs a little help on a prior line: add a line comment like so:

```
//@rn type=NSInteger
@objc var worldAlignment:ARConfiguration.WorldAlignment {
```

3. When working with a viewmanager, give an `@rn` hint of the class that will contain the view:

```
// @rn view=RHDARView
@objc(RHDARViewManager)
```
