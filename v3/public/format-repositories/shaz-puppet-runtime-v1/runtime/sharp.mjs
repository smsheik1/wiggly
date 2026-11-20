/**
 * The ONE sharp (libvips) import for anything that runs in the same Node process as the kit
 * runtime. The daily studio imports sharp from here instead of its own node_modules: two copies
 * of libvips in one process trigger "Class GNotificationCenterDelegate is implemented in both"
 * on macOS and can crash renders.
 */
export { default } from "sharp";
