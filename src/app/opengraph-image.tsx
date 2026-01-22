import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Quoth - Wisdom over Guesswork';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0F0F0F 0%, #1A1A1A 50%, #262626 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        {/* Gradient overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.15) 0%, transparent 50%)',
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          {/* Logo text */}
          <div
            style={{
              fontSize: 96,
              fontWeight: 700,
              color: '#8B5CF6',
              marginBottom: 16,
              letterSpacing: '-0.02em',
            }}
          >
            Quoth
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 36,
              color: '#DDD6FE',
              marginBottom: 24,
              fontWeight: 400,
            }}
          >
            The Living Source of Truth
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: 24,
              color: '#9CA3AF',
              maxWidth: 700,
              textAlign: 'center',
              lineHeight: 1.4,
            }}
          >
            MCP server for documentation-driven development
          </div>

          {/* Bottom tagline */}
          <div
            style={{
              position: 'absolute',
              bottom: 48,
              fontSize: 18,
              color: '#6B7280',
              fontStyle: 'italic',
            }}
          >
            Wisdom over Guesswork
          </div>
        </div>

        {/* Decorative border */}
        <div
          style={{
            position: 'absolute',
            top: 24,
            left: 24,
            right: 24,
            bottom: 24,
            border: '1px solid rgba(139, 92, 246, 0.2)',
            borderRadius: 16,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
