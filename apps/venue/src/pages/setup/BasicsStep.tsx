import { type FormEvent, useState } from 'react';
import { Button, Field, SaveNote, TextArea, TextInput } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { StepFrame, type StepProps } from './StepFrame';

export function BasicsStep({ setup, refresh, next }: StepProps) {
  const v = setup.venue;
  const [name, setName] = useState(v.name);
  const [description, setDescription] = useState(v.description ?? '');
  const [phone, setPhone] = useState(v.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
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
    <StepFrame title="Basics" intro="What players see first. You can change any of this later.">
      <form onSubmit={save} className="max-w-xl space-y-5">
        <Field label="Venue name">
          <TextInput required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field
          label="Description"
          hint="A line or two: what kind of courts, indoor or outdoor, anything players should know (parking, showers, aircon)."
        >
          <TextArea maxLength={600} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Contact number" hint="Shown to players who book, in case they need to reach the front desk.">
          <TextInput
            type="tel"
            autoComplete="tel"
            placeholder="0917 123 4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={busy || name.trim().length < 2}>
            {busy ? 'Saving…' : 'Save and continue'}
          </Button>
          <SaveNote error={error} saved={false} />
        </div>
      </form>
    </StepFrame>
  );
}
