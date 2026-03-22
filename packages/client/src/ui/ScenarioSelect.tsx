import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { CAMPAIGN_SCENARIOS, getScenarioById } from '@battle-masters/game-logic';
import { theme } from './theme';
import { MedievalButton } from './components/MedievalButton';
import { Panel } from './components/Panel';

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
        fontSize: theme.fontSizes['2xl'],
        fontFamily: theme.fonts.display,
        color: theme.colors.gold,
        fontWeight: 'normal',
        marginBottom: 32,
        textShadow: theme.shadows.text,
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
              <Panel
                key={scenario.id}
                variant="parchment"
                border={isSelected ? theme.colors.gold : undefined}
                style={{
                  padding: '12px 16px',
                  cursor: scenario.available ? 'pointer' : 'not-allowed',
                  opacity: scenario.available ? 1 : 0.4,
                  textAlign: 'left',
                  transition: 'transform 0.15s ease, border-color 0.2s ease',
                }}
                onClick={() => {
                  if (scenario.available) {
                    setSelectedId(isSelected ? null : scenario.id);
                  }
                }}
              >
                <div style={{
                  fontWeight: 'bold',
                  fontSize: theme.fontSizes.md,
                  fontFamily: theme.fonts.display,
                  color: isSelected ? theme.colors.gold : theme.colors.text,
                  marginBottom: 2,
                }}>
                  {scenario.name}
                </div>
                <div style={{
                  fontSize: theme.fontSizes.sm,
                  fontFamily: theme.fonts.body,
                  color: scenario.available ? theme.colors.textMuted : theme.colors.textFaint,
                }}>
                  {scenario.available
                    ? `${scenario.campaignPoints} campaign point${scenario.campaignPoints > 1 ? 's' : ''}`
                    : 'Coming Soon'}
                </div>
              </Panel>
            );
          })}
        </div>

        {/* Description panel */}
        <Panel variant="parchment" ornate style={{
          flex: 1,
          padding: '20px 24px',
          minHeight: 280,
        }}>
          {selectedScenario && selectedCampaign ? (
            <>
              <h2 style={{
                fontSize: theme.fontSizes.lg,
                fontFamily: theme.fonts.display,
                color: theme.colors.gold,
                marginBottom: 12,
                marginTop: 0,
              }}>
                {selectedCampaign.name}
              </h2>
              <p style={{
                color: theme.colors.textMuted,
                fontSize: theme.fontSizes.sm,
                fontFamily: theme.fonts.body,
                lineHeight: 1.7,
                margin: 0,
                marginBottom: 20,
              }}>
                {selectedScenario.description}
              </p>
              <div style={{ textAlign: 'center' }}>
                <MedievalButton variant="primary" onClick={() => handleSelect(selectedCampaign.id)}>
                  Begin Battle
                </MedievalButton>
              </div>
            </>
          ) : (
            <p style={{
              color: theme.colors.textDim,
              fontSize: theme.fontSizes.sm,
              fontStyle: 'italic',
              margin: 0,
              textAlign: 'center',
              paddingTop: 80,
              fontFamily: theme.fonts.body,
            }}>
              Select a battle to read its story
            </p>
          )}
        </Panel>
      </div>

      <MedievalButton
        variant="ghost"
        size="sm"
        onClick={() => setScreen('menu')}
        style={{ marginTop: 32 }}
      >
        Back
      </MedievalButton>
    </div>
  );
}
