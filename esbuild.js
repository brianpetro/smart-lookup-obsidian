import esbuild from 'esbuild';
import path from 'path';
import { build_plugin } from 'obsidian-smart-env/build/build_plugin.js';

/**
 * Create banner comment for esbuild bundle.
 * @param {{name: string, version: string, author: string}} pkg package metadata
 * @returns {string} banner comment
 */
function create_banner(pkg) {
  const year = new Date().getFullYear();
  return `/*! ${pkg.name} v${pkg.version} | (c) ${year} ${pkg.author} */`;
}

build_plugin({
  esbuild,
  build_banner: create_banner,
  entry_point: 'src/main.js',
  entry_point_from_argv: true,
  external: [
    '@xenova/transformers',
    '@huggingface/transformers',
    'http',
    'url',
  ],
  plugin_id: 'smart-lookup',
  styles_path: path.join(process.cwd(), 'src', 'styles.css'),
}).catch((err) => {
  console.error('Error in build process:', err);
  process.exit(1);
});
