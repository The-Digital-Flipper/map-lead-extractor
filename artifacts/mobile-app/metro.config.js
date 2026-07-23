const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the workspace root so Metro can resolve shared libs (lib/*)
config.watchFolders = [workspaceRoot];

// Block Metro from watching other artifacts and any dist/build output
// directories. During a parallel production build the sibling artifacts'
// dist folders may not exist yet, which causes Metro to throw ENOENT.
config.resolver = config.resolver || {};
config.resolver.blockList = [
  // Other artifacts (not this one)
  /artifacts\/lead-extractor-site\/.*/,
  /artifacts\/api-server\/.*/,
  /artifacts\/mockup-sandbox\/.*/,
  // Any dist / build output directories anywhere in the workspace
  /.*\/dist\/.*/,
  /.*\/static-build\/.*/,
  /.*\/\.expo\/.*/,
];

module.exports = config;
