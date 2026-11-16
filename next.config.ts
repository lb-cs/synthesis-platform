import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  redirects() {
    return [
      // The dashboard was renamed Workspaces; keep old links and bookmarks working.
      { source: '/dashboard', destination: '/workspaces', permanent: false },
    ];
  },
};

export default nextConfig;

// Ticket # https://quintessentialalgorithms.atlassian.net/browse/CECS491-34?atlOrigin=eyJpIjoiZWI1ZTQ2YzI0YzAxNGVhY2JlNmZlYWE0MTI2MjQxZjEiLCJwIjoiaiJ9
