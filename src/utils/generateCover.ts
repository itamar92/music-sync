export const generateGradientCover = (name: string, size: number = 200): string => {
  // Create a hash from the name for consistent colors
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Generate colors based on hash
  const colors = [
    // Primary gradients
    ['#667eea', '#764ba2'],
    ['#f093fb', '#f5576c'],
    ['#4facfe', '#00f2fe'],
    ['#43e97b', '#38f9d7'],
    ['#fa709a', '#fee140'],
    ['#a8edea', '#fed6e3'],
    ['#ffecd2', '#fcb69f'],
    ['#ff8a80', '#ff80ab'],
    ['#84fab0', '#8fd3f4'],
    ['#a6c0fe', '#f68084'],
    // Music-themed gradients
    ['#667eea', '#764ba2'],
    ['#f093fb', '#f5576c'],
    ['#4facfe', '#00f2fe'],
    ['#43e97b', '#38f9d7'],
    ['#fa709a', '#fee140'],
  ];

  const colorIndex = Math.abs(hash) % colors.length;
  const [color1, color2] = colors[colorIndex];

  // Create SVG with gradient background and text
  const firstLetter = name.charAt(0).toUpperCase();
  
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#grad)" />
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" 
            font-family="Arial, sans-serif" font-size="${size * 0.4}" font-weight="bold" 
            fill="white" opacity="0.9">
        ${firstLetter}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

export const generatePlaylistCover = (playlistName: string, size: number = 200): string => {
  return generateGradientCover(playlistName, size);
};