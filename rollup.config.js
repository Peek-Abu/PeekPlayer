import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

export default [
  // Main bundle
  {
    input: 'src/core/player.js',
    output: [
      {
        file: 'dist/peekplayer.js',
        format: 'umd',
        name: 'PeekPlayer',
        globals: {
          'hls.js': 'Hls'
        }
      },
      {
        file: 'dist/peekplayer.min.js',
        format: 'umd',
        name: 'PeekPlayer',
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
      nodeResolve()
    ]
  },
  // Embed bundle (self-contained for iframe usage)
  {
    input: 'src/embed/embed-entry.js',
    output: {
      file: 'dist/peekplayer-embed.js',
      format: 'iife',
      name: 'PeekPlayerEmbed'
    },
    plugins: [
      nodeResolve(),
      terser()
    ]
  }
];
