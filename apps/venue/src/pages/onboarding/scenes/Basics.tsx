import { isPhMobile, phMobileInput, toPhMobile } from '@verzus/schemas/phone';
import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { saveLabel, useAutosave } from '../autosave';
import { BasicsIcon } from '../icons';
import { BigInput, Block, Scene, SceneFooter, type SceneProps, StageButton, StageTextArea } from '../stage';

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
  // The 10 digits after +63; the +63 is fixed in front of the field.
  const [phone, setPhone] = useState(phMobileInput(v.phone ?? ''));
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneOk = isPhMobile(phone);
  // Only complain once they've left the field (or a saved number is wrong), not mid-typing.
  const phoneWrong = !phoneOk && (phoneTouched || Boolean(v.phone)) && phone !== '';
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

  // Saved as they type, once the name and mobile number are valid.
  const ready = name.trim().length >= 2 && phoneOk;
  const auto = useAutosave({ name: name.trim(), description: description.trim(), phone }, ready, async (d) => {
    const { error } = await supabase
      .from('venues')
      .update({ name: d.name, description: d.description || null, phone: toPhMobile(d.phone) })
      .eq('id', v.id);
    if (error) throw error;
    await refresh();
  });

  async function save() {
    setBusy(true);
    setError(null);
    const ok = await auto.flush();
    setBusy(false);
    if (!ok) return setError("Couldn't save. Check your connection and try again.");
    next();
  }

  return (
    <Scene eyebrow="Step 1 · Basics" icon={<BasicsIcon />} title="The basics">
      {/* The two required fields, together at the top. Side by side when there is room. */}
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_17rem] sm:items-start sm:gap-8">
        <Block label="Venue name">
          <BigInput aria-label="Venue name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </Block>

        <Block
          label="Front desk mobile"
          hint={
            phoneWrong && (
              <span role="alert" className="text-danger">
                Enter all 10 digits, starting with 9.
              </span>
            )
          }
        >
          {/* +63 is fixed: only PH mobile numbers. Same type size as the venue name when side by side. */}
          <label
            className={`flex items-baseline gap-2 border-b-[3px] py-2 text-xl transition-colors focus-within:border-violet sm:text-[clamp(22px,3.4vw,34px)] sm:leading-normal ${
              phoneWrong ? 'border-danger' : 'border-line-strong'
            }`}
          >
            <span className="font-semibold text-violet">+63</span>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              required
              aria-label="Front desk mobile number, the 10 digits after +63"
              aria-invalid={phoneWrong}
              placeholder="9171234567"
              value={phone}
              // No maxLength: autofill and paste bring "0917…" or "+63 917…", which phMobileInput trims.
              onChange={(e) => setPhone(phMobileInput(e.target.value))}
              onBlur={() => setPhoneTouched(true)}
              className="w-full min-w-0 bg-transparent tracking-wide text-fg placeholder:text-fg-3 focus:outline-none"
            />
          </label>
        </Block>
      </div>

      <Block label="Description (optional)">
        {/* Phones: one swipeable row of chips instead of four wrapped rows. */}
        <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {PERKS.map((p) => (
            <StageButton
              key={p}
              kind={has(p) ? 'chipOn' : 'chip'}
              onClick={() => toggle(p)}
              aria-pressed={has(p)}
              className="shrink-0 whitespace-nowrap"
            >
              {has(p) ? '✓ ' : '+ '}
              {p}
            </StageButton>
          ))}
        </div>
        <StageTextArea
          aria-label="Description"
          rows={2}
          maxLength={600}
          placeholder="Tap the chips, or write your own."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Block>

      <SceneFooter onNext={save} busy={busy} disabled={!ready} error={error} status={saveLabel(auto.state)} />
    </Scene>
  );
}
