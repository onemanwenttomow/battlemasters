import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { CAMPAIGN_SCENARIOS, getScenarioById } from '@battle-masters/game-logic';

export function ScenarioSelect() {
  const initGame = useGameStore((s) => s.initGame);
  const setScreen = useUIStore((s) => s.setScreen);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (scenarioId: string) => {
    initGame(undefined, scenarioId);
    setScreen('game');
  };

  const selectedScenario = selectedId ? getScenarioById(selectedId) : null;
  const selectedCampaign = selectedId
    ? CAMPAIGN_SCENARIOS.find((s) => s.id === selectedId)
    : null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0f 100%)',
    }}>
      <h1 style={{
        fontSize: '2rem',
        color: '#c4a35a',
        fontWeight: 'bold',
        marginBottom: 32,
        textShadow: '0 2px 10px rgba(196,163,90,0.3)',
        letterSpacing: '0.1em',
      }}>
        CAMPAIGN
      </h1>

      <div style={{ display: 'flex', gap: 24, width: 720, maxWidth: '95vw', alignItems: 'flex-start' }}>
        {/* Scenario list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: '0 0 300px' }}>
          {CAMPAIGN_SCENARIOS.map((scenario) => {
            const isSelected = selectedId === scenario.id;
            return (
              <button
                key={scenario.id}
                onClick={() => {
                  if (scenario.available) {
                    setSelectedId(isSelected ? null : scenario.id);
                  }
                }}
                disabled={!scenario.available}
                style={{
                  background: isSelected
                    ? 'rgba(196,163,90,0.2)'
                    : scenario.available
                      ? 'rgba(196,163,90,0.1)'
                      : 'rgba(255,255,255,0.02)',
                  border: scenario.available
                    ? '2px solid ' + (isSelected ? 'rgba(196,163,90,0.7)' : 'rgba(196,163,90,0.25)')
                    : '2px solid #222',
                  color: scenario.available ? '#c4a35a' : '#444',
                  padding: '12px 16px',
                  borderRadius: 8,
                  cursor: scenario.available ? 'pointer' : 'not-allowed',
                  textAlign: 'left',
                  transition: 'transform 0.1s, border-color 0.2s',
                }}
                onMouseOver={(e) => {
                  if (scenario.available && !isSelected) {
                    e.currentTarget.style.transform = 'scale(1.02)';
                    e.currentTarget.style.borderColor = 'rgba(196,163,90,0.7)';
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.borderColor = isSelected
                    ? 'rgba(196,163,90,0.7)'
                    : scenario.available
                      ? 'rgba(196,163,90,0.25)'
                      : '#222';
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '0.95rem', marginBottom: 2 }}>
                  {scenario.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: scenario.available ? '#888' : '#333' }}>
                  {scenario.available
                    ? `${scenario.campaignPoints} campaign point${scenario.campaignPoints > 1 ? 's' : ''}`
                    : 'Coming Soon'}
                </div>
              </button>
            );
          })}
        </div>

        {/* Description panel */}
        <div style={{
          flex: 1,
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid #333',
          borderRadius: 8,
          padding: '20px 24px',
          minHeight: 280,
        }}>
          {selectedScenario && selectedCampaign ? (
            <>
              <h2 style={{
                fontSize: '1.1rem',
                color: '#c4a35a',
                fontWeight: 'bold',
                marginBottom: 12,
                marginTop: 0,
              }}>
                {selectedCampaign.name}
              </h2>
              <p style={{
                color: '#bbb',
                fontSize: '0.85rem',
                lineHeight: 1.7,
                margin: 0,
                marginBottom: 20,
              }}>
                {selectedScenario.description}
              </p>
              <button
                onClick={() => handleSelect(selectedCampaign.id)}
                style={{
                  display: 'block',
                  margin: '0 auto',
                  background: 'rgba(196,163,90,0.15)',
                  border: '2px solid #c4a35a',
                  color: '#c4a35a',
                  padding: '10px 32px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  letterSpacing: '0.05em',
                  transition: 'background 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(196,163,90,0.3)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(196,163,90,0.15)';
                }}
              >
                Begin Battle
              </button>
            </>
          ) : (
            <p style={{ color: '#555', fontSize: '0.85rem', fontStyle: 'italic', margin: 0, textAlign: 'center', paddingTop: 80 }}>
              Select a battle to read its story
            </p>
          )}
        </div>
      </div>

      <button
        onClick={() => setScreen('menu')}
        style={{
          marginTop: 32,
          background: 'transparent',
          border: '1px solid #333',
          color: '#888',
          padding: '8px 24px',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: '0.85rem',
        }}
      >
        Back
      </button>
    </div>
  );
}
