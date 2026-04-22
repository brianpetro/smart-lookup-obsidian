import esbuild from 'esbuild';
import path from 'path';
import 'dotenv/config';
import { build_plugin } from 'obsidian-smart-env/build/build_plugin.js';
import { build_smart_env_config } from 'obsidian-smart-env/build/build_env_config.js';

/**
 * Create banner comment for esbuild bundle.
 * @param {{name: string, version: string, author: string}} pkg package metadata
 * @returns {string} banner comment
 */
function create_banner(pkg) {
  const year = new Date().getFullYear();
  return `/*! ${pkg.name} v${pkg.version} | (c) ${year} ${pkg.author} */`;
}

const roots = [
  path.resolve(process.cwd(), 'src'),
];

build_plugin({
  esbuild,
  build_banner: create_banner,
  entry_point: 'src/main.js',
  entry_point_from_argv: true,
  env_config_builder: build_smart_env_config,
  env_config_output_dir: process.cwd(),
  env_config_roots: roots,
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
