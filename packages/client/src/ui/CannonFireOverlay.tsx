import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import type { Effects } from '../engine/Effects';
import type { CannonTileType } from '@battle-masters/game-logic';

const TILE_CONFIG: Record<CannonTileType, { label: string; color: string; image: string }> = {
  flying: { label: 'Flying Cannonball', color: '#4488ff', image: '/assets/cards/cannon/canon-fly.png' },
  bouncing: { label: 'Bouncing Cannonball', color: '#ffaa44', image: '/assets/cards/cannon/canon-bounce.png' },
  explosion: { label: 'Explosion!', color: '#ff3333', image: '/assets/cards/cannon/canon-explosion.png' },
};

interface CannonFireOverlayProps {
  effects: Effects | null;
}

export function CannonFireOverlay({ effects }: CannonFireOverlayProps) {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const showCannonOverlay = useUIStore((s) => s.showCannonOverlay);
  const setShowCannonOverlay = useUIStore((s) => s.setShowCannonOverlay);
  const setCannonFiringStep = useUIStore((s) => s.setCannonFiringStep);
  const prevTileCountRef = useRef(0);

  const cfs = state?.cannonFireState ?? null;

  // Spawn effects when new tiles are placed
  useEffect(() => {
    if (!cfs || !effects) return;

    const currentCount = cfs.placedTiles.length;
    if (currentCount > prevTileCountRef.current) {
      const lastTile = cfs.placedTiles[currentCount - 1];
      if (lastTile) {
        if (lastTile.tile.type === 'bouncing') {
          effects.spawnBouncingEffect(lastTile.coord);
        } else if (lastTile.tile.type === 'explosion') {
          effects.spawnExplosionEffect(lastTile.coord);
        }
      }
    }
    prevTileCountRef.current = currentCount;
  }, [cfs?.placedTiles.length, cfs, effects]);

  // Update cannon firing step when resolved
  useEffect(() => {
    if (cfs?.resolved && showCannonOverlay) {
      setCannonFiringStep('resolved');
    }
  }, [cfs?.resolved, showCannonOverlay, setCannonFiringStep]);

  if (!showCannonOverlay || !cfs) return null;

  const handleDismiss = () => {
    setShowCannonOverlay(false);
    setCannonFiringStep('idle');
    dispatch({ type: 'END_CANNON_FIRE' });
  };

  const handleDrawTile = () => {
    if (!cfs.resolved) {
      dispatch({ type: 'DRAW_CANNON_TILE' });
    }
  };

  // Get description for a placed tile using tileResults
  const getTileDescription = (index: number) => {
    const tr = cfs.tileResults[index];
    if (!tr) return '';
    if (tr.tileType === 'flying') return 'Flies onward...';
    if (tr.tileType === 'bouncing') {
      if (tr.unitHit) {
        return tr.destroyed ? `${tr.unitHit} destroyed!` : `${tr.unitHit} hit! (1 damage)`;
      }
      return 'No unit hit';
    }
    if (tr.tileType === 'explosion') {
      if (cfs.misfire && index === 0) return 'MISFIRE!';
      if (tr.unitHit) return `${tr.unitHit} destroyed!`;
      return 'Shot stopped!';
    }
    return '';
  };

  // Tile history row
  const renderTileHistory = () => {
    if (cfs.placedTiles.length === 0) return null;
    return (
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        {cfs.placedTiles.map((pt, i) => {
          const cfg = TILE_CONFIG[pt.tile.type];
          const isLast = i === cfs.placedTiles.length - 1;
          return (
            <div key={i} style={{
              width: 40,
              height: 40,
              borderRadius: 6,
              border: `2px solid ${cfg.color}`,
              opacity: isLast ? 1 : 0.7,
              overflow: 'hidden',
              transition: 'all 0.2s ease-out',
            }}>
              <img src={cfg.image} alt={pt.tile.type} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          );
        })}
      </div>
    );
  };

  // Adjacent shot — show immediate result
  if (cfs.adjacentShot) {
    return (
      <div style={overlayStyle} onClick={handleDismiss}>
        <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: 8 }}>Adjacent Shot</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: cfs.targetDestroyed ? '#44cc44' : '#ff4444', marginBottom: 8 }}>
          {cfs.targetDestroyed ? 'Target Destroyed!' : 'Target Hit! (1 damage)'}
        </div>
        <div style={hintStyle}>Click to dismiss</div>
      </div>
    );
  }

  // Resolved — show final result with full history
  if (cfs.resolved) {
    let resultText: string;
    let resultColor: string;

    if (cfs.misfire) {
      resultText = 'MISFIRE!';
      resultColor = '#ff3333';
    } else if (cfs.targetDestroyed) {
      resultText = 'Target Destroyed!';
      resultColor = '#44cc44';
    } else {
      resultText = 'Shot Complete';
      resultColor = '#aaaaaa';
    }

    return (
      <div style={overlayStyle} onClick={handleDismiss}>
        <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: 8 }}>Cannon Fire</div>
        {renderTileHistory()}
        <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: resultColor, marginBottom: 4 }}>
          {resultText}
        </div>
        <div style={hintStyle}>Click to dismiss</div>
      </div>
    );
  }

  // Drawing phase — show history + last tile info + click to draw next
  const lastTile = cfs.placedTiles.length > 0 ? cfs.placedTiles[cfs.placedTiles.length - 1] : null;
  const lastTileConfig = lastTile ? TILE_CONFIG[lastTile.tile.type] : null;

  return (
    <div style={overlayStyle} onClick={handleDrawTile}>
      <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: 8 }}>
        Cannon Fire — Tile {cfs.placedTiles.length} / {cfs.path.length}
      </div>

      {renderTileHistory()}

      {/* Current tile info */}
      {lastTileConfig && lastTile && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: lastTileConfig.color }}>
            {lastTileConfig.label}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: 4 }}>
            {getTileDescription(cfs.placedTiles.length - 1)}
          </div>
        </div>
      )}

      <div style={hintStyle}>
        {cfs.placedTiles.length === 0 ? 'Click to draw first tile' : 'Click to draw next tile'}
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  background: 'rgba(0,0,0,0.9)',
  borderRadius: 12,
  padding: '16px 24px',
  border: '2px solid #555',
  textAlign: 'center',
  animation: 'fadeIn 0.2s ease-out',
  pointerEvents: 'auto',
  cursor: 'pointer',
  zIndex: 101,
  minWidth: 200,
};

const hintStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  color: '#555',
  marginTop: 8,
};
