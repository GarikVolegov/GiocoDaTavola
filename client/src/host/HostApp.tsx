import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTransient } from '../shared/useTransient';
import { getSocket } from '../shared/socket';
import {
  SocketEvents,
  PHASE_LABELS,
  PERSONA_LABELS,
  OBJECTIVE,
  JOIN_ERROR_MESSAGES,
  tappaMeta,
  DUO_ACT_META,
  type LobbyUpdatePayload,
  type GameStatePayload,
  type PlayerJoinErrorPayload,
  type PublicPlayer,
  type PercorsoView,
} from '../shared/events';
import { Card, CardGrid, DilemmaCard, SplitBar, ResultsPanel, RilancioCard, AwardsPanel, NamedMomentsPanel, PodiumPanel, Logo, Swing, Button, TextInput, Alert, Celebration, RoomCodeChip, LiveVoterStatus, leanFromSplit, PauseOverlay, CruciverbaGrid } from '../shared/ui';
import ReactionSwarm from '../shared/ReactionSwarm';
import { AudioGate } from './AudioGate';
import { MuteButton } from './MuteButton';
import { useHostAudio } from './audio/useHostAudio';
import { useIsSpeaking } from './audio/narrator';
import { useWakeLock } from '../shared/useWakeLock';
import { useIntensityTheme } from '../shared/useIntensityTheme';
import { playSiren, playGong, playFanfare } from './audio/synthSfx';

const screen = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100dvh',
  textAlign: 'center',
  // Clear the notch / home-indicator when /host is opened standalone on a phone.
  padding:
    'max(var(--space-6), env(safe-area-inset-top, 0px)) max(var(--space-6), env(safe-area-inset-right, 0px)) max(var(--space-6), env(safe-area-inset-bottom, 0px)) max(var(--space-6), env(safe-area-inset-left, 0px))',
  gap: 'var(--space-5)',
} as const;

// Read a room code from the spectator URL (`/host?code=XXXX`).
function urlCode(): string {
  return new URLSearchParams(window.location.search).get('code')?.toUpperCase() ?? '';
}

