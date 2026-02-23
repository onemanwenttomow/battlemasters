import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { getUnitDefinition } from '@battle-masters/game-logic';

const FACTION_COLORS = {
  imperial: '#4488cc',
  chaos: '#cc4444',
};

export function UnitPanel() {
  const state = useGameStore((s) => s.state);
  const inspectedUnitId = useUIStore((s) => s.inspectedUnitId);

  if (!state || !inspectedUnitId) return null;

  const unit = state.units.get(inspectedUnitId);
  if (!unit) return null;

  const def = getUnitDefinition(unit.definitionType);
  const color = FACTION_COLORS[unit.faction];

  return (
    <div style={{
      position: 'absolute',
      bottom: 16,
      left: 16,
      background: 'rgba(0,0,0,0.8)',
      borderRadius: 10,
      padding: '12px 18px',
      border: `2px solid ${color}`,
      minWidth: 180,
    }}>
      <div style={{ fontSize: '1rem', fontWeight: 'bold', color, marginBottom: 6 }}>
        {def.name}
      </div>

      {/* HP / Damage */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: 2 }}>
          HP {unit.hp}/{unit.maxHp}
        </div>
        {unit.maxHp - unit.hp > 0 && (
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {Array.from({ length: unit.maxHp - unit.hp }, (_, i) => (
              <span key={i} style={{ fontSize: '1rem', lineHeight: 1 }}>💀</span>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '0.8rem' }}>
        <Stat label="CV" value={def.combatValue} color="#ff8844" />
        <Stat label="MOV" value={def.movement} color="#44cc44" />
        <Stat label="RNG" value={def.range} color="#cccc44" />
        {def.minRange && <Stat label="MIN" value={def.minRange} color="#cc8844" />}
      </div>

      {/* Status */}
      <div style={{ marginTop: 8, fontSize: '0.7rem', color: '#888' }}>
        {unit.hasMoved && <span style={{ marginRight: 8 }}>Moved</span>}
        {unit.hasAttacked && <span style={{ marginRight: 8 }}>Attacked</span>}
        {unit.hasActivated && <span>Done</span>}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <span style={{ color: '#888' }}>{label}: </span>
      <span style={{ color, fontWeight: 'bold' }}>{value}</span>
    </div>
  );
}
