const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the workspace root so Metro can resolve shared libs (lib/*)
config.watchFolders = [workspaceRoot];

// Block Metro from watching other artifacts' source trees.
// During a parallel production build the sibling artifacts' dist folders
// may not exist yet, causing Metro to throw ENOENT.
//
// IMPORTANT: do NOT add broad patterns like /dist/ here — that would block
// node_modules packages that ship their built files under a dist/ folder
// (e.g. @radix-ui/react-slot), causing HTTP 500 bundling failures.
config.resolver = config.resolver || {};
config.resolver.blockList = [
  // Sibling artifact source trees (not this app)
  /\/artifacts\/lead-extractor-site\//,
  /\/artifacts\/api-server\//,
  /\/artifacts\/mockup-sandbox\//,
  // This app's own build output (not source)
  /\/artifacts\/mobile-app\/static-build\//,
  /\/artifacts\/mobile-app\/\.expo\//,
];

module.exports = config;
