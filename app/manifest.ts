import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Synthesis Platform',
    short_name: 'Synthesis',
    description:
      'Research workspace that answers only from your sources, with every claim cited.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2E5BFF',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
