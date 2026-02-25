import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import {
  getUnitDefinition,
  coordToKey,
  hexDistance,
  getCombatDiceCounts,
} from '@battle-masters/game-logic';
import type { TerrainType } from '@battle-masters/game-logic';

const FACTION_COLORS = {
  imperial: '#4488cc',
  chaos: '#cc4444',
};

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

  const { attackDice, defenseDice } = getCombatDiceCounts(attacker, defender, {
    attackerTerrain,
    defenderTerrain,
    distance,
    chargeBonus,
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
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'auto',
      zIndex: 100,
    }}>
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
        }}
        onClick={handleCancel}
      />

      {/* Dialog */}
      <div style={{
        position: 'relative',
        background: 'rgba(10,10,15,0.95)',
        borderRadius: 12,
        padding: '20px 28px',
        border: '2px solid #555',
        minWidth: 380,
        animation: 'fadeIn 0.15s ease-out',
      }}>
        <div style={{ fontSize: '0.85rem', color: '#aaa', textAlign: 'center', marginBottom: 16 }}>
          Combat
        </div>

        {/* Attacker vs Defender */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 20 }}>
          <UnitInfo
            name={attackerDef.name}
            faction={attacker.faction}
            cv={attackerDef.combatValue}
            hp={attacker.hp}
            maxHp={attacker.maxHp}
            terrain={attackerTerrain}
            label="Attacker"
            diceCount={attackDice}
            diceColor="#ff8844"
          />
          <div style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: '1.5rem',
            color: '#666',
            fontWeight: 'bold',
          }}>
            vs
          </div>
          <UnitInfo
            name={defenderDef.name}
            faction={defender.faction}
            cv={defenderDef.combatValue}
            hp={defender.hp}
            maxHp={defender.maxHp}
            terrain={defenderTerrain}
            label="Defender"
            diceCount={defenseDice}
            diceColor="#4488ff"
          />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button
            onClick={handleCancel}
            style={{
              padding: '8px 20px',
              borderRadius: 6,
              border: '1px solid #555',
              background: '#333',
              color: '#ccc',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleRollDice}
            style={{
              padding: '8px 20px',
              borderRadius: 6,
              border: '1px solid #ff8844',
              background: 'linear-gradient(180deg, #cc5500, #993300)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 'bold',
            }}
          >
            Roll Dice
          </button>
        </div>
      </div>
    </div>
  );
}

function UnitInfo({ name, faction, cv, hp, maxHp, terrain, label, diceCount, diceColor }: {
  name: string;
  faction: 'imperial' | 'chaos';
  cv: number;
  hp: number;
  maxHp: number;
  terrain: string;
  label: string;
  diceCount: number;
  diceColor: string;
}) {
  const color = FACTION_COLORS[faction];

  return (
    <div style={{ textAlign: 'center', minWidth: 120 }}>
      <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color, marginBottom: 6 }}>{name}</div>
      <div style={{ fontSize: '0.75rem', color: '#ccc', marginBottom: 2 }}>
        <span style={{ color: '#888' }}>CV: </span>
        <span style={{ color: '#ff8844', fontWeight: 'bold' }}>{cv}</span>
      </div>
      <div style={{ fontSize: '0.75rem', color: '#ccc', marginBottom: 2 }}>
        <span style={{ color: '#888' }}>HP: </span>
        <span style={{ color: hp < maxHp ? '#ff6666' : '#88cc88', fontWeight: 'bold' }}>{hp}/{maxHp}</span>
      </div>
      <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: 8 }}>
        {terrain}
      </div>
      {/* Dice count */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}>
        <div style={{
          display: 'flex',
          gap: 3,
        }}>
          {Array.from({ length: diceCount }, (_, i) => (
            <div key={i} style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              border: `1.5px solid ${diceColor}`,
              background: 'rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.6rem',
              color: diceColor,
            }}>
              ?
            </div>
          ))}
        </div>
        <span style={{ fontSize: '0.7rem', color: diceColor, fontWeight: 'bold' }}>
          {diceCount}d
        </span>
      </div>
    </div>
  );
}
