import { MAX_SUBMISSIONS_PER_PLAYER } from '../../shared/events';
import { Card, Button, Alert, TextInput } from '../../shared/ui';

interface SubmitDilemmaCardProps {
  submittedCount: number;
  mySubmitted: number;
  text: string;
  optionA: string;
  optionB: string;
  onTextChange: (v: string) => void;
  onOptionAChange: (v: string) => void;
  onOptionBChange: (v: string) => void;
  onSubmit: () => void;
  error: string | null;
}

// The lobby card where any player can add up to MAX_SUBMISSIONS_PER_PLAYER of
// their own dilemmas (they enter the game first). Presentational: the parent owns
// the draft state and the socket emit.
export default function SubmitDilemmaCard({
  submittedCount,
  mySubmitted,
  text,
  optionA,
  optionB,
  onTextChange,
  onOptionAChange,
  onOptionBChange,
  onSubmit,
  error,
}: SubmitDilemmaCardProps) {
  const canSubmit =
    mySubmitted < MAX_SUBMISSIONS_PER_PLAYER &&
    text.trim() !== '' &&
    optionA.trim() !== '' &&
    optionB.trim() !== '';
  return (
    <Card
      style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: '0.55rem', textAlign: 'left' }}
    >
      <h3 style={{ margin: 0, fontSize: '1.05rem' }}>✍️ Aggiungi un dilemma</h3>
      <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.75 }}>
        I vostri dilemmi entrano in gioco per primi · {submittedCount} dal gruppo
      </p>
      {mySubmitted >= MAX_SUBMISSIONS_PER_PLAYER ? (
        <p style={{ margin: 0, fontWeight: 700, opacity: 0.9 }}>
          Hai aggiunto {mySubmitted} dilemmi. Grazie! 🙌
        </p>
      ) : (
        <>
          <TextInput
            aria-label="La domanda"
            placeholder="La domanda (es. Mare o montagna?)"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
          />
          <TextInput
            aria-label="Opzione A"
            placeholder="Opzione A"
            value={optionA}
            onChange={(e) => onOptionAChange(e.target.value)}
          />
          <TextInput
            aria-label="Opzione B"
            placeholder="Opzione B"
            value={optionB}
            onChange={(e) => onOptionBChange(e.target.value)}
          />
          <Button variant="ghost" onClick={onSubmit} disabled={!canSubmit}>
            Aggiungi dilemma{mySubmitted > 0 ? ` (${mySubmitted}/${MAX_SUBMISSIONS_PER_PLAYER})` : ''}
          </Button>
          {error && <Alert>{error}</Alert>}
        </>
      )}
    </Card>
  );
}
