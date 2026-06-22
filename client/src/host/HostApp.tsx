import { useEffect, useState, type FormEvent } from 'react';
import { getSocket } from '../shared/socket';
import { useCountdown } from '../shared/useCountdown';
import {
  SocketEvents,
  PHASE_LABELS,
  PERSONA_LABELS,
  OBJECTIVE,
  JOIN_ERROR_MESSAGES,
  type LobbyUpdatePayload,
  type GameStatePayload,
  type PlayerJoinErrorPayload,
  type PublicPlayer,
} from '../shared/events';
import { Card, DilemmaCard, SplitBar, ResultsPanel, AwardsPanel, Logo, Swing } from '../shared/ui';
import ReactionSwarm from './ReactionSwarm';

const screen = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  textAlign: 'center',
  padding: '2rem',
  gap: '1.5rem',
} as const;

// Read a room code from the spectator URL (`/host?code=XXXX`).
function urlCode(): string {
  return new URLSearchParams(window.location.search).get('code')?.toUpperCase() ?? '';
}

// Shared screen (TV / tablet / laptop): a READ-ONLY spectator. It attaches to an
// existing room by code (`/host?code=XXXX`, or a code input) and mirrors the
// game as a big passive view. All controls live on the leader's phone.
export default function HostApp() {
  const [code, setCode] = useState<string | null>(() => urlCode() || null);
  const [codeInput, setCodeInput] = useState('');
  const [attachError, setAttachError] = useState<string | null>(null);
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [game, setGame] = useState<GameStatePayload | null>(null);

  // Attaching as a spectator is driven by the `code` state: setting it (from the
  // URL or the code input) triggers the effect below, which emits spectator:join
  // and re-emits on every reconnect.
  useEffect(() => {
    const socket = getSocket();
    const onLobbyUpdate = ({ players }: LobbyUpdatePayload) => setPlayers(players);
    const onGameState = (payload: GameStatePayload) => setGame(payload);
    const onJoinError = ({ error }: PlayerJoinErrorPayload) => {
      setAttachError(JOIN_ERROR_MESSAGES[error] ?? 'Impossibile collegarsi alla stanza');
      setCode(null);
    };
    socket.on(SocketEvents.LobbyUpdate, onLobbyUpdate);
    socket.on(SocketEvents.GameState, onGameState);
    socket.on(SocketEvents.PlayerJoinError, onJoinError);
    // Re-attach on every (re)connect so a network blip recovers the view.
    const onConnect = () => {
      const c = code;
      if (c) socket.emit(SocketEvents.SpectatorJoin, { code: c });
    };
    socket.on('connect', onConnect);
    // Attach immediately if a code came from the URL.
    if (code) socket.emit(SocketEvents.SpectatorJoin, { code });
    return () => {
      socket.off(SocketEvents.LobbyUpdate, onLobbyUpdate);
      socket.off(SocketEvents.GameState, onGameState);
      socket.off(SocketEvents.PlayerJoinError, onJoinError);
      socket.off('connect', onConnect);
    };
    // Re-subscribe whenever the attached code changes.
  }, [code]);

  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    const clean = codeInput.trim().toUpperCase();
    if (!clean) return;
    setAttachError(null);
    setCode(clean); // triggers the effect, which emits spectator:join
  };

  const phase = game?.phase ?? 'LOBBY';
  const remaining = useCountdown(game?.phaseExpiresAt ?? null);

  // No code yet: ask for one (the leader's phone shows it after creating a room).
  if (!code) {
    return (
      <main style={screen}>
        <Logo size={64} payoff />
        <p style={{ opacity: 0.8, margin: 0, maxWidth: '32rem' }}>
          Collega questo schermo a una partita: inserisci il codice mostrato sul telefono del leader.
        </p>
        <form
          onSubmit={submitCode}
          style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}
        >
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            placeholder="ABCD"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={4}
            aria-label="Codice stanza"
            style={{
              fontSize: '2rem',
              letterSpacing: '0.3rem',
              textAlign: 'center',
              padding: '0.6rem 0.8rem',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              textTransform: 'uppercase',
              width: '8rem',
            }}
          />
          <button
            type="submit"
            style={{ fontSize: '1.2rem', fontWeight: 700, padding: '0.7rem 1.4rem', borderRadius: '0.6rem', cursor: 'pointer' }}
          >
            Collega TV
          </button>
        </form>
        {attachError && (
          <p role="alert" style={{ color: '#ff6b6b', margin: 0, fontWeight: 600 }}>
            {attachError}
          </p>
        )}
      </main>
    );
  }

  // In-game: a big passive mirror of the current phase. No controls.
  if (phase !== 'LOBBY' && game) {
    const inDilemma = game.dilemmaIndex >= 1 && game.dilemmaCount != null;
    const dilemma = game.dilemma;
    const split = game.split;
    const defense = game.defense;
    const swing = game.swing;
    const awards = game.awards;
    const duelReveal = game.duelReveal;
    const duelTurn = game.duelTurn;
    const duelResult = game.duelResult;
    const duelSummary = game.duelSummary;
    return (
      <main style={screen}>
        <ReactionSwarm />
        {inDilemma && (
          <p style={{ opacity: 0.7, margin: 0, fontSize: '1.1rem' }}>
            Dilemma {game.dilemmaIndex}/{game.dilemmaCount}
          </p>
        )}
        <h1 style={{ fontSize: '2.5rem', margin: 0, fontFamily: phase === 'PHASE_INTRO' ? 'var(--font-serif)' : 'var(--font-display)', fontWeight: phase === 'PHASE_INTRO' ? 500 : 700, ...(phase === 'PHASE_INTRO' && { letterSpacing: 'var(--tracking-serif)' }) }}>{PHASE_LABELS[phase]}</h1>

        {phase === 'PHASE_INTRO' && (
          <>
            <p style={{ fontSize: '1.5rem', opacity: 0.85, margin: 0, maxWidth: '40rem' }}>
              Vi mostreremo {game.dilemmaCount} dilemmi. Votate, ascoltate le difese e
              cambiate idea… se vi convincono!
            </p>
            <p style={{ fontSize: '1.6rem', fontWeight: 500, margin: 0, maxWidth: '40rem', fontFamily: 'var(--font-serif)', letterSpacing: 'var(--tracking-serif)' }}>
              🎯 {OBJECTIVE}
            </p>
          </>
        )}

        {/* Dilemma prompt: shown while a dilemma is in play (reveal + votes). */}
        {dilemma &&
          (phase === 'DILEMMA_REVEAL' ||
            phase === 'VOTE_1' ||
            phase === 'VOTE_2' ||
            phase === 'DUEL_REVEAL' ||
            phase === 'DUEL_ARGUE' ||
            phase === 'DUEL_REPICK') && <DilemmaCard dilemma={dilemma} />}

        {phase === 'VOTE_1' && (
          <p
            aria-label="Quanti hanno votato"
            style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}
          >
            Hanno votato {game.votedCount}/{players.length}
          </p>
        )}

        {phase === 'VOTE_2' && (
          <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, maxWidth: '40rem' }}>
            Confermate il voto dal telefono ✓ · {game.confirmedCount}/{players.length}
          </p>
        )}

        {phase === 'SPLIT_REVEAL' && split && <SplitBar split={split} />}

        {phase === 'PREDICT' && (
          game.knowPairs ? (
            <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, maxWidth: '40rem' }}>
              Quanto mi conosci: indovinate dal telefono come ha votato il vicino ·{' '}
              {game.knowGuessedCount}/{game.knowPairs.length}
            </p>
          ) : (
            <>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, maxWidth: '40rem' }}>
                Pronosticate dal telefono: chi avrà più voti <em>dopo</em> le difese? ·{' '}
                {game.predictedCount}/{players.length}
              </p>
              <p style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--gold)' }}>
                …e scommettete: ci sarà un ribaltone? · {game.swingBetCount}/{players.length}
              </p>
            </>
          )
        )}

        {phase === 'SPEAKER_VOTE' && (
          <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, maxWidth: '40rem' }}>
            Votate dal telefono il più convincente · {game.speakerVotedCount}/{players.length}
          </p>
        )}

        {phase === 'DEFENSE' && defense && (
          defense.speaker ? (
            <section
              aria-label="Chi sta difendendo"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}
            >
              {game.isDevilRound && (
                <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#ffd36b' }}>
                  🎭 Avvocato del Diavolo — si difende il lato OPPOSTO al proprio voto!
                </p>
              )}
              {defense.totalTurns > 1 && (
                <p style={{ opacity: 0.7, margin: 0, fontSize: '1.1rem' }}>
                  Turno {defense.turn}/{defense.totalTurns}
                </p>
              )}
              <p style={{ fontSize: 'clamp(1.6rem, 5vw, 2.6rem)', fontWeight: 800, margin: 0 }}>
                {defense.argument ? '🤖' : 'Sta parlando'}{' '}
                <span style={{ color: '#ffd36b' }}>{defense.speaker.nickname}</span> {defense.argument ? '' : '🎤'}
              </p>
              <div
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.9rem',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  background:
                    defense.speaker.side === 'A' ? 'rgba(84,134,196,0.18)' : 'rgba(199,122,69,0.18)',
                  border: `2px solid ${
                    defense.speaker.side === 'A' ? 'rgba(84,134,196,0.5)' : 'rgba(199,122,69,0.5)'
                  }`,
                }}
              >
                {defense.speaker.devil ? '🎭 ' : ''}Difende {defense.speaker.side} ·{' '}
                {defense.speaker.side === 'A' ? dilemma?.optionA : dilemma?.optionB}
              </div>
              {defense.argument && (
                <p style={{ fontSize: '1.4rem', fontStyle: 'italic', margin: 0, maxWidth: 'min(90vw, 44rem)', opacity: 0.95 }}>
                  “{defense.argument}”
                </p>
              )}
              {defense.spunti && defense.spunti.length > 0 && (
                <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.4rem', textAlign: 'left', display: 'inline-flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {defense.spunti.map((s, i) => (
                    <li key={`${i}-${s}`} style={{ fontSize: '1.1rem', opacity: 0.85 }}>{s}</li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
            <p style={{ fontSize: '1.4rem', opacity: 0.8, margin: 0 }}>
              Nessuno ha votato: niente difese per questo dilemma.
            </p>
          )
        )}

        {phase === 'PHASE_RESULTS' && swing && <ResultsPanel swing={swing} />}

        {phase === 'ACCUSE' && (
          <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, maxWidth: '40rem' }}>
            🕵️ Accusate dal telefono: chi era l'infiltrato? · {game.accusedCount}/{players.length}
          </p>
        )}

        {phase === 'FINAL_AWARDS' && game.infiltratoResult && (
          <div
            style={{
              padding: '1rem 1.6rem',
              borderRadius: '1rem',
              textAlign: 'center',
              background: 'rgba(168,130,255,0.16)',
              border: '2px solid rgba(168,130,255,0.5)',
            }}
          >
            <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>
              🕵️ L'infiltrato era{' '}
              <span style={{ color: '#ffd36b' }}>{game.infiltratoResult.infiltratorNickname}</span>
            </p>
            <p style={{ margin: '0.4rem 0 0', fontSize: '1.3rem' }}>
              {game.infiltratoResult.won
                ? `Ha vinto! ${game.infiltratoResult.flips} ribaltoni, mai scoperto.`
                : game.infiltratoResult.caught
                  ? 'Smascherato dal gruppo! 🎉'
                  : 'Missione fallita.'}
            </p>
          </div>
        )}

        {phase === 'FINAL_AWARDS' && game.teams && (
          <div
            style={{
              padding: '1rem 1.6rem',
              borderRadius: '1rem',
              textAlign: 'center',
              background: 'rgba(79,140,255,0.12)',
              border: '2px solid rgba(79,140,255,0.4)',
            }}
          >
            <p style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>
              🔵 {game.teams.scores.blu} — {game.teams.scores.arancio} 🟠
            </p>
            <p style={{ margin: '0.3rem 0 0', fontSize: '1.4rem' }}>
              {game.teams.scores.blu === game.teams.scores.arancio
                ? 'Pareggio fra le squadre!'
                : game.teams.scores.blu > game.teams.scores.arancio
                  ? 'Vince il Team Blu! 🔵'
                  : 'Vince il Team Arancio! 🟠'}
            </p>
          </div>
        )}

        {phase === 'FINAL_AWARDS' && awards && <AwardsPanel awards={awards} />}

        {phase === 'DUEL_PICK' && (
          <p aria-label="Quanti hanno scelto" style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>
            Scegliete in segreto ({game.votedCount}/2)
          </p>
        )}

        {phase === 'DUEL_REVEAL' && duelReveal && (
          <section
            aria-label="Le vostre scelte"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' }}
          >
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {duelReveal.picks.map((p) => {
                const rgb = p.choice === 'A' ? '84,134,196' : '199,122,69';
                return (
                  <div
                    key={p.id}
                    style={{
                      padding: '1rem 1.4rem',
                      borderRadius: '0.9rem',
                      background: `rgba(${rgb},0.18)`,
                      border: `2px solid rgba(${rgb},0.5)`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.2rem',
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{p.nickname}</span>
                    <span style={{ fontSize: '1.8rem', fontWeight: 800 }}>{p.choice}</span>
                    <span style={{ fontSize: '0.95rem', opacity: 0.85 }}>
                      {p.choice === 'A' ? dilemma?.optionA : dilemma?.optionB}
                    </span>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
              {duelReveal.agreed ? '🤝 Siete d’accordo!' : '⚔️ Si va al duello!'}
            </p>
          </section>
        )}

        {phase === 'DUEL_ARGUE' && duelTurn?.speaker && (
          <section
            aria-label="Chi argomenta"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}
          >
            <p style={{ opacity: 0.7, margin: 0, fontSize: '1.1rem' }}>
              Turno {duelTurn.turn}/{duelTurn.totalTurns}
            </p>
            <p style={{ fontSize: 'clamp(1.6rem, 5vw, 2.6rem)', fontWeight: 800, margin: 0 }}>
              Argomenta <span style={{ color: '#ffd36b' }}>{duelTurn.speaker.nickname}</span> 🎤
            </p>
            <div
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.9rem',
                fontSize: '1.25rem',
                fontWeight: 700,
                background: duelTurn.speaker.side === 'A' ? 'rgba(84,134,196,0.18)' : 'rgba(199,122,69,0.18)',
                border: `2px solid ${duelTurn.speaker.side === 'A' ? 'rgba(84,134,196,0.5)' : 'rgba(199,122,69,0.5)'}`,
              }}
            >
              Difende {duelTurn.speaker.side} ·{' '}
              {duelTurn.speaker.side === 'A' ? dilemma?.optionA : dilemma?.optionB}
            </div>
          </section>
        )}

        {phase === 'DUEL_REPICK' && (
          <p style={{ fontSize: '1.4rem', fontWeight: 600, margin: 0, opacity: 0.9 }}>
            Ri-scegliete: vi siete convinti? 📱
          </p>
        )}

        {phase === 'DUEL_RESULT' && duelResult && (
          <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            {duelResult.agreed ? (
              <p style={{ fontSize: 'clamp(1.6rem, 5vw, 2.6rem)', fontWeight: 800, margin: 0 }}>
                🤝 Eravate d’accordo
              </p>
            ) : duelResult.convinced.length > 0 ? (
              duelResult.convinced.map((c) => (
                <p key={c.convinced.id} style={{ fontSize: 'clamp(1.5rem, 4.5vw, 2.4rem)', fontWeight: 800, margin: 0 }}>
                  <span style={{ color: '#ffd36b' }}>{c.persuader.nickname}</span> ha convinto {c.convinced.nickname}! 🎯
                </p>
              ))
            ) : (
              <p style={{ fontSize: 'clamp(1.6rem, 5vw, 2.6rem)', fontWeight: 800, margin: 0 }}>Teste dure! 🪨</p>
            )}
          </section>
        )}

        {phase === 'FINAL_DUEL' && duelSummary && (
          <section
            aria-label="Risultato del duello"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}
          >
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {duelSummary.scores.map((s) => (
                <Card
                  key={s.id}
                  glow="accent"
                  style={{ flex: '1 1 12rem', minWidth: '10rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'center', textAlign: 'center' }}
                >
                  <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>{s.nickname}</span>
                  <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#ffd36b' }}>{s.persuasions}</span>
                  <span style={{ fontSize: '0.95rem', opacity: 0.8 }}>
                    {s.persuasions === 1 ? 'persuasione' : 'persuasioni'}
                  </span>
                </Card>
              ))}
            </div>
            <p style={{ fontSize: '1.2rem', opacity: 0.85, margin: 0 }}>
              Eravate d’accordo {duelSummary.agreements} {duelSummary.agreements === 1 ? 'volta' : 'volte'}
            </p>
          </section>
        )}

        {remaining != null && (
          <div
            aria-label="Tempo rimanente"
            style={{
              fontSize: 'clamp(3rem, 12vw, 6rem)',
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {remaining}s
          </div>
        )}
      </main>
    );
  }

  // LOBBY: show the code + roster + a passive "waiting for the leader" line.
  return (
    <main style={screen}>
      <Logo size={64} payoff />
      <p style={{ opacity: 0.7, margin: 0 }}>
        Entra da <strong>{window.location.host}</strong> con il codice
      </p>
      <div
        style={{
          fontSize: 'clamp(4rem, 18vw, 9rem)',
          fontWeight: 800,
          letterSpacing: '0.4rem',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          lineHeight: 1,
        }}
      >
        {code}
      </div>

      <section style={{ marginTop: '0.5rem', width: 'min(90vw, 36rem)' }}>
        <h2 style={{ fontSize: '1.25rem', margin: '0 0 0.75rem' }}>
          Giocatori ({players.length}/8)
        </h2>
        {players.length === 0 ? (
          <>
            <Swing animated />
            <p style={{ opacity: 0.6, margin: 0 }}>In attesa di giocatori…</p>
          </>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              justifyContent: 'center',
            }}
          >
            {players.map((p) => (
              <li
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 0.9rem',
                  borderRadius: '999px',
                  background: p.isBot ? 'var(--gold-soft)' : 'rgba(127,127,127,0.18)',
                  fontWeight: 600,
                  opacity: p.connected === false ? 0.5 : 1,
                }}
              >
                {p.isBot && <span aria-label="bot">🤖</span>}
                {p.nickname}
                {p.isBot && p.persona && (
                  <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{PERSONA_LABELS[p.persona]}</span>
                )}
                {p.connected === false && (
                  <span style={{ fontSize: '0.75rem', opacity: 0.8 }} aria-label="assente">📵</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p style={{ opacity: 0.7, margin: 0 }}>In attesa che il leader avvii la partita…</p>
    </main>
  );
}
