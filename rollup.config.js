import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import { copyFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// Plugin to copy CSS and TypeScript definitions
const copyAssets = () => ({
  name: 'copy-assets',
  buildEnd() {
    try {
      mkdirSync('dist', { recursive: true });
      
      // Copy CSS
      copyFileSync('style.css', 'dist/peekplayer.css');
      console.log('✅ Copied style.css to dist/peekplayer.css');
      
      // Copy TypeScript definitions
      copyFileSync('peekplayer.d.ts', 'dist/peekplayer.d.ts');
      console.log('✅ Copied TypeScript definitions to dist/peekplayer.d.ts');
      
    } catch (error) {
      console.error('❌ Failed to copy assets:', error);
    }
  }
});

export default {
  input: 'src/core/player.js',
  output: [
    {
      file: 'dist/peekplayer.js',
      format: 'umd',
      name: 'PeekPlayer',
      exports: 'named',
      globals: {
        'hls.js': 'Hls'
      }
    },
    {
      file: 'dist/peekplayer.min.js',
      format: 'umd',
      name: 'PeekPlayer',
      exports: 'named',
      plugins: [terser()],
      globals: {
        'hls.js': 'Hls'
      }
    },
    {
      file: 'dist/peekplayer.esm.js',
      format: 'es'
    }
  ],
  external: ['hls.js'],
  plugins: [
    nodeResolve(),
    copyAssets()
  ]
};
