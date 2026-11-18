import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { BasicsIcon } from '../icons';
import { BigInput, Block, Scene, SceneFooter, type SceneProps, StageButton, StageInput, StageTextArea } from '../stage';

/** Tap to add to the description, so nobody starts from a blank box. */
const PERKS = [
  'Air-conditioned',
  'Indoor',
  'Outdoor',
  'Night lights',
  'Free parking',
  'Showers',
  'Equipment for rent',
  'Beginner-friendly',
];

export function BasicsScene({ setup, refresh, next }: SceneProps) {
  const v = setup.venue;
  const [name, setName] = useState(v.name);
  const [description, setDescription] = useState(v.description ?? '');
  const [phone, setPhone] = useState(v.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const has = (p: string) => description.toLowerCase().includes(p.toLowerCase());
  const toggle = (p: string) => {
    if (has(p)) {
      setDescription((d) => d.replace(new RegExp(`\\s*${p}\\.?`, 'i'), '').trim());
    } else {
      setDescription((d) => `${d.trim()}${d.trim() && !/[.!?]$/.test(d.trim()) ? '.' : ''} ${p}.`.trim());
    }
  };

  async function save() {
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from('venues')
      .update({ name: name.trim(), description: description.trim() || null, phone: phone.trim() || null })
      .eq('id', v.id);
    setBusy(false);
    if (error) return setError(error.message);
    await refresh();
    next();
  }

  return (
    <Scene
      eyebrow="Step 1 · Basics"
      icon={<BasicsIcon />}
      title="What should players know about your place?"
      intro="This is the first thing they read. Keep it short; you can change it any time."
    >
      <Block label="Venue name">
        <BigInput aria-label="Venue name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </Block>

      <Block label="Describe it in a line or two" hint="Tap to add, tap again to remove. Then make it yours.">
        <div className="mb-3 flex flex-wrap gap-2">
          {PERKS.map((p) => (
            <StageButton key={p} kind={has(p) ? 'chipOn' : 'chip'} onClick={() => toggle(p)} aria-pressed={has(p)}>
              {has(p) ? '✓ ' : '+ '}
              {p}
            </StageButton>
          ))}
        </div>
        <StageTextArea
          aria-label="Description"
          rows={3}
          maxLength={600}
          placeholder="Six badminton courts with proper lighting, ten minutes from the MRT."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Block>

      <Block label="Front desk number" hint="Shown to players who book, in case they need to reach you.">
        <StageInput
          type="tel"
          autoComplete="tel"
          placeholder="0917 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="max-w-xs"
        />
      </Block>

      <SceneFooter onNext={save} busy={busy} disabled={name.trim().length < 2} error={error} />
    </Scene>
  );
}
