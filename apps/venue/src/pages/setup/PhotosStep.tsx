import { type ChangeEvent, useId, useState } from 'react';
import { Button, SaveNote } from '../../components/ui';
import { photoUrl, removeVenuePhoto, uploadVenuePhoto } from '../../lib/photos';
import { supabase } from '../../lib/supabase';
import { StepFrame, type StepProps } from './StepFrame';

const MAX_GALLERY = 8;

export function PhotosStep({ setup, refresh, next }: StepProps) {
  const v = setup.venue;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(what: string, job: () => Promise<void>) {
    setBusy(what);
    setError(null);
    try {
      await job();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed. Try again.');
    } finally {
      setBusy(null);
    }
  }

  const replace = (field: 'logo_path' | 'cover_path', kind: 'logo' | 'cover') => (file: File) =>
    run(kind, async () => {
      const old = v[field];
      const path = await uploadVenuePhoto(v.id, kind, file);
      const { error } = await supabase
        .from('venues')
        .update(field === 'logo_path' ? { logo_path: path } : { cover_path: path })
        .eq('id', v.id);
      if (error) throw error;
      await removeVenuePhoto(old);
    });

  const clear = (field: 'logo_path' | 'cover_path') =>
    run(field, async () => {
      const old = v[field];
      const { error } = await supabase
        .from('venues')
        .update(field === 'logo_path' ? { logo_path: null } : { cover_path: null })
        .eq('id', v.id);
      if (error) throw error;
      await removeVenuePhoto(old);
    });

  const addToGallery = (files: File[]) =>
    run('gallery', async () => {
      const room = MAX_GALLERY - v.photo_paths.length;
      const paths: string[] = [];
      for (const f of files.slice(0, room)) paths.push(await uploadVenuePhoto(v.id, 'gallery', f));
      const { error } = await supabase
        .from('venues')
        .update({ photo_paths: [...v.photo_paths, ...paths] })
        .eq('id', v.id);
      if (error) throw error;
    });

  const removeFromGallery = (path: string) =>
    run('gallery', async () => {
      const { error } = await supabase
        .from('venues')
        .update({ photo_paths: v.photo_paths.filter((p) => p !== path) })
        .eq('id', v.id);
      if (error) throw error;
      await removeVenuePhoto(path);
    });

  return (
    <StepFrame
      title="Logo and photos"
      intro="Optional, but venues with a cover photo get chosen more. Big phone photos are fine: they're resized before upload."
    >
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <Slot
          title="Logo"
          hint="Square works best."
          url={photoUrl(v.logo_path)}
          shape="square"
          busy={busy === 'logo' || busy === 'logo_path'}
          onPick={replace('logo_path', 'logo')}
          onRemove={v.logo_path ? () => clear('logo_path') : undefined}
        />
        <Slot
          title="Cover photo"
          hint="Wide shot of your courts. It's the big picture on your venue page."
          url={photoUrl(v.cover_path)}
          shape="wide"
          busy={busy === 'cover' || busy === 'cover_path'}
          onPick={replace('cover_path', 'cover')}
          onRemove={v.cover_path ? () => clear('cover_path') : undefined}
        />
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="font-semibold text-ink-900">More photos</h3>
          <p className="text-sm text-ink-500">
            Up to {MAX_GALLERY}: courts, lockers, the entrance, the parking. {v.photo_paths.length} of {MAX_GALLERY} used.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {v.photo_paths.map((p) => (
            <figure key={p} className="group relative aspect-[4/3] overflow-hidden rounded-lg border-2 border-ink-200 bg-ink-100">
              <img src={photoUrl(p) ?? ''} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeFromGallery(p)}
                disabled={busy !== null}
                className="absolute right-1 top-1 rounded-md bg-white/90 px-2 py-0.5 text-xs font-semibold text-[#b51f2a]"
              >
                Remove
              </button>
            </figure>
          ))}
          {v.photo_paths.length < MAX_GALLERY && (
            <FilePick multiple disabled={busy !== null} onFiles={addToGallery} className="aspect-[4/3]">
              {busy === 'gallery' ? 'Uploading…' : '+ Add photos'}
            </FilePick>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={next} disabled={busy !== null}>
          Continue
        </Button>
        <SaveNote error={error} saved={false} />
      </div>
    </StepFrame>
  );
}

function Slot(props: {
  title: string;
  hint: string;
  url: string | null;
  shape: 'square' | 'wide';
  busy: boolean;
  onPick: (f: File) => void;
  onRemove?: () => void;
}) {
  const frame = props.shape === 'square' ? 'aspect-square w-40' : 'aspect-[3/1] w-full';
  return (
    <div className="space-y-2">
      <div>
        <h3 className="font-semibold text-ink-900">{props.title}</h3>
        <p className="text-sm text-ink-500">{props.hint}</p>
      </div>
      {props.url ? (
        <img src={props.url} alt="" className={`${frame} rounded-lg border-2 border-ink-200 object-cover`} />
      ) : (
        <FilePick disabled={props.busy} onFiles={(f) => f[0] && props.onPick(f[0])} className={frame}>
          {props.busy ? 'Uploading…' : `+ Add ${props.title.toLowerCase()}`}
        </FilePick>
      )}
      {props.url && (
        <div className="flex gap-2">
          <FilePick disabled={props.busy} onFiles={(f) => f[0] && props.onPick(f[0])} className="px-3 py-1.5 text-sm" plain>
            {props.busy ? 'Uploading…' : 'Replace'}
          </FilePick>
          {props.onRemove && (
            <Button variant="danger" onClick={props.onRemove} disabled={props.busy}>
              Remove
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** A label styled as a drop zone or button, wrapping a hidden file input. */
function FilePick(props: {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  plain?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    props.onFiles([...(e.target.files ?? [])]);
    e.target.value = '';
  };
  const look = props.plain
    ? 'rounded-lg border-2 border-ink-900 font-semibold text-ink-900 hover:bg-ink-50'
    : 'grid place-items-center rounded-lg border-2 border-dashed border-ink-300 bg-white text-sm font-semibold text-ink-600 hover:border-ink-900 hover:text-ink-900';
  return (
    <label
      htmlFor={id}
      className={`cursor-pointer ${look} ${props.disabled ? 'pointer-events-none opacity-50' : ''} ${props.className ?? ''}`}
    >
      {props.children}
      <input id={id} type="file" accept="image/*" multiple={props.multiple} className="sr-only" onChange={pick} />
    </label>
  );
}
