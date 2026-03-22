import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import {
  getUnitDefinition,
  coordToKey,
  hexDistance,
  getCombatDiceCounts,
  getDitchAttackModifier,
  getDitchDefenseModifier,
} from '@battle-masters/game-logic';
import type { TerrainType } from '@battle-masters/game-logic';
import { theme, getFactionTheme } from './theme';
import { MedievalButton } from './components/MedievalButton';

export function CombatDialog() {
  const state = useGameStore((s) => s.state);
  const pendingAttack = useUIStore((s) => s.pendingAttack);
  const clearPendingAttack = useUIStore((s) => s.clearPendingAttack);
  const startDiceRoll = useUIStore((s) => s.startDiceRoll);

  if (!pendingAttack || !state) return null;

  const attacker = state.units.get(pendingAttack.attackerId);
  const defender = state.units.get(pendingAttack.defenderId);
  if (!attacker || !defender) return null;

  const attackerDef = getUnitDefinition(attacker.definitionType);
  const defenderDef = getUnitDefinition(defender.definitionType);

  const attackerTerrain: TerrainType = state.board.tiles.get(coordToKey(attacker.position))?.terrain ?? 'plain';
  const defenderTerrain: TerrainType = state.board.tiles.get(coordToKey(defender.position))?.terrain ?? 'plain';

  const distance = hexDistance(attacker.position, defender.position);
  const chargeBonus = state.currentCard?.special === 'CHARGE' ? 1 : 0;
  const ditchAttackModifier = getDitchAttackModifier(state.board, attacker.position, defender.position, attacker.definitionType);
  const ditchDefenseModifier = getDitchDefenseModifier(state.board, attacker.position, defender.position);

  const { attackDice, defenseDice } = getCombatDiceCounts(attacker, defender, {
    attackerTerrain,
    defenderTerrain,
    distance,
    chargeBonus,
    ditchAttackModifier,
    ditchDefenseModifier,
  });

  const handleRollDice = () => {
    startDiceRoll({
      attackerId: pendingAttack.attackerId,
      defenderId: pendingAttack.defenderId,
      attackDice,
      defenseDice,
      isCharge: chargeBonus > 0,
      defenderPosition: { ...defender.position },
    });
    clearPendingAttack();
  };

  const handleCancel = () => {
    clearPendingAttack();
  };

  return (
    <div style={{
      textAlign: 'center',
      animation: 'fadeIn 0.15s ease-out',
    }}>
      <div style={{
        fontSize: theme.fontSizes.lg,
        fontFamily: theme.fonts.display,
        color: theme.colors.gold,
        marginBottom: 12,
        letterSpacing: '0.05em',
      }}>
        Combat
      </div>

      {/* Attacker */}
      <UnitInfo
        name={attackerDef.name}
        faction={attacker.faction}
        cv={attackerDef.combatValue}
        hp={attacker.hp}
        maxHp={attacker.maxHp}
        terrain={attackerTerrain}
        label="Attacker"
        diceCount={attackDice}
        diceColor={theme.colors.warning}
        modifiers={[
          ...(chargeBonus > 0 ? [{ label: '+1 Charge', color: theme.colors.warning }] : []),
          ...(ditchAttackModifier < 0 ? [{ label: `${ditchAttackModifier} Ditch`, color: theme.colors.danger }] : []),
        ]}
      />

      <div style={{
        fontSize: theme.fontSizes.md,
        fontFamily: theme.fonts.display,
        color: theme.colors.textDim,
        margin: '8px 0',
      }}>
        vs
      </div>

      {/* Defender */}
      <UnitInfo
        name={defenderDef.name}
        faction={defender.faction}
        cv={defenderDef.combatValue}
        hp={defender.hp}
        maxHp={defender.maxHp}
        terrain={defenderTerrain}
        label="Defender"
        diceCount={defenseDice}
        diceColor={theme.colors.info}
        modifiers={[
          ...(ditchDefenseModifier > 0 ? [{ label: `+${ditchDefenseModifier} Ditch`, color: '#44aa44' }] : []),
        ]}
      />

      {/* Buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 14 }}>
        <MedievalButton variant="ghost" size="sm" onClick={handleCancel}>
          Cancel
        </MedievalButton>
        <MedievalButton variant="danger" size="sm" onClick={handleRollDice}>
          Roll Dice
        </MedievalButton>
      </div>
    </div>
  );
}

function UnitInfo({ name, faction, cv, hp, maxHp, terrain, label, diceCount, diceColor, modifiers = [] }: {
  name: string;
  faction: 'imperial' | 'chaos';
  cv: number;
  hp: number;
  maxHp: number;
  terrain: string;
  label: string;
  diceCount: number;
  diceColor: string;
  modifiers?: { label: string; color: string }[];
}) {
  const factionTheme = getFactionTheme(faction);

  return (
    <div style={{
      padding: '8px 0',
      borderLeft: `3px solid ${factionTheme.primary}`,
      paddingLeft: 12,
      marginBottom: 4,
      textAlign: 'left' as const,
    }}>
      <div style={{
        fontSize: theme.fontSizes.xs,
        fontFamily: theme.fonts.body,
        color: theme.colors.textMuted,
        marginBottom: 2,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: theme.fontSizes.md,
        fontFamily: theme.fonts.display,
        color: factionTheme.primary,
        marginBottom: 4,
      }}>
        {name}
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: theme.fontSizes.sm, marginBottom: 4 }}>
        <span>
          <span style={{ color: theme.colors.textMuted }}>CV: </span>
          <span style={{ color: theme.colors.warning, fontWeight: 'bold' }}>{cv}</span>
        </span>
        <span>
          <span style={{ color: theme.colors.textMuted }}>HP: </span>
          <span style={{ color: hp < maxHp ? '#ff6666' : theme.colors.success, fontWeight: 'bold' }}>{hp}/{maxHp}</span>
        </span>
        <span style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.xs }}>{terrain}</span>
      </div>
      {modifiers.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
          {modifiers.map((mod, i) => (
            <span key={i} style={{
              fontSize: '0.6rem',
              fontWeight: 'bold',
              color: mod.color,
              background: `${mod.color}22`,
              border: `1px solid ${mod.color}66`,
              borderRadius: 4,
              padding: '1px 5px',
              fontFamily: theme.fonts.body,
            }}>
              {mod.label}
            </span>
          ))}
        </div>
      )}
      {/* Dice */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {Array.from({ length: diceCount }, (_, i) => (
          <div key={i} style={{
            width: 18,
            height: 18,
            borderRadius: 3,
            border: `1.5px solid ${diceColor}`,
            background: 'rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.55rem',
            color: diceColor,
            fontFamily: theme.fonts.display,
          }}>
            ?
          </div>
        ))}
        <span style={{ fontSize: theme.fontSizes.xs, color: diceColor, fontWeight: 'bold', fontFamily: theme.fonts.body, marginLeft: 2 }}>
          {diceCount}d
        </span>
      </div>
    </div>
  );
}
