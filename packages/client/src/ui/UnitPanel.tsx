import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { getUnitDefinition } from '@battle-masters/game-logic';
import { theme, getFactionTheme } from './theme';

export function UnitPanel() {
  const state = useGameStore((s) => s.state);
  const inspectedUnitId = useUIStore((s) => s.inspectedUnitId);

  if (!state || !inspectedUnitId) return null;

  const unit = state.units.get(inspectedUnitId);
  if (!unit) return null;

  const def = getUnitDefinition(unit.definitionType);
  const factionTheme = getFactionTheme(unit.faction);

  return (
    <div style={{
      padding: '10px 0',
      borderLeft: `3px solid ${factionTheme.primary}`,
      paddingLeft: 12,
    }}>
      <div style={{
        fontSize: theme.fontSizes.md,
        fontFamily: theme.fonts.display,
        color: factionTheme.primary,
        marginBottom: 6,
      }}>
        {def.name}
      </div>

      {/* HP / Damage */}
      <div style={{ marginBottom: 8 }}>
        <div style={{
          fontSize: theme.fontSizes.xs,
          fontFamily: theme.fonts.body,
          color: theme.colors.textMuted,
          marginBottom: 4,
        }}>
          HP {unit.hp}/{unit.maxHp}
        </div>
        {/* Health bar */}
        <div style={{
          width: '100%',
          height: 6,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 3,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${(unit.hp / unit.maxHp) * 100}%`,
            height: '100%',
            background: unit.hp < unit.maxHp
              ? (unit.hp <= 1 ? theme.colors.danger : theme.colors.warning)
              : theme.colors.success,
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '4px 12px',
        fontSize: theme.fontSizes.sm,
        fontFamily: theme.fonts.body,
      }}>
        <Stat label="CV" value={def.combatValue} color={theme.colors.warning} />
        <Stat label="MOV" value={def.movement} color={theme.colors.success} />
        <Stat label="RNG" value={def.range} color="#cccc44" />
        {def.minRange && <Stat label="MIN" value={def.minRange} color="#cc8844" />}
      </div>

      {/* Status */}
      <div style={{
        marginTop: 8,
        fontSize: theme.fontSizes.xs,
        fontFamily: theme.fonts.body,
        color: theme.colors.textMuted,
      }}>
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
      <span style={{ color: theme.colors.textMuted }}>{label}: </span>
      <span style={{ color, fontWeight: 'bold' }}>{value}</span>
    </div>
  );
}