// The "mappa-salita": the percorso's tappe as a climb, current one highlighted,
// with per-tappa progress (done/total). Read-only, no votes — pure progress.
function PercorsoMap({ percorso }: { percorso: PercorsoView }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'stretch' }}>
      {percorso.tappe.map((t) => {
        const meta = tappaMeta(t.id);
        const current = percorso.currentTappa === t.id;
        const complete = t.done >= t.total;
        return (
          <div
            key={t.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-1)',
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: current ? '2px solid var(--gold)' : '1px solid var(--border)',
              background: current ? 'var(--gold-soft)' : 'var(--surface)',
              opacity: current || complete ? 1 : 0.55,
              minWidth: '6rem',
            }}
          >
            <span style={{ fontSize: '1.8rem' }}>{meta.emoji}</span>
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{meta.nome}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.done}/{t.total}</span>
          </div>
        );
      })}
    </div>
  );
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
  // Timers are disabled globally; keep applause toast.
  const lastTurnApplause = useTransient(game?.lastTurnApplause ?? null, 3_000);

  // Audio director on /host: plays music, SFX and voice narration through the main
  // screen/TV speakers when unlocked. Gated by AudioGate and MuteButton.
  const { audioReady, activateAudio, replay, narrationLine } = useHostAudio({ enabled: true, game });
  const isSpeaking = useIsSpeaking();
  // Keep host screen / TV awake during the entire game
  useWakeLock(code != null);
  // Dynamically shift display typography based on seriousness / intensity
  useIntensityTheme({
    complessita: game?.dilemma?.complessita,
    caos: game?.caos,
    partyMode: game?.partyMode,
    partyIntensity: game?.partyCard?.intensity,
    phase,
  });

  // Sfondo "bivio": al SPLIT_REVEAL la scena pende verso il lato in testa
  // (voto AGGREGATO — i voti restano segreti, nessun aggancio durante VOTE_*).
  useEffect(() => {
    const root = document.documentElement;
    const lean = phase === 'SPLIT_REVEAL' && game?.split ? leanFromSplit(game.split) : 50;
    root.style.setProperty('--bivio-lean', String(lean));
    root.setAttribute('data-phase', phase);

    if (phase === 'PHASE_RESULTS' && game?.swing && (game.swing.leadFlipped || game.swing.switched >= 2)) {
      window.dispatchEvent(new CustomEvent('nexus:shockwave'));
    }

    return () => {
      root.style.setProperty('--bivio-lean', '50');
      root.removeAttribute('data-phase');
    };
  }, [phase, game?.split, game?.swing]);

  // Synth SFX cues for party modes on TV / host screen
  const prevPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    if (!audioReady) return;
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (prev === phase) return;

    if (phase === 'DEFENSE' && game?.partyCard?.mode === 'infiltrato') {
      playSiren();
    } else if (phase === 'SPLIT_REVEAL') {
      if (game?.partyCard?.mode === 'infiltrato' && game.partyCard.infiltratoRoundResult?.caught) {
        playFanfare();
      } else if (game?.partyCard?.mode === 'assurdo' && game.partyCard.cardType === 'gogna') {
        playGong();
      } else if (
        game?.partyCard?.mode === 'coppie' &&
        game.partyCard.coupleRoundResults?.some((r) => r.kind === 'match' || r.kind === 'challenge_done')
      ) {
        playFanfare();
      }
    }
  }, [phase, audioReady, game?.partyCard]);

  // No code yet: ask for one (the leader's phone shows it after creating a room).
  if (!code) {
    return (
      <main style={screen}>
        {!audioReady && <AudioGate onActivate={activateAudio} />}
        <Logo size={64} payoff />
        <p style={{ opacity: 0.8, margin: 0, maxWidth: '32rem' }}>
          Collega questo schermo a una partita: inserisci il codice mostrato sul telefono del leader.
        </p>
        <form
          onSubmit={submitCode}
          style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}
        >
          <TextInput
            mono
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            placeholder="ABCD"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={4}
            aria-label="Codice stanza"
            style={{ fontSize: '2rem', width: '8rem' }}
          />
          <Button type="submit" size="lg">
            Collega TV
          </Button>
        </form>
        {attachError && <Alert>{attachError}</Alert>}
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
    const namedMoments = game.namedMoments;
    const duoAct = game.duoAct;
    const duoAdvocateId = game.duoAdvocateId;
    const duoSyncReveal = game.duoSyncReveal;
    const duoTurn = game.duoTurn;
    const duoRoundResult = game.duoRoundResult;
    const duoPortrait = game.duoPortrait;
    // Leader-paced beats (storia narration + the percorso tappa recap) have no
    // server timer — the group is waiting on one specific phone. Named so
    // everyone knows who to nudge; reframed if that leader just disconnected —
    // leadership reassigns automatically (RECONNECT_GRACE_MS), so this is a
    // transient "hang on" cue, not a stall (6.3).
    const currentLeader = players.find((p) => p.id === game.leaderId) ?? null;
    const leaderWaitCue = currentLeader && (
      <p style={{ fontSize: '1rem', opacity: 0.7, margin: 0 }}>
        {currentLeader.connected === false
          ? `🔌 ${currentLeader.nickname} si è disconnesso — passiamo il testimone a breve…`
          : `In attesa di ${currentLeader.nickname} ▶`}
      </p>
    );

    const narratorStatus = narrationLine ? (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', margin: '0.4rem 0' }}>
        <span style={{ fontSize: '0.95rem', opacity: 0.9, color: isSpeaking ? 'var(--gold)' : 'inherit', fontWeight: isSpeaking ? 600 : 400 }}>
          {isSpeaking ? '🎙️ Voce narrante in corso…' : '🎙️ Narrazione'}
        </span>
        <button
          type="button"
          onClick={replay}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: '999px',
            padding: '0.2rem 0.65rem',
            color: 'inherit',
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
          aria-label="Rileggi ad alta voce"
        >
          🔊 Rileggi
        </button>
      </div>
    ) : null;

    return (
      <main style={screen}>
        <ReactionSwarm />
        {game.paused && <PauseOverlay />}
        {!audioReady && <AudioGate onActivate={activateAudio} />}
        <MuteButton />
        {/* Latecomers can still join mid-game: keep the code + QR in the corner. */}
        {code && <RoomCodeChip code={code} />}
        {/* Percorso: the climb map (current tappa highlighted) sits above the phase. */}
        {game.percorso && <PercorsoMap percorso={game.percorso} />}
        <div key={`${phase}-${game.dilemmaIndex}`} className="hostPhaseStage">
        {inDilemma && (
          <p style={{ opacity: 0.7, margin: 0, fontSize: '1.1rem' }}>
            {game.storia
              ? `${game.storia.emoji} ${game.storia.actTitle ? game.storia.actTitle + ' · ' : ''}Bivio ${game.dilemmaIndex}/${game.dilemmaCount}`
              : game.percorso
                ? `${tappaMeta(game.percorso.currentTappa).emoji} ${tappaMeta(game.percorso.currentTappa).nome} · Dilemma ${game.dilemmaIndex}/${game.dilemmaCount}`
                : game.partyMode != null ||
                    phase === 'GROUP_MIND' ||
                    phase === 'GROUP_MIND_REVEAL' ||
                    phase === 'WRITE' ||
                    phase === 'WRITE_VOTE' ||
                    phase === 'WRITE_REVEAL' ||
                    phase === 'HOT_TAKE_VOTE' ||
                    phase === 'HOT_TAKE_REVEAL' ||
                    phase === 'CRUCIVERBA' ||
                    phase === 'CRUCIVERBA_REVEAL' ||
                    phase === 'TRIBUNALE_ARGUE' ||
                    phase === 'TRIBUNALE_VOTE' ||
                    phase === 'TRIBUNALE_REVEAL' ||
                    phase === 'TELEPATHY' ||
                    phase === 'TELEPATHY_REVEAL'
                  ? `Sfida ${game.dilemmaIndex}/${game.dilemmaCount}`
                  : `Dilemma ${game.dilemmaIndex}/${game.dilemmaCount}`}
          </p>
        )}
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.4rem)', margin: 0, fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-display, 800)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-display, 0.03em)' }}>
          {phase === 'DEFENSE' && game.partyCard?.mode === 'infiltrato'
            ? "🕵️ L'Interrogatorio"
            : phase === 'DEFENSE' && game.partyCard?.mode === 'flash'
              ? '⚡ Difesa Lampo'
              : phase === 'DEFENSE' && game.partyCard?.mode === 'preferiresti'
                ? '🔀 Difesa delle Strade'
                : phase === 'SPLIT_REVEAL' && game.partyCard?.mode === 'infiltrato'
                  ? '🕵️ Identità svelata!'
                  : phase === 'SPLIT_REVEAL' && game.partyCard?.mode === 'flash'
                    ? '⚡ Verdetto Flash'
                    : phase === 'SPLIT_REVEAL' && game.partyCard?.mode === 'preferiresti'
                      ? '🔀 Verdetto delle Strade'
                      : PHASE_LABELS[phase]}
        </h1>

        {phase === 'TAPPA_INTRO' && game.percorso && (() => {
          const meta = tappaMeta(game.percorso.currentTappa);
          return (
            <Card glow="accent" style={{ maxWidth: '40rem', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', textAlign: 'center', alignItems: 'center' }}>
              <span style={{ fontSize: '4rem' }}>{meta.emoji}</span>
              <h2 style={{ fontSize: '2rem', margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 'var(--tracking-display, 0.03em)' }}>{meta.nome}</h2>
              <p style={{ fontSize: '1.3rem', opacity: 0.85, margin: 0 }}>{meta.sottotitolo}</p>
              <p style={{ fontSize: '1.1rem', opacity: 0.7, margin: 0 }}>{meta.descrizione}</p>
            </Card>
          );
        })()}

        {phase === 'TAPPA_RECAP' && game.percorso && (() => {
          const p = game.percorso;
          const meta = tappaMeta(p.currentTappa);
          const isLast = p.dilemmaIndex >= p.totalDilemmas;
          return (
            <Card glow="accent" style={{ maxWidth: '40rem', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', textAlign: 'center', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.8rem', margin: 0 }}>{meta.emoji} {meta.nome} — completata!</h2>
              <p style={{ fontSize: '1.4rem', margin: 0 }}>
                {p.tappaDilemmas} {p.tappaDilemmas === 1 ? 'dilemma' : 'dilemmi'} · {p.tappaSwings} {p.tappaSwings === 1 ? 'ribaltone' : 'ribaltoni'}
              </p>
              <p style={{ fontSize: '1.2rem', opacity: 0.8, margin: 0 }}>
                {isLast ? 'Avete raggiunto la vetta 🏔️' : 'Pausa: riprendete quando volete.'}
              </p>
              {!isLast && leaderWaitCue}
            </Card>
          );
        })()}

        {/* Percorso in 2: the act-intro card marks each of the three fixed acts. */}
        {phase === 'DUO_ACT_INTRO' && duoAct && (() => {
          const meta = DUO_ACT_META[duoAct.act];
          return meta ? (
            <Card glow="accent" style={{ maxWidth: '40rem', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', textAlign: 'center', alignItems: 'center' }}>
              <span style={{ fontSize: '4rem' }}>{meta.emoji}</span>
              <h2 style={{ fontSize: '2rem', margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 'var(--tracking-display, 0.03em)' }}>{meta.nome}</h2>
              <p style={{ fontSize: '1.3rem', opacity: 0.85, margin: 0 }}>{meta.sottotitolo}</p>
            </Card>
          ) : null;
        })()}

        {/* Storie: story title in decisive display caps, narrative prose in readable sentence-case body. */}
        {phase === 'STORY_INTRO' && game.storia && (
          <Card glow="accent" style={{ maxWidth: '46rem', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', textAlign: 'center', alignItems: 'center' }}>
            <span style={{ fontSize: '4rem' }}>{game.storia.emoji}</span>
            <h2 style={{ fontSize: '2.1rem', margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 'var(--tracking-display, 0.03em)' }}>{game.storia.title}</h2>
            <p style={{ fontSize: '1.2rem', opacity: 0.75, margin: 0 }}>con {game.storia.protagonist}</p>
            <p style={{ fontSize: '1.35rem', lineHeight: 1.55, margin: 0, fontFamily: 'var(--font-body)' }}>{game.storia.premessa}</p>
            {narratorStatus}
            {leaderWaitCue}
          </Card>
        )}

        {phase === 'SCENE_INTRO' && game.storia && (
          <Card glow="accent" style={{ maxWidth: '46rem', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', textAlign: 'center', alignItems: 'center' }}>
            {game.storia.actTitle && (
              <p style={{ fontSize: '1rem', opacity: 0.7, margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-display)', fontWeight: 700 }}>{game.storia.actTitle}</p>
            )}
            <p style={{ fontSize: '1.4rem', lineHeight: 1.55, margin: 0, fontFamily: 'var(--font-body)' }}>{game.storia.sceneNarration}</p>
            {narratorStatus}
            {leaderWaitCue}
          </Card>
        )}

        {phase === 'SCENE_CONSEQUENCE' && game.storia && (
          <Card glow="accent" style={{ maxWidth: '46rem', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', textAlign: 'center', alignItems: 'center' }}>
            {game.storia.decision && (
              <h2 style={{ fontSize: '1.55rem', margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 'var(--tracking-display, 0.03em)' }}>
                IL GRUPPO HA SCELTO: {game.storia.decision === 'A' ? dilemma?.optionA : dilemma?.optionB}
              </h2>
            )}
            <p style={{ fontSize: '1.35rem', lineHeight: 1.55, margin: 0, fontFamily: 'var(--font-body)' }}>{game.storia.consequence}</p>
            {narratorStatus}
            {leaderWaitCue}
          </Card>
        )}

        {phase === 'STORY_EPILOGUE' && game.storia && (
          <Card glow="accent" style={{ maxWidth: '46rem', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', textAlign: 'center', alignItems: 'center' }}>
            <span style={{ fontSize: '3.5rem' }}>🌅</span>
            <p style={{ fontSize: '1.4rem', lineHeight: 1.55, margin: 0, fontFamily: 'var(--font-body)' }}>{game.storia.epilogo}</p>
            {narratorStatus}
            {leaderWaitCue}
          </Card>
        )}

        {phase === 'PHASE_INTRO' && (
          <>
            <p style={{ fontSize: '1.4rem', opacity: 0.85, margin: 0, maxWidth: '40rem' }}>
              Vi mostreremo {game.dilemmaCount} dilemmi. Votate, ascoltate le difese e
              cambiate idea… se vi convincono!
            </p>
            <p style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, maxWidth: '40rem', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-display, 0.03em)', color: 'var(--gold)' }}>
              🎯 {OBJECTIVE}
            </p>
          </>
        )}

        {/* Dilemma prompt: shown while a dilemma is in play (reveal + votes). */}
        {dilemma &&
          (phase === 'DILEMMA_REVEAL' ||
            phase === 'VOTE_1' ||
            phase === 'VOTE_2' ||
            phase === 'DUO_PICK_PREDICT' ||
            phase === 'DUO_SYNC_REVEAL' ||
            phase === 'DUO_SIDE_PICK' ||
            phase === 'DUO_ARGUE' ||
            phase === 'DUO_WAVER' ||
            phase === 'DUO_PICK' ||
            phase === 'DUO_REVEAL' ||
            phase === 'DUO_REPICK') && (
            <>
              {game.partyCard && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{
                      padding: '0.3rem 0.8rem',
                      borderRadius: '999px',
                      background: game.partyCard.mode === 'flash'
                        ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                        : game.partyCard.mode === 'infiltrato'
                        ? 'linear-gradient(90deg, #8b5cf6, #ec4899)'
                        : game.partyCard.mode === 'coppie'
                        ? 'linear-gradient(90deg, #ec4899, #f43f5e)'
                        : game.partyCard.mode === 'preferiresti'
                        ? 'linear-gradient(90deg, #38bdf8, #6366f1)'
                        : 'linear-gradient(90deg, #10b981, #3b82f6)',
                      color: '#fff',
                      fontSize: '0.95rem',
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}>
                      {game.partyCard.mode === 'flash' && '⚡ SCHIERATI FLASH'}
                      {game.partyCard.mode === 'infiltrato' && "🕵️ L'INFILTRATO"}
                      {game.partyCard.mode === 'coppie' && (game.partyCard.intensity === 'piccante' ? '🔞 COPPIE PICCANTE' : '💞 COPPIE COMPLICITÀ')}
                      {game.partyCard.mode === 'assurdo' && (game.partyCard.cardType === 'gogna' ? '👑 LA GOGNA' : '💰 PREZZO DELLA DIGNITÀ')}
                      {game.partyCard.mode === 'preferiresti' && '🔀 PREFERIRESTI CHE...'}
                    </span>
                    {game.partyCard.penalty && (
                      <span style={{ color: 'var(--gold)', fontSize: '1rem', fontWeight: 700 }}>
                        ⚠️ {game.partyCard.penalty}
                      </span>
                    )}
                  </div>
                  {game.partyCard.mode === 'infiltrato' && (
                    <p style={{ margin: 0, fontSize: '1.25rem', color: '#a78bfa', fontWeight: 600 }}>
                      🤫 Ognuno ha una domanda segreta sul telefono. Rispondete a voce a turno con 1 sola parola o frase!
                    </p>
                  )}
                  {game.partyCard.mode === 'assurdo' && game.partyCard.cardType === 'gogna' && (
                    <p style={{ margin: 0, fontSize: '1.25rem', color: '#34d399', fontWeight: 600 }}>
                      👉 Chi tra voi è il colpevole? Votate l'amico dal vostro telefono!
                    </p>
                  )}
                  {game.partyCard.mode === 'coppie' &&
                    game.partyCard.couples &&
                    game.partyCard.couples.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {game.partyCard.couples.map((c) => (
                          <span
                            key={c.id}
                            style={{
                              padding: '0.28rem 0.75rem',
                              borderRadius: '999px',
                              background: 'rgba(236, 72, 153, 0.18)',
                              border: '1px solid rgba(236, 72, 153, 0.45)',
                              color: '#fbcfe8',
                              fontSize: '0.95rem',
                              fontWeight: 700,
                            }}
                          >
                            💕 {c.memberAName} ❤️ {c.memberBName}
                          </span>
                        ))}
                      </div>
                    )}
                </div>
              )}
              {game.partyCard?.mode === 'preferiresti' && game.partyCard.options ? (
                <Card
                  glow="accent"
                  style={{
                    maxWidth: '58rem',
                    width: 'min(94vw, 58rem)',
                    padding: '1.6rem 2rem',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.1rem',
                  }}
                >
                  <p style={{ margin: 0, fontSize: 'clamp(1.6rem, 3.6vw, 2.4rem)', fontWeight: 900, lineHeight: 1.2 }}>
                    {game.partyCard.prompt}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.85rem', textAlign: 'left' }}>
                    {game.partyCard.options.slice(0, 4).map((opt, idx) => {
                      const borderColors = ['#38bdf8', '#f59e0b', '#a855f7', '#34d399'];
                      const bgs = [
                        'rgba(56, 189, 248, 0.14)',
                        'rgba(245, 158, 11, 0.14)',
                        'rgba(168, 85, 247, 0.14)',
                        'rgba(52, 211, 153, 0.14)',
                      ];
                      return (
                        <div
                          key={idx}
                          style={{
                            padding: '1rem 1.15rem',
                            borderRadius: 'var(--radius-lg)',
                            background: bgs[idx],
                            border: `2px solid ${borderColors[idx]}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                          }}
                        >
                          <span style={{ fontSize: '1.12rem', fontWeight: 700, lineHeight: 1.25 }}>{opt}</span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ) : game.partyCard?.mode === 'coppie' &&
              game.partyCard.cardType === 'allineamento' &&
              !game.partyCard.optionA ? (
                <Card
                  glow="accent"
                  style={{
                    maxWidth: '52rem',
                    width: 'min(92vw, 52rem)',
                    padding: '1.8rem 2.2rem',
                    textAlign: 'center',
                  }}
                >
                  <p style={{ margin: 0, fontSize: 'clamp(1.6rem, 3.8vw, 2.5rem)', fontWeight: 800, lineHeight: 1.25 }}>
                    {dilemma.text}
                  </p>
                  <p style={{ margin: '0.85rem 0 0', fontSize: '1.1rem', color: '#fbcfe8', fontWeight: 700 }}>
                    📱 Ogni coppia indica uno dei due sul proprio telefono!
                  </p>
                </Card>
              ) : (
                <DilemmaCard dilemma={dilemma} />
              )}
              {(phase === 'DILEMMA_REVEAL' || phase === 'VOTE_1') && narratorStatus}
            </>
          )}

        {phase === 'VOTE_1' && (
          <LiveVoterStatus
            votedCount={game.votedCount}
            totalCount={players.length}
            label="Hanno votato"
          />
        )}

        {phase === 'VOTE_2' && (
          <LiveVoterStatus
            votedCount={game.confirmedCount}
            totalCount={players.length}
            label="Confermati"
            confirmedMode
          />
        )}

        {phase === 'SPLIT_REVEAL' && (() => {
          // 1. Flash mode: Doxxing della minoranza visibile
          if (game.partyCard?.mode === 'flash') {
            const fr = game.partyCard.flashResult;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', width: 'min(92vw, 48rem)' }}>
                {fr?.isEmpty ? (
                  <div style={{
                    padding: '1.5rem 2.2rem',
                    borderRadius: 'var(--radius-xl)',
                    background: 'rgba(30, 35, 55, 0.85)',
                    border: '2px solid rgba(255,255,255,0.2)',
                    width: '100%',
                    textAlign: 'center',
                  }}>
                    <h2 style={{ fontSize: 'clamp(1.8rem, 4.5vw, 2.8rem)', margin: 0, fontWeight: 900 }}>
                      Nessun voto ricevuto
                    </h2>
                    <p style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0.6rem 0 0', opacity: 0.85 }}>
                      Nessuno ha votato in questo round!
                    </p>
                  </div>
                ) : fr?.isUnanimous ? (
                  <div style={{
                    padding: '1.5rem 2.2rem',
                    borderRadius: 'var(--radius-xl)',
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(239, 68, 68, 0.25) 100%)',
                    border: '2px solid #f59e0b',
                    boxShadow: '0 0 35px rgba(245, 158, 11, 0.4)',
                    width: '100%',
                    textAlign: 'center',
                  }}>
                    <Celebration pieces={30} />
                    <h2 style={{ fontSize: 'clamp(2rem, 5.5vw, 3.4rem)', margin: 0, color: '#fbbf24', fontWeight: 900 }}>
                      🍻 UNANIMITÀ!
                    </h2>
                    <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.8rem 0 0' }}>
                      Troppo prevedibili: tutti dalla stessa parte!
                    </p>
                  </div>
                ) : fr?.isTie ? (
                  <div style={{
                    padding: '1.5rem 2.2rem',
                    borderRadius: 'var(--radius-xl)',
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(139, 92, 246, 0.25) 100%)',
                    border: '2px solid #ef4444',
                    boxShadow: '0 0 35px rgba(239, 68, 68, 0.4)',
                    width: '100%',
                    textAlign: 'center',
                  }}>
                    <h2 style={{ fontSize: 'clamp(2rem, 5.5vw, 3.4rem)', margin: 0, color: '#f87171', fontWeight: 900 }}>
                      ⚔️ GUERRA CIVILE! (50% vs 50%)
                    </h2>
                    <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.8rem 0 0' }}>
                      Difendete la vostra posizione dal vivo!
                    </p>
                  </div>
                ) : fr && fr.minorityNicknames.length > 0 ? (
                  <div style={{
                    padding: '1.5rem 2.2rem',
                    borderRadius: 'var(--radius-xl)',
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(20, 20, 30, 0.85) 100%)',
                    border: '2px solid #ef4444',
                    boxShadow: '0 0 35px rgba(239, 68, 68, 0.4)',
                    width: '100%',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '1.1rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#f87171', fontWeight: 800 }}>
                      MINORANZA ALLA GOGNA
                    </div>
                    <h2 style={{ fontSize: 'clamp(2rem, 5.5vw, 3.2rem)', margin: '0.5rem 0', color: '#ffffff', fontWeight: 900 }}>
                      🍺 {fr.minorityNicknames.join(', ')}!
                    </h2>
                    <p style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: '#fbbf24' }}>
                      Difendete la vostra scelta davanti al gruppo!
                    </p>
                    {fr.unvotedNicknames && fr.unvotedNicknames.length > 0 && (
                      <p style={{ fontSize: '1.15rem', margin: '0.8rem 0 0', opacity: 0.9, color: '#fca5a5' }}>
                        📵 Non hanno votato: <strong>{fr.unvotedNicknames.join(', ')}</strong>
                      </p>
                    )}
                  </div>
                ) : null}
                {split && !fr?.isEmpty && (
                  <SplitBar split={split} optionA={dilemma?.optionA} optionB={dilemma?.optionB} />
                )}
              </div>
            );
          }

          // 1b. Preferiresti che... mode: choices breakdown + minority defense cue
          if (game.partyCard?.mode === 'preferiresti') {
            const pr = game.partyCard.preferirestiResult;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', width: 'min(94vw, 56rem)' }}>
                {pr?.isEmpty ? (
                  <div style={{
                    padding: '1.5rem 2.2rem',
                    borderRadius: 'var(--radius-xl)',
                    background: 'rgba(30, 35, 55, 0.85)',
                    border: '2px solid rgba(255,255,255,0.2)',
                    width: '100%',
                    textAlign: 'center',
                  }}>
                    <h2 style={{ fontSize: 'clamp(1.8rem, 4.5vw, 2.8rem)', margin: 0, fontWeight: 900 }}>
                      Nessun voto ricevuto
                    </h2>
                    <p style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0.6rem 0 0', opacity: 0.85 }}>
                      Nessuno ha votato in questo round!
                    </p>
                  </div>
                ) : pr?.isUnanimous ? (
                  <div style={{
                    padding: '1.5rem 2.2rem',
                    borderRadius: 'var(--radius-xl)',
                    background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25) 0%, rgba(99, 102, 241, 0.25) 100%)',
                    border: '2px solid #38bdf8',
                    boxShadow: '0 0 35px rgba(56, 189, 248, 0.4)',
                    width: '100%',
                    textAlign: 'center',
                  }}>
                    <Celebration pieces={30} />
                    <h2 style={{ fontSize: 'clamp(2rem, 5.5vw, 3.2rem)', margin: 0, color: '#7dd3fc', fontWeight: 900 }}>
                      🙌 TUTTI SULLA STESSA SCELTA!
                    </h2>
                    <p style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0.8rem 0 0' }}>
                      Nessun dibattito — accordo totale!
                    </p>
                  </div>
                ) : pr?.isTie ? (
                  <div style={{
                    padding: '1.5rem 2.2rem',
                    borderRadius: 'var(--radius-xl)',
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(139, 92, 246, 0.25) 100%)',
                    border: '2px solid #f59e0b',
                    boxShadow: '0 0 35px rgba(245, 158, 11, 0.4)',
                    width: '100%',
                    textAlign: 'center',
                  }}>
                    <h2 style={{ fontSize: 'clamp(1.8rem, 5vw, 3rem)', margin: 0, color: '#fbbf24', fontWeight: 900 }}>
                      ⚔️ PARITÀ TRA LE SCELTE!
                    </h2>
                    <p style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0.7rem 0 0' }}>
                      Difendete la vostra alternativa per convincere il gruppo!
                    </p>
                  </div>
                ) : pr && pr.minorityNicknames.length > 0 ? (
                  <div style={{
                    padding: '1.4rem 2rem',
                    borderRadius: 'var(--radius-xl)',
                    background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.22) 0%, rgba(20, 20, 35, 0.88) 100%)',
                    border: '2px solid #38bdf8',
                    boxShadow: '0 0 30px rgba(56, 189, 248, 0.35)',
                    width: '100%',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '1.05rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7dd3fc', fontWeight: 800 }}>
                      SCELTA IN MINORANZA · TOCCA A VOI DIFENDERE
                    </div>
                    <h2 style={{ fontSize: 'clamp(1.9rem, 5vw, 3rem)', margin: '0.45rem 0', color: '#ffffff', fontWeight: 900 }}>
                      🍺 {pr.minorityNicknames.join(', ')}!
                    </h2>
                    <p style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, color: '#fbbf24' }}>
                      Difendete la vostra scelta davanti al gruppo!
                    </p>
                  </div>
                ) : null}
                {pr && !pr.isEmpty && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', width: '100%' }}>
                    {pr.options.map((opt) => {
                      const isWinner = pr.winningChoices.includes(opt.letter);
                      return (
                        <div
                          key={opt.letter}
                          style={{
                            padding: '0.9rem 1rem',
                            borderRadius: 'var(--radius-lg)',
                            background: isWinner ? 'rgba(16, 185, 129, 0.16)' : 'rgba(15, 23, 42, 0.72)',
                            border: isWinner ? '2px solid #34d399' : '1px solid rgba(255,255,255,0.16)',
                            textAlign: 'left',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.3rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 900, fontSize: '1rem', gap: '0.5rem' }}>
                            <span style={{ color: isWinner ? '#6ee7b7' : '#7dd3fc' }}>{opt.label}</span>
                            <span style={{ flexShrink: 0 }}>{opt.count} {opt.count === 1 ? 'voto' : 'voti'}</span>
                          </div>
                          {opt.voterNicknames.length > 0 && (
                            <div style={{ fontSize: '0.82rem', opacity: 0.82 }}>
                              👉 {opt.voterNicknames.join(', ')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // 2. Infiltrato mode: Smascheramento e confronto domande
          if (game.partyCard?.mode === 'infiltrato') {
            const res = game.partyCard.infiltratoRoundResult;
            if (res) {
              return (
                <div style={{
                  padding: '1.8rem 2.2rem',
                  borderRadius: 'var(--radius-xl)',
                  background: res.caught
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(30, 20, 50, 0.85) 100%)'
                    : 'linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(30, 20, 50, 0.85) 100%)',
                  border: `2px solid ${res.caught ? '#10b981' : '#ef4444'}`,
                  boxShadow: `0 0 35px ${res.caught ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                  width: 'min(92vw, 48rem)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)',
                  textAlign: 'center',
                  alignItems: 'center',
                }}>
                  {res.caught && <Celebration pieces={35} />}
                  <div style={{ fontSize: '1.2rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800, color: res.caught ? '#34d399' : '#f87171' }}>
                    {res.caught ? "🎉 L'INFILTRATO È STATO SMASCHERATO!" : "😈 BLUFF RIUSCITO! L'INFILTRATO SCAPPA!"}
                  </div>
                  <h2 style={{ fontSize: 'clamp(2.4rem, 5.5vw, 3.8rem)', margin: 0, fontWeight: 900, color: '#ffffff' }}>
                    🕵️ {res.infiltratorNickname}
                  </h2>
                  <p style={{ fontSize: '1.45rem', fontWeight: 700, margin: 0, color: res.caught ? '#6ee7b7' : '#fca5a5' }}>
                    {res.caught
                      ? 'Il gruppo lo ha scoperto! (+100 pt a chi lo ha accusato)'
                      : "Nessuno lo ha smascherato! (+200 pt all'Infiltrato)"}
                  </p>

                  <div style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    background: 'rgba(0, 0, 0, 0.45)',
                    padding: '1.2rem',
                    borderRadius: 'var(--radius-lg)',
                    textAlign: 'left',
                    marginTop: '0.5rem',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}>
                    <div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#10b981' }}>
                        👥 DOMANDA DEL GRUPPO:
                      </span>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
                        "{res.groupQuestion}"
                      </p>
                    </div>
                    <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '0.65rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ef4444' }}>
                        🕵️ DOMANDA DELL'INFILTRATO:
                      </span>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '1.25rem', fontWeight: 700, color: '#f87171' }}>
                        "{res.impostorQuestion}"
                      </p>
                    </div>
                  </div>
                </div>
              );
            }
          }

          // 3. Coppie mode: Parallel Couple Matches & Live Leaderboard
          if (game.partyCard?.mode === 'coppie') {
            const results = game.partyCard.coupleRoundResults ?? [];
            const couples = [...(game.partyCard.couples ?? [])].sort((a, b) => b.score - a.score);
            const anyMatch = results.some((r) => r.kind === 'match' || r.kind === 'challenge_done');
            return (
              <div style={{
                padding: '1.6rem 2rem',
                borderRadius: 'var(--radius-xl)',
                background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.22) 0%, rgba(25, 20, 45, 0.88) 100%)',
                border: '2px solid rgba(236, 72, 153, 0.65)',
                width: 'min(94vw, 54rem)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
                textAlign: 'center',
                alignItems: 'center',
              }}>
                {anyMatch && <Celebration pieces={32} />}
                <div style={{ fontSize: '1rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800, color: '#f472b6' }}>
                  💕 ESITI DI COPPIA · {game.partyCard.prompt}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', width: '100%' }}>
                  {results.map((r) => {
                    const matched = r.kind === 'match' || r.kind === 'challenge_done';
                    return (
                      <div
                        key={r.coupleId}
                        style={{
                          padding: '1rem',
                          borderRadius: 'var(--radius-lg)',
                          background: matched ? 'rgba(16, 185, 129, 0.16)' : 'rgba(15, 23, 42, 0.72)',
                          border: matched ? '1.5px solid #34d399' : '1px solid rgba(255,255,255,0.14)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem',
                        }}
                      >
                        <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>
                          {r.memberAName} ❤️ {r.memberBName}
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: matched ? '#6ee7b7' : '#fda4af' }}>
                          {r.kind === 'match'
                            ? '💞 MATCH! (+100 pt)'
                            : r.kind === 'mismatch'
                              ? '💥 SCOPPIATI!'
                              : r.kind === 'challenge_done'
                                ? '✅ SFIDA FATTA (+80 pt)'
                                : r.kind === 'challenge_partial'
                                  ? '⚡ A METÀ (+40 pt)'
                                  : '🍺 PASSANO'}
                        </div>
                        <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                          {r.memberAName}: <strong>{r.choiceALabel ?? '—'}</strong> · {r.memberBName}:{' '}
                          <strong>{r.choiceBLabel ?? '—'}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {couples.length > 1 && (
                  <div style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 'var(--radius-lg)', background: 'rgba(0,0,0,0.35)', display: 'flex', justifyContent: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                    {couples.map((c, idx) => (
                      <span key={c.id} style={{ fontSize: '0.95rem', fontWeight: 800 }}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '💕'} {c.label}: <strong>{c.score} pt</strong>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          // 4. Assurdo mode: Incoronazione de La Gogna + Sentenza
          if (game.partyCard?.mode === 'assurdo' && game.partyCard.cardType === 'gogna') {
            return (
              <div style={{
                padding: '1.8rem 2.2rem',
                borderRadius: 'var(--radius-xl)',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(20, 30, 45, 0.85) 100%)',
                border: '2px solid #10b981',
                boxShadow: '0 0 35px rgba(16, 185, 129, 0.4)',
                width: 'min(92vw, 48rem)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
                textAlign: 'center',
                alignItems: 'center',
              }}>
                <div style={{ fontSize: '1.1rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800, color: '#34d399' }}>
                  LA GOGNA DEL GRUPPO
                </div>
                <h2 style={{ fontSize: 'clamp(2.4rem, 5.5vw, 3.6rem)', margin: 0, fontWeight: 900, color: '#ffffff' }}>
                  👑 {game.partyCard.gognaTargetNickname || 'Il più votato'}!
                </h2>
                <p style={{ fontSize: '1.45rem', fontWeight: 700, margin: 0, color: '#a7f3d0' }}>
                  Incoronato con {game.partyCard.gognaVotes ?? 'la maggioranza dei'} voti dal gruppo!
                </p>

                {game.partyCard.sentenza && (
                  <div style={{
                    marginTop: '0.5rem',
                    padding: '1.1rem 1.4rem',
                    borderRadius: 'var(--radius-lg)',
                    background: 'rgba(0, 0, 0, 0.45)',
                    border: '1.5px solid #10b981',
                    width: '100%',
                  }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', color: '#fbbf24', letterSpacing: '0.08em' }}>
                      📜 SENTENZA DELL'APP:
                    </div>
                    <p style={{ margin: '0.4rem 0 0', fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>
                      "{game.partyCard.sentenza}"
                    </p>
                    <p style={{ margin: '0.4rem 0 0', fontSize: '1.05rem', opacity: 0.85, color: '#a7f3d0' }}>
                      Giustificati davanti al gruppo prima della sentenza!
                    </p>
                  </div>
                )}
              </div>
            );
          }

          // Fallback: Classic game split reveal
          return (
            <>
              {split && (
                <SplitBar split={split} optionA={dilemma?.optionA} optionB={dilemma?.optionB} />
              )}
              <RilancioCard domanda={dilemma?.domandaRilancio} />
            </>
          );
        })()}

        {phase === 'UNANIMOUS_REVEAL' && game.unanimous && (
          <>
            <Celebration pieces={40} />
            <p style={{ fontSize: '3.5rem', margin: 0 }} aria-hidden>
              🎉
            </p>
            {dilemma && (
              <p style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 800, margin: 0, maxWidth: '46rem' }}>
                {game.unanimous.side === 'A' ? dilemma.optionA : dilemma.optionB}
              </p>
            )}
            <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, opacity: 0.9 }}>
              {game.unanimous.count} su {game.unanimous.count} dalla stessa parte
            </p>
            <RilancioCard domanda={dilemma?.domandaRilancio} />
            <p style={{ fontSize: '1.15rem', margin: 0, opacity: 0.7 }}>
              Niente dibattito — nuovo dilemma in arrivo…
            </p>
          </>
        )}

        {phase === 'PREDICT' && (
          game.knowPairs ? (
            <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, maxWidth: '40rem' }}>
              Quanto mi conosci: indovinate dal telefono come ha votato il vicino ·{' '}
              {game.knowGuessedCount}/{game.knowPairs.length}
            </p>
          ) : (
            <>
              {game.finalStakesRound && (
                <p style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: 'var(--gold)' }}>
                  🔥 Ultimo round — posta doppia!
                </p>
              )}
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
            Votate dal telefono chi vi ha strappato l'applauso · {game.speakerVotedCount}/{players.length}
          </p>
        )}

        {phase === 'HOT_TAKE_VOTE' && game.hotTakePrompt && (
          <>
            <p style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, maxWidth: '42rem' }}>
              🌡️ {game.hotTakePrompt.text}
            </p>
            <p style={{ fontSize: '1.15rem', margin: 0, opacity: 0.85 }}>
              Scegliete da 1 a 10 sul telefono · {game.hotTakeSubmittedCount ?? 0}/{players.length}
            </p>
          </>
        )}

        {phase === 'HOT_TAKE_REVEAL' && game.hotTakeReveal && (
          <>
            <p style={{ fontSize: '1.45rem', fontWeight: 700, margin: 0, maxWidth: '42rem' }}>
              {game.hotTakeReveal.prompt.text}
            </p>
            <div style={{ fontSize: '3.2rem', fontWeight: 900, color: 'var(--gold)', lineHeight: 1.05 }}>
              Media {game.hotTakeReveal.average.toFixed(1)} <span style={{ fontSize: '1.3rem', opacity: 0.6 }}>/ 10</span>
            </div>
            {game.hotTakeReveal.lowest &&
              game.hotTakeReveal.highest &&
              game.hotTakeReveal.lowest.playerId !== game.hotTakeReveal.highest.playerId && (
                <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--faction-a)', fontWeight: 800 }}>❄️ PIÙ FREDDO</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>
                      {game.hotTakeReveal.lowest.nickname} ({game.hotTakeReveal.lowest.score}/10)
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--faction-b)', fontWeight: 800 }}>🔥 PIÙ CALDO</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>
                      {game.hotTakeReveal.highest.nickname} ({game.hotTakeReveal.highest.score}/10)
                    </div>
                  </div>
                </div>
              )}
          </>
        )}

        {(phase === 'CRUCIVERBA' || phase === 'CRUCIVERBA_REVEAL') && game.cruciverbaState && (
          <Card glow="accent" style={{ maxWidth: '58rem', width: 'min(95vw, 58rem)', padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'center', alignItems: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '1rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gold)' }}>
                🧩 CRUCIVERBA SHOW · {game.cruciverbaState.theme}
              </span>
              {phase === 'CRUCIVERBA' && (
                <span style={{ padding: '0.4rem 0.9rem', borderRadius: '999px', background: 'rgba(251, 191, 36, 0.2)', border: '1px solid #fbbf24', fontWeight: 900, fontSize: '1.05rem', color: '#fde68a' }}>
                  🎙️ TURNO DI {game.cruciverbaState.activePlayerName?.toUpperCase()}
                </span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1.5rem', alignItems: 'center', width: '100%' }}>
              <CruciverbaGrid state={game.cruciverbaState} size="tv" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', textAlign: 'left' }}>
                {game.cruciverbaState.words.map((w) => {
                  const isActive = phase === 'CRUCIVERBA' && w.id === game.cruciverbaState?.activeWordId;
                  return (
                    <div
                      key={w.id}
                      style={{
                        padding: '0.6rem 0.85rem',
                        borderRadius: '10px',
                        background: w.status === 'solved'
                          ? 'rgba(16, 185, 129, 0.16)'
                          : isActive
                            ? 'rgba(251, 191, 36, 0.16)'
                            : 'rgba(255, 255, 255, 0.05)',
                        border: isActive ? '1.5px solid #fbbf24' : '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: w.status === 'solved' ? '#6ee7b7' : isActive ? '#fde68a' : 'var(--gold)' }}>
                        {w.number} {w.direction === 'H' ? 'ORIZZONTALE' : 'VERTICALE'} ({w.length})
                        {w.answer ? ` — ${w.answer}` : ''}
                        {w.solvedByName ? ` · ✓ ${w.solvedByName}` : ''}
                      </div>
                      <div style={{ fontSize: '0.96rem', marginTop: '0.15rem' }}>{w.clue}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        )}

        {(phase === 'TRIBUNALE_ARGUE' || phase === 'TRIBUNALE_VOTE' || phase === 'TRIBUNALE_REVEAL') && game.tribunaleState && (() => {
          const ts = game.tribunaleState;
          return (
            <Card glow="accent" style={{ maxWidth: '54rem', width: 'min(94vw, 54rem)', padding: '1.6rem 2rem', display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'center', alignItems: 'center' }}>
              {phase === 'TRIBUNALE_REVEAL' && ts.verdict && <Celebration pieces={28} />}
              <span style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#fbbf24' }}>
                ⚖️ TRIBUNALE DEGLI AMICI · {ts.caseData.title}
              </span>
              <p style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, lineHeight: 1.35 }}>
                {ts.caseData.scenario}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%' }}>
                <div style={{ padding: '1rem', borderRadius: '14px', background: phase === 'TRIBUNALE_ARGUE' && ts.speakerIndex === 0 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(255,255,255,0.06)', border: phase === 'TRIBUNALE_ARGUE' && ts.speakerIndex === 0 ? '2px solid #fbbf24' : '1px solid rgba(255,255,255,0.12)' }}>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900 }}>⚔️ {ts.accusaName}</div>
                  <div style={{ fontSize: '0.95rem', marginTop: '0.35rem', color: 'var(--text-muted)' }}>{ts.caseData.accusaRole}</div>
                </div>
                <div style={{ padding: '1rem', borderRadius: '14px', background: phase === 'TRIBUNALE_ARGUE' && ts.speakerIndex === 1 ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.06)', border: phase === 'TRIBUNALE_ARGUE' && ts.speakerIndex === 1 ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.12)' }}>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900 }}>🛡️ {ts.difesaName}</div>
                  <div style={{ fontSize: '0.95rem', marginTop: '0.35rem', color: 'var(--text-muted)' }}>{ts.caseData.difesaRole}</div>
                </div>
              </div>
              {phase === 'TRIBUNALE_ARGUE' && (
                <div style={{ padding: '0.6rem 1.2rem', borderRadius: '999px', background: 'rgba(251, 191, 36, 0.2)', border: '1px solid #fbbf24', fontSize: '1.25rem', fontWeight: 900 }}>
                  🎙️ ARRINGA DI {ts.activeSpeakerName.toUpperCase()}
                </div>
              )}
              {phase === 'TRIBUNALE_VOTE' && (
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#6ee7b7' }}>
                  🗳️ Giuria al voto ({ts.votesCount}/{ts.totalJurors}) — chi ha ragione?
                </div>
              )}
              {phase === 'TRIBUNALE_REVEAL' && ts.verdict && (
                <div style={{ width: '100%', padding: '1rem', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.16)', border: '1.5px solid #34d399', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900 }}>
                    {ts.verdict.winner === 'TIE' ? '🤝 Patteggiamento!' : `🏆 Vince ${ts.verdict.winnerNames.join(' & ')}!`}
                  </div>
                  <div style={{ fontSize: '1.05rem' }}>
                    {ts.accusaName}: <strong>{ts.verdict.accusaVotes}</strong> · {ts.difesaName}: <strong>{ts.verdict.difesaVotes}</strong>
                  </div>
                  {ts.verdict.loserName && (
                    <div style={{ fontSize: '1.05rem', color: '#fda4af', fontWeight: 700 }}>
                      🔨 Sentenza per {ts.verdict.loserName}: {ts.caseData.penalty}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })()}

        {phase === 'TELEPATHY' && game.telepathyPrompt && (
          <Card glow="accent" style={{ maxWidth: '44rem', width: 'min(92vw, 44rem)', padding: '1.6rem 2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', textAlign: 'center', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--gold)' }}>
              🧠 Silenzio al tavolo · Scrivi 1 parola
            </span>
            <p style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)', fontWeight: 800, margin: 0 }}>
              {game.telepathyPrompt.prompt}
            </p>
            <p style={{ margin: 0, fontSize: '1.15rem', opacity: 0.85 }}>
              Pronti {game.telepathyProgress ? `${game.telepathyProgress.done}/${game.telepathyProgress.total}` : `0/${players.length}`}
            </p>
          </Card>
        )}

        {phase === 'TELEPATHY_REVEAL' && game.telepathyReveal && (
          <Card glow={game.telepathyReveal.syncedCount > 0 ? 'accent' : undefined} style={{ maxWidth: '48rem', width: 'min(92vw, 48rem)', padding: '1.6rem 2rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', textAlign: 'center', alignItems: 'center' }}>
            <p style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>
              {game.telepathyReveal.prompt.prompt}
            </p>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: game.telepathyReveal.syncedCount > 0 ? '#34d399' : 'var(--gold)' }}>
              {game.telepathyReveal.syncedCount}/{game.telepathyReveal.totalPlayers} menti allineate!
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center', width: '100%' }}>
              {game.telepathyReveal.clusters.map((cluster) => {
                const synced = cluster.nicknames.length >= 2;
                return (
                  <div
                    key={cluster.word}
                    style={{
                      padding: '0.75rem 1.1rem',
                      borderRadius: 'var(--radius-lg)',
                      border: synced ? '2px solid #34d399' : '1px solid rgba(255,255,255,0.16)',
                      background: synced ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>{cluster.word}</div>
                    <div style={{ fontSize: '0.95rem', opacity: 0.85 }}>{cluster.nicknames.join(', ')}</div>
                    {synced && (
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#34d399', marginTop: '0.2rem' }}>
                        +{cluster.pointsPerPlayer} pt ciascuno
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {phase === 'GROUP_MIND' && game.groupMindQuestion && (
          <>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, maxWidth: '40rem' }}>
              {game.groupMindQuestion.prompt}
            </p>
            <p style={{ fontSize: '1.1rem', margin: 0, opacity: 0.85 }}>
              Rispondete dal telefono e indovinate la maggioranza ·{' '}
              {game.groupMindProgress ? `${game.groupMindProgress.done}/${game.groupMindProgress.total}` : ''}
            </p>
          </>
        )}

        {phase === 'GROUP_MIND_REVEAL' && game.groupMindQuestion && game.groupMindTally && (
          <>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, maxWidth: '40rem' }}>
              {game.groupMindQuestion.prompt}
            </p>
            <SplitBar
              split={game.groupMindTally}
              optionA={game.groupMindQuestion.optionA}
              optionB={game.groupMindQuestion.optionB}
            />
            <p style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--gold)' }}>
              🔮 {game.groupMindTally.correctGuessers} {game.groupMindTally.correctGuessers === 1 ? 'ha letto' : 'hanno letto'} bene il gruppo
            </p>
          </>
        )}

        {phase === 'WRITE' && game.writePrompt && (
          <>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, maxWidth: '40rem' }}>
              {game.writePrompt.text}
            </p>
            <p style={{ fontSize: '1.1rem', margin: 0, opacity: 0.85 }}>
              Scrivete dal telefono ·{' '}
              {game.writeProgress ? `${game.writeProgress.done}/${game.writeProgress.total}` : ''}
            </p>
          </>
        )}

        {phase === 'WRITE_VOTE' && game.writePrompt && (
          <>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, maxWidth: '40rem' }}>
              {game.writePrompt.text}
            </p>
            <p style={{ fontSize: '1.1rem', margin: 0, opacity: 0.85 }}>
              Votate la vostra preferita dal telefono ·{' '}
              {game.writeVoteProgress ? `${game.writeVoteProgress.done}/${game.writeVoteProgress.total}` : ''}
            </p>
          </>
        )}

        {phase === 'WRITE_REVEAL' && game.writeReveal && game.writeReveal.length > 0 && (
          <CardGrid>
            {[...game.writeReveal]
              .sort((a, b) => b.votes - a.votes)
              .map((a, i) => (
                <Card key={a.id} glow={i === 0 && a.votes > 0 ? 'accent' : undefined} style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '1.1rem' }}>
                    {i === 0 && a.votes > 0 && '🏆 '}
                    {a.text}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.7 }}>
                    {a.authorNickname} · {a.votes} {a.votes === 1 ? 'voto' : 'voti'}
                  </p>
                </Card>
              ))}
          </CardGrid>
        )}

        {(phase === 'DEFENSE' || phase === 'INTERVENTI') && lastTurnApplause && (
          <p style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, opacity: 0.9 }}>
            {lastTurnApplause.nickname}:{' '}
            {Object.entries(lastTurnApplause.tally)
              .map(([emoji, count]) => `${emoji}×${count}`)
              .join(' ')}
          </p>
        )}

        {phase === 'DEFENSE' && (
          game.partyCard?.mode === 'infiltrato' ? (
            <div
              style={{
                maxWidth: '46rem',
                padding: '1.4rem 2rem',
                borderRadius: 'var(--radius-xl)',
                background: 'linear-gradient(145deg, rgba(139, 92, 246, 0.3) 0%, rgba(30, 20, 50, 0.9) 100%)',
                border: '2px solid #8b5cf6',
                boxShadow: '0 0 35px rgba(139, 92, 246, 0.4)',
                textAlign: 'center',
                marginBottom: '1rem',
              }}
            >
              <h3 style={{ margin: '0 0 0.5rem', fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', color: '#c4b5fd', fontWeight: 900 }}>
                🚨 DIBATTITO LIBERO: CHI È L'INFILTRATO?
              </h3>
              <p style={{ margin: 0, fontSize: '1.25rem', opacity: 0.95, color: '#f3e8ff' }}>
                Interrogatevi sulle risposte date a voce. Chi sta mentendo? Smascheratelo!
              </p>
            </div>
          ) : null
        )}

        {phase === 'DEFENSE' && (
          game.partyCard?.mode === 'flash' ? (
            <div
              style={{
                maxWidth: '48rem',
                width: 'min(92vw, 48rem)',
                padding: '1.3rem 2rem',
                borderRadius: 'var(--radius-xl)',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(239, 68, 68, 0.25) 100%)',
                border: '2px solid #f59e0b',
                boxShadow: '0 0 30px rgba(245, 158, 11, 0.35)',
                textAlign: 'center',
                marginBottom: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              {dilemma && (
                <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, opacity: 0.95 }}>
                  “{dilemma.text}” <span style={{ opacity: 0.75 }}>({dilemma.optionA} / {dilemma.optionB})</span>
                </p>
              )}
              {game.partyCard.flashResult?.isTie ? (
                <h3 style={{ margin: 0, fontSize: 'clamp(1.4rem, 4vw, 2rem)', color: '#f87171', fontWeight: 900 }}>
                  ⚔️ GUERRA CIVILE (50% vs 50%)!
                </h3>
              ) : game.partyCard.flashResult?.minorityNicknames.length ? (
                <h3 style={{ margin: 0, fontSize: 'clamp(1.4rem, 4vw, 2rem)', color: '#fbbf24', fontWeight: 900 }}>
                  🍺 IN GOGNA: {game.partyCard.flashResult.minorityNicknames.join(', ')}
                </h3>
              ) : null}
              <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#fde68a' }}>
                ⚡ DIFESA LAMPO: Difendete la vostra scelta davanti a tutti!
              </p>
            </div>
          ) : game.partyCard?.mode === 'preferiresti' ? (
            <div
              style={{
                maxWidth: '50rem',
                width: 'min(92vw, 50rem)',
                padding: '1.3rem 2rem',
                borderRadius: 'var(--radius-xl)',
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.24) 0%, rgba(99, 102, 241, 0.24) 100%)',
                border: '2px solid #818cf8',
                boxShadow: '0 0 30px rgba(99, 102, 241, 0.35)',
                textAlign: 'center',
                marginBottom: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, opacity: 0.95 }}>
                {game.partyCard.prompt}
              </p>
              {game.partyCard.preferirestiResult?.isTie ? (
                <h3 style={{ margin: 0, fontSize: 'clamp(1.4rem, 4vw, 2rem)', color: '#fbbf24', fontWeight: 900 }}>
                  ⚔️ PARITÀ TRA LE SCELTE!
                </h3>
              ) : game.partyCard.preferirestiResult?.minorityNicknames.length ? (
                <h3 style={{ margin: 0, fontSize: 'clamp(1.4rem, 4vw, 2rem)', color: '#7dd3fc', fontWeight: 900 }}>
                  🍺 DIFENDONO LA LORO SCELTA: {game.partyCard.preferirestiResult.minorityNicknames.join(', ')}
                </h3>
              ) : null}
              <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#fde68a' }}>
                🔀 CONVINCETE IL GRUPPO DELLA VOSTRA SCELTA!
              </p>
            </div>
          ) : null
        )}

        {phase === 'DEFENSE' && (
          game.partyCard?.mode === 'assurdo' && game.partyCard.cardType === 'gogna' && game.partyCard.gognaTargetNickname ? (
            <div
              style={{
                maxWidth: '46rem',
                width: 'min(92vw, 46rem)',
                padding: '1.3rem 2rem',
                borderRadius: 'var(--radius-xl)',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(20, 30, 45, 0.85) 100%)',
                border: '2px solid #10b981',
                boxShadow: '0 0 30px rgba(16, 185, 129, 0.35)',
                textAlign: 'center',
                marginBottom: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.55rem',
              }}
            >
              <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, opacity: 0.9 }}>
                {dilemma?.text ?? game.partyCard.prompt}
              </p>
              <h3 style={{ margin: 0, fontSize: 'clamp(1.4rem, 4vw, 2rem)', color: '#34d399', fontWeight: 900 }}>
                👑 ALLA GOGNA: {game.partyCard.gognaTargetNickname}! ({game.partyCard.gognaVotes} voti)
              </h3>
              {game.partyCard.sentenza && (
                <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                  📜 “{game.partyCard.sentenza}”
                </p>
              )}
              <p style={{ margin: '0.2rem 0 0', fontSize: '1.15rem', fontWeight: 700, color: '#a7f3d0' }}>
                Giustificati davanti al gruppo prima di scontare la sentenza!
              </p>
            </div>
          ) : null
        )}

        {phase === 'DEFENSE' && defense && (
          defense.speaker ? (
            <section
              aria-label="Chi sta difendendo"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}
            >
              {game.isDevilRound && (
                <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--gold)' }}>
                  🎭 Avvocato del Diavolo — si difende il lato OPPOSTO al proprio voto!
                </p>
              )}
              {game.absurdConstraint && (
                <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--gold)' }}>
                  🎭 Vincolo: {game.absurdConstraint}
                </p>
              )}
              {game.twist && (
                <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--gold)' }}>
                  {game.twist.label}: {game.twist.description}
                </p>
              )}
              {defense.totalTurns > 1 && (
                <p style={{ opacity: 0.7, margin: 0, fontSize: '1.1rem' }}>
                  Turno {defense.turn}/{defense.totalTurns}
                </p>
              )}
              <p style={{ fontSize: 'clamp(1.6rem, 5vw, 2.6rem)', fontWeight: 800, margin: 0 }}>
                {defense.argument ? '🤖' : 'Sta parlando'}{' '}
                <span style={{ color: 'var(--gold)' }}>{defense.speaker.nickname}</span> {defense.argument ? '' : '🎤'}
              </p>
              <div
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  background:
                    defense.speaker.side === 'A' ? 'rgba(84,134,196,0.18)' : 'rgba(199,122,69,0.18)',
                  border: `2px solid ${
                    defense.speaker.side === 'A' ? 'rgba(84,134,196,0.5)' : 'rgba(199,122,69,0.5)'
                  }`,
                }}
              >
                {defense.speaker.devil ? '🎭 ' : ''}Difende:{' '}
                {defense.speaker.side === 'A' ? dilemma?.optionA : dilemma?.optionB}
              </div>
              {defense.raisedCount > 0 && (
                <p style={{ margin: 0, fontSize: '1.2rem', opacity: 0.85 }}>
                  ✋ {defense.raisedCount} {defense.raisedCount === 1 ? 'vuole' : 'vogliono'} intervenire
                </p>
              )}
              {defense.argument && (
                <p style={{ fontSize: '1.4rem', fontStyle: 'italic', margin: 0, maxWidth: 'min(90vw, 44rem)', opacity: 0.95 }}>
                  “{defense.argument}”
                </p>
              )}
              {defense.spunti && defense.spunti.length > 0 && (
                <ul style={{ margin: '0.5rem 0 0', padding: 0, listStyle: 'none', textAlign: 'center', display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  {defense.spunti.map((s, i) => (
                    <li key={`${i}-${s}`} style={{ fontSize: '1.1rem', opacity: 0.85 }}>{s}</li>
                  ))}
                </ul>
              )}
            </section>
          ) : !game.partyCard ? (
            <p style={{ fontSize: '1.4rem', opacity: 0.8, margin: 0 }}>
              Nessuno ha votato: niente difese per questo dilemma.
            </p>
          ) : null
        )}

        {phase === 'INTERVENTI' && defense && (
          <section
            aria-label="Interventi"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}
          >
            <p style={{ fontSize: 'clamp(1.6rem, 5vw, 2.6rem)', fontWeight: 800, margin: 0 }}>
              Interviene <span style={{ color: 'var(--gold)' }}>{defense.intervenor?.nickname ?? '…'}</span> 🙋
            </p>
            {defense.queue && defense.queue.length > 0 && (
              <ol style={{ margin: 0, padding: 0, listStylePosition: 'inside', textAlign: 'center', display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                {defense.queue.map((q) => (
                  <li
                    key={q.id}
                    style={{
                      fontSize: '1.15rem',
                      fontWeight: q.id === defense.speakerId ? 800 : 400,
                      opacity: q.id === defense.speakerId ? 1 : 0.6,
                    }}
                  >
                    {q.nickname}{q.id === defense.speakerId ? ' 🎤' : ''}
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        {phase === 'PHASE_RESULTS' && swing && <ResultsPanel swing={swing} dilemma={dilemma} />}

        {phase === 'ACCUSE' && (
          <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, maxWidth: '40rem' }}>
            🕵️ Accusate dal telefono: chi era l'infiltrato? · {game.accusedCount}/{players.length}
          </p>
        )}

        {phase === 'FINAL_AWARDS' && game.infiltratoResult && (
          <div
            style={{
              padding: '1rem 1.6rem',
              borderRadius: 'var(--radius-lg)',
              textAlign: 'center',
              background: 'var(--gold-soft)',
              border: '2px solid var(--gold-line)',
            }}
          >
            <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>
              🕵️ L'infiltrato era{' '}
              <span style={{ color: 'var(--gold)' }}>{game.infiltratoResult.infiltratorNickname}</span>
            </p>
            <p style={{ margin: '0.4rem 0 0', fontSize: '1.3rem' }}>
              {game.infiltratoResult.won
                ? `Ha vinto! ${game.infiltratoResult.flips} ribaltoni, mai scoperto.`
                : game.infiltratoResult.caught
                  ? 'Smascherato dal gruppo! 🎉'
                  : 'Missione fallita.'}
            </p>
            {game.partyCard?.groupQuestion && game.partyCard?.impostorQuestion && (
              <div
                style={{
                  marginTop: '0.75rem',
                  fontSize: '1.1rem',
                  opacity: 0.95,
                  textAlign: 'left',
                  background: 'rgba(0,0,0,0.3)',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <p style={{ margin: '0 0 0.35rem', color: '#10b981' }}>
                  👥 <strong>Domanda del gruppo:</strong> “{game.partyCard.groupQuestion}”
                </p>
                <p style={{ margin: 0, color: '#ef4444' }}>
                  🕵️ <strong>Domanda dell'infiltrato:</strong> “{game.partyCard.impostorQuestion}”
                </p>
              </div>
            )}
          </div>
        )}

        {phase === 'FINAL_AWARDS' && game.teams && (
          <div
            style={{
              padding: '1rem 1.6rem',
              borderRadius: 'var(--radius-lg)',
              textAlign: 'center',
              background: 'var(--faction-a-soft)',
              border: '2px solid var(--faction-a-line)',
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

        {phase === 'FINAL_AWARDS' && game.partyMode === 'coppie' && game.partyCard?.couples && game.partyCard.couples.length > 0 && (
          <div style={{ padding: '1.2rem 1.8rem', borderRadius: 'var(--radius-xl)', background: 'rgba(236, 72, 153, 0.14)', border: '1.5px solid rgba(236, 72, 153, 0.5)', width: 'min(92vw, 44rem)' }}>
            <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.4rem', color: '#fbcfe8' }}>🏆 Classifica Coppie</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {[...game.partyCard.couples].sort((a, b) => b.score - a.score).map((c, idx) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem', fontWeight: 800 }}>
                  <span>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '💕'} {c.label}</span>
                  <span style={{ color: 'var(--gold)' }}>{c.score} pt ({c.matches} match)</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {phase === 'FINAL_AWARDS' && game.podium && <PodiumPanel podium={game.podium} />}
        {phase === 'FINAL_AWARDS' && namedMoments && <NamedMomentsPanel moments={namedMoments} />}
        {phase === 'FINAL_AWARDS' && awards && <AwardsPanel awards={awards} />}

        {phase === 'DUO_PICK_PREDICT' && (
          <p aria-label="Quanti hanno scelto e previsto" style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>
            Scegliete e prevedete in segreto ({game.duoSyncedCount}/2)
          </p>
        )}

        {phase === 'DUO_SIDE_PICK' && (
          <p aria-label="Quanti hanno scelto" style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>
            Scegliete in segreto ({game.votedCount}/2)
          </p>
        )}

        {(phase === 'DUO_SYNC_REVEAL' || phase === 'DUO_REVEAL') && duoSyncReveal && (
          <section
            aria-label="Le vostre scelte"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}
          >
            <CardGrid min={10} max="min(92vw, 32rem)">
              {duoSyncReveal.picks.map((p) => {
                const rgb = p.choice === 'A' ? '84,134,196' : '199,122,69';
                return (
                  <div
                    key={p.id}
                    style={{
                      padding: '1rem 1.4rem',
                      borderRadius: 'var(--radius-lg)',
                      background: `rgba(${rgb},0.18)`,
                      border: `2px solid rgba(${rgb},0.5)`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 'var(--space-1)',
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{p.nickname}</span>
                    <span style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                      {p.choice === 'A' ? dilemma?.optionA : dilemma?.optionB}
                    </span>
                  </div>
                );
              })}
            </CardGrid>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
              {duoSyncReveal.agreed
                ? phase === 'DUO_REVEAL'
                  ? '🤝 Siete d’accordo! 🎭 Twist in arrivo…'
                  : '🤝 Siete in sintonia!'
                : phase === 'DUO_REVEAL'
                  ? '⚔️ Si va al duello!'
                  : 'Punti di vista diversi'}
            </p>
            {phase === 'DUO_SYNC_REVEAL' &&
              duoSyncReveal.predictions
                .filter((p) => p.correct)
                .map((p) => (
                  <p key={p.id} style={{ fontSize: '1.1rem', opacity: 0.85, margin: 0 }}>
                    🔮 <strong>{p.nickname}</strong> ci ha visto giusto (+1 «ti conosco»)
                  </p>
                ))}
          </section>
        )}

        {phase === 'DUO_ARGUE' && duoTurn?.speaker && (
          <section
            aria-label="Chi argomenta"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}
          >
            {duoTurn.speaker.advocate && (
              <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--gold)' }}>
                🎭 Avvocato del Diavolo — difende il lato OPPOSTO al proprio voto!
              </p>
            )}
            {duoTurn.speaker.inverted && !duoTurn.speaker.advocate && (
              <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--gold)' }}>
                🎭 A parti invertite — difende il lato che NON ha scelto
              </p>
            )}
            {duoTurn.totalTurns > 1 && (
              <p style={{ opacity: 0.7, margin: 0, fontSize: '1.1rem' }}>
                Turno {duoTurn.turn}/{duoTurn.totalTurns}
              </p>
            )}
            <p style={{ fontSize: 'clamp(1.6rem, 5vw, 2.6rem)', fontWeight: 800, margin: 0 }}>
              Argomenta <span style={{ color: 'var(--gold)' }}>{duoTurn.speaker.nickname}</span> 🎤
            </p>
            <div
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: 'var(--radius-lg)',
                fontSize: '1.25rem',
                fontWeight: 700,
                background: duoTurn.speaker.side === 'A' ? 'rgba(84,134,196,0.18)' : 'rgba(199,122,69,0.18)',
                border: `2px solid ${duoTurn.speaker.side === 'A' ? 'rgba(84,134,196,0.5)' : 'rgba(199,122,69,0.5)'}`,
              }}
            >
              Difende:{' '}
              {duoTurn.speaker.side === 'A' ? dilemma?.optionA : dilemma?.optionB}
            </div>
          </section>
        )}

        {phase === 'DUO_WAVER' && (
          <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, maxWidth: '40rem' }}>
            {duoAdvocateId
              ? 'Chi ha ascoltato valuta in segreto: ti ha fatto vacillare?'
              : 'Valutate in segreto: vi ha fatto vacillare?'}{' '}
            · {game.duoWaverCount}/{duoAdvocateId ? 1 : 2}
          </p>
        )}

        {phase === 'DUO_ROUND_RESULT' && duoRoundResult && (
          <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
            {(duoRoundResult.convinced.length > 0 || duoRoundResult.vacillare.some((v) => v.received > 0)) && (
              <Celebration />
            )}
            {duoRoundResult.convinced.length > 0 ? (
              duoRoundResult.convinced.map((c) => (
                <p key={c.convinced.id} style={{ fontSize: 'clamp(1.5rem, 4.5vw, 2.4rem)', fontWeight: 800, margin: 0 }}>
                  {c.ribaltone ? '🎭 Ribaltone! ' : '🎯 '}
                  <span style={{ color: 'var(--gold)' }}>{c.persuader.nickname}</span> ha convinto{' '}
                  {c.convinced.nickname}!
                </p>
              ))
            ) : duoRoundResult.vacillare.some((v) => v.received > 0) ? (
              duoRoundResult.vacillare
                .filter((v) => v.received > 0)
                .map((v) => (
                  <p key={v.id} style={{ fontSize: 'clamp(1.4rem, 4vw, 2.2rem)', fontWeight: 800, margin: 0 }}>
                    ✨ <span style={{ color: 'var(--gold)' }}>{v.nickname}</span> ha fatto vacillare (+{v.received})
                  </p>
                ))
            ) : (
              <p style={{ fontSize: 'clamp(1.6rem, 5vw, 2.6rem)', fontWeight: 800, margin: 0 }}>
                Nessuno ha ceduto 🪨
              </p>
            )}
            <p style={{ fontSize: '1.1rem', opacity: 0.8, margin: 0 }}>
              {duoRoundResult.scores.map((s) => `${s.nickname} ${s.total}`).join(' · ')}
            </p>
          </section>
        )}

        {phase === 'DUO_PICK' && (
          <p aria-label="Quanti hanno scelto" style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>
            Schieratevi in segreto ({game.votedCount}/2)
          </p>
        )}

        {phase === 'DUO_REPICK' && (
          <p style={{ fontSize: '1.4rem', fontWeight: 600, margin: 0, opacity: 0.9 }}>
            {duoAdvocateId ? 'Chi ha ascoltato ri-sceglie: si è convinto?' : 'Ri-scegliete: vi siete convinti?'} 📱
          </p>
        )}

        {phase === 'DUO_PORTRAIT' && duoPortrait && (
          <section
            aria-label="Ritratto di coppia"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}
          >
            <Celebration pieces={40} />
            <CardGrid min={10} max="min(92vw, 30rem)">
              {duoPortrait.scores.map((s) => (
                <Card
                  key={s.id}
                  glow={s.id === duoPortrait.winnerId ? 'accent' : undefined}
                  style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', alignItems: 'center', textAlign: 'center' }}
                >
                  <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>{s.nickname}</span>
                  <span style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--gold)' }}>{s.total}</span>
                  <span style={{ fontSize: '0.95rem', opacity: 0.8 }}>punti</span>
                </Card>
              ))}
            </CardGrid>
            <p style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>
              {duoPortrait.winnerId == null
                ? 'Pareggio — sintonia totale 🤝'
                : `Stasera l’ha spuntata ${duoPortrait.scores.find((s) => s.id === duoPortrait.winnerId)?.nickname ?? ''}`}
            </p>
            <p style={{ fontSize: '1.1rem', opacity: 0.85, margin: 0 }}>
              Sintonia {duoPortrait.sintoniaPct}% · d’accordo {duoPortrait.agreements}/{duoPortrait.truePicks}
            </p>
            {duoPortrait.tiConosco.length > 0 && (
              <p style={{ fontSize: '1rem', opacity: 0.8, margin: 0 }}>
                🔮 Ti conosco: {duoPortrait.tiConosco.map((t) => `${t.nickname} ${t.hits}`).join(' · ')}
              </p>
            )}
            {duoPortrait.momento && (
              <p style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                {duoPortrait.momento.emoji} {duoPortrait.momento.title} — {duoPortrait.momento.description}
              </p>
            )}
            {duoPortrait.titoli.length > 0 && (
              <CardGrid min={10} max="min(92vw, 32rem)">
                {duoPortrait.titoli.map((t, i) => (
                  <div
                    key={`${t.playerId}-${i}`}
                    style={{
                      padding: '0.75rem 1.2rem',
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--gold-soft)',
                      border: '2px solid var(--gold-line)',
                      textAlign: 'center',
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 800 }}>
                      {t.emoji} {t.title}
                    </p>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.9rem', opacity: 0.85 }}>
                      {t.nickname} · {t.description}
                    </p>
                  </div>
                ))}
              </CardGrid>
            )}
          </section>
        )}

        </div>
      </main>
    );
  }

  // LOBBY: show the code + roster + a passive "waiting for the leader" line.
  return (
    <main style={screen}>
      {!audioReady && <AudioGate onActivate={activateAudio} />}
      <MuteButton />
      <Logo size={68} payoff />
      <p style={{ opacity: 0.8, margin: 0, fontSize: '1.1rem' }}>
        Entra da <strong>{window.location.host}</strong> con il codice
      </p>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-4) var(--space-7)',
          borderRadius: 'var(--radius-xl)',
          background: 'linear-gradient(145deg, rgba(22, 28, 58, 0.75) 0%, rgba(10, 14, 28, 0.75) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1.5px solid var(--gold-line)',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.6), var(--glow-accent)',
        }}
      >
        <span
          style={{
            fontSize: '0.85rem',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--gold)',
            fontWeight: 800,
          }}
        >
          CODICE DELLA STANZA
        </span>
        <div
          style={{
            fontSize: 'clamp(4rem, 18vw, 8.5rem)',
            fontWeight: 800,
            letterSpacing: '0.45rem',
            fontFamily: 'var(--font-mono)',
            lineHeight: 1,
            color: '#ffffff',
            textShadow: '0 0 28px rgba(229, 193, 88, 0.5)',
          }}
        >
          {code}
        </div>
      </div>

      <section style={{ marginTop: '0.5rem', width: 'min(90vw, 38rem)' }}>
        <h2 style={{ fontSize: '1.35rem', margin: '0 0 0.85rem', fontWeight: 800 }}>
          Giocatori Connessi ({players.length}/8)
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
              gap: 'var(--space-2)',
              justifyContent: 'center',
            }}
          >
            {players.map((p) => (
              <li
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: '0.5rem 1.1rem',
                  borderRadius: 'var(--radius-pill)',
                  background: p.isBot
                    ? 'rgba(229, 193, 88, 0.18)'
                    : 'linear-gradient(135deg, rgba(62, 130, 252, 0.16) 0%, rgba(255, 255, 255, 0.06) 100%)',
                  border: `1px solid ${p.isBot ? 'var(--gold-line)' : 'rgba(255, 255, 255, 0.14)'}`,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  fontWeight: 700,
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3)',
                  opacity: p.connected === false ? 0.5 : 1,
                }}
              >
                {p.isBot && <span aria-label="bot">🤖</span>}
                {p.nickname}
                {p.isBot && p.persona && (
                  <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{PERSONA_LABELS[p.persona]}</span>
                )}
                {p.role === 'pubblico' && (
                  <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>🎟️</span>
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
