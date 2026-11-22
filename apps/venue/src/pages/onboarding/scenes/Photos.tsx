import { AnimatePresence, motion } from 'motion/react';
import { type ChangeEvent, type ReactNode, useId, useState } from 'react';
import { photoUrl, removeVenuePhoto, uploadVenuePhoto } from '../../../lib/photos';
import { supabase } from '../../../lib/supabase';
import { fullAddress } from '../../../lib/venues';
import { peso, type Setup } from '../../setup/data';
import { PhotosIcon } from '../icons';
import { Block, Scene, SceneFooter, type SceneProps } from '../stage';

const MAX_GALLERY = 8;

export function PhotosScene({ setup, refresh, next, back }: SceneProps) {
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

  const replace = (kind: 'logo' | 'cover') => (file: File) =>
    run(kind, async () => {
      const old = kind === 'logo' ? v.logo_path : v.cover_path;
      const path = await uploadVenuePhoto(v.id, kind, file);
      const { error } = await supabase
        .from('venues')
        .update(kind === 'logo' ? { logo_path: path } : { cover_path: path })
        .eq('id', v.id);
      if (error) throw error;
      await removeVenuePhoto(old);
    });

  const addToGallery = (files: File[]) =>
    run('gallery', async () => {
      const paths: string[] = [];
      for (const f of files.slice(0, MAX_GALLERY - v.photo_paths.length)) paths.push(await uploadVenuePhoto(v.id, 'gallery', f));
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
    <Scene
      wide
      eyebrow="Step 5 · Photos"
      icon={<PhotosIcon />}
      title="Show it off."
      intro="Optional, but a cover photo gets you picked more."
    >
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-8">
          <Block>
            <VenueHeader
              name={v.name}
              place={[v.city, v.province].filter(Boolean).join(', ')}
              coverUrl={photoUrl(v.cover_path)}
              logoUrl={photoUrl(v.logo_path)}
              busy={busy}
              onCover={(f) => replace('cover')(f)}
              onLogo={(f) => replace('logo')(f)}
            />
          </Block>

          <Block>
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold text-fg-2">More photos</p>
              <p className="text-sm text-fg-3">
                {v.photo_paths.length} of {MAX_GALLERY}
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              <AnimatePresence initial={false}>
                {v.photo_paths.map((p) => (
                  <motion.figure
                    key={p}
                    layout
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    className="relative aspect-square overflow-hidden rounded-control"
                  >
                    <img src={photoUrl(p) ?? ''} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeFromGallery(p)}
                      disabled={busy !== null}
                      aria-label="Remove this photo"
                      className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-xs font-bold text-white hover:bg-danger hover:text-surface"
                    >
                      ✕
                    </button>
                  </motion.figure>
                ))}
              </AnimatePresence>
              {v.photo_paths.length < MAX_GALLERY && (
                <Drop
                  multiple
                  busy={busy === 'gallery'}
                  onFiles={addToGallery}
                  className="aspect-square rounded-control"
                  empty={<span className="text-2xl leading-none">+</span>}
                  label="Add photos"
                />
              )}
            </div>
            <p className="text-sm text-fg-3">Courts, entrance, lockers, parking.</p>
          </Block>
        </div>

        {/* Wider screens: the venue page inside a phone. Phones skip it: the header above already
            shows the cover and logo as players will see them. */}
        <aside className="hidden lg:sticky lg:top-8 lg:block">
          <Block label="How players will see it">
            <PhonePreview setup={setup} />
          </Block>
        </aside>
      </div>

      <SceneFooter
        onBack={back}
        onNext={next}
        busy={busy !== null}
        nextLabel={v.cover_path ? 'Continue →' : 'Skip for now →'}
        error={error}
      />
    </Scene>
  );
}

/**
 * The top of the venue's page, as players will see it: the cover photo, the logo overlapping its
 * bottom corner, and the venue's name beside the logo. Tap the cover or the logo to add or change it.
 */
function VenueHeader(props: {
  name: string;
  place: string;
  coverUrl?: string | null;
  logoUrl?: string | null;
  busy: string | null;
  onCover: (file: File) => void;
  onLogo: (file: File) => void;
}) {
  return (
    <div>
      <Drop
        url={props.coverUrl}
        busy={props.busy === 'cover'}
        onFiles={(f) => f[0] && props.onCover(f[0])}
        className="aspect-[2/1] w-full rounded-panel sm:aspect-[3/1]"
        label={props.coverUrl ? 'Change the cover photo' : 'Add a cover photo'}
        badge="Change cover"
        empty={
          <span className="block">
            <span className="block text-base text-fg">+ Cover photo</span>
            <span className="mt-1 block text-sm font-normal text-fg-3">A wide shot of your courts</span>
          </span>
        }
      />
      <div className="flex items-end gap-3 px-3">
        {/* The logo overlaps the cover's bottom edge, with a ring in the page colour. */}
        <div className="-mt-10 h-20 w-20 shrink-0 rounded-panel bg-canvas p-1">
          <Drop
            url={props.logoUrl}
            busy={props.busy === 'logo'}
            onFiles={(f) => f[0] && props.onLogo(f[0])}
            className="h-full w-full rounded-control bg-surface-2"
            label={props.logoUrl ? 'Change the logo' : 'Add a logo'}
            empty={<span className="text-xs leading-tight">+ Logo</span>}
          />
        </div>
        <div className="min-w-0 pb-1">
          <p className="truncate text-lg font-bold leading-tight text-fg">{props.name}</p>
          {props.place && <p className="truncate text-sm text-fg-3">{props.place}</p>}
        </div>
      </div>
    </div>
  );
}

/** A drop zone that shows the photo once there is one; click or drop to replace. */
function Drop(props: {
  url?: string | null;
  busy: boolean;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  className?: string;
  empty: ReactNode;
  /** What tapping it does, for screen readers, e.g. "Add a logo". */
  label: string;
  /** Shown in a corner once there is a photo, e.g. "Change cover". */
  badge?: string;
}) {
  const id = useId();
  const [over, setOver] = useState(false);
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    props.onFiles([...(e.target.files ?? [])]);
    e.target.value = '';
  };
  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        props.onFiles([...e.dataTransfer.files].filter((f) => f.type.startsWith('image/')));
      }}
      className={`relative grid cursor-pointer place-items-center overflow-hidden border-2 text-sm font-semibold transition ${
        over
          ? 'border-dashed border-accent bg-accent-soft text-fg'
          : props.url
            ? 'border-transparent'
            : 'border-dashed border-line-strong text-fg-2 hover:border-violet'
      } ${props.busy ? 'pointer-events-none' : ''} ${props.className ?? ''}`}
    >
      <AnimatePresence mode="wait">
        {props.url ? (
          <motion.img
            key={props.url}
            src={props.url}
            alt=""
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <motion.span key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-3 text-center">
            {props.empty}
          </motion.span>
        )}
      </AnimatePresence>
      {props.url && props.badge && !props.busy && (
        <span className="absolute right-2 top-2 rounded-chip bg-black/60 px-3 py-1 text-xs font-semibold text-white">
          {props.badge}
        </span>
      )}
      {props.busy && (
        <span className="absolute inset-0 grid place-items-center bg-canvas/70">
          <motion.span
            className="h-8 w-8 rounded-full border-[3px] border-line-strong border-t-accent"
            animate={{ rotate: 360 }}
            transition={{ repeat: Number.POSITIVE_INFINITY, duration: 0.8, ease: 'linear' }}
          />
        </span>
      )}
      <input
        id={id}
        type="file"
        accept="image/*"
        multiple={props.multiple}
        aria-label={props.label}
        className="sr-only"
        onChange={pick}
      />
    </label>
  );
}

/** The venue page as a player sees it in the app, updating as photos land. */
function PhonePreview({ setup }: { setup: Setup }) {
  const v = setup.venue;
  const active = setup.courts.filter((c) => c.is_active);
  const cheapest = active.length ? Math.min(...active.map((c) => c.hourly_rate_cents)) : null;
  const cover = photoUrl(v.cover_path);
  const logo = photoUrl(v.logo_path);
  return (
    <div className="mx-auto w-full max-w-[340px] rounded-[2.4rem] border-[6px] border-[#16142f] bg-canvas p-2.5 shadow-[0_30px_60px_-20px_rgb(var(--scrim)/0.5)]">
      <div className="overflow-hidden rounded-[1.8rem] bg-surface">
        <div className="relative aspect-[16/10] bg-surface-2">
          {cover ? (
            <motion.img
              key={cover}
              src={cover}
              alt=""
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="grid h-full place-items-center text-sm text-fg-3">Cover photo</span>
          )}
          <div className="absolute -bottom-7 left-4 h-14 w-14 overflow-hidden rounded-control border-[3px] border-surface bg-surface-3 shadow">
            {logo && (
              <motion.img
                key={logo}
                src={logo}
                alt=""
                initial={{ scale: 0.6 }}
                animate={{ scale: 1 }}
                className="h-full w-full object-cover"
              />
            )}
          </div>
        </div>
        <div className="space-y-1.5 px-4 pb-5 pt-10 text-fg">
          <p className="text-lg font-bold leading-tight">{v.name}</p>
          <p className="text-sm text-fg-3">{fullAddress(v)}</p>
          {cheapest != null && (
            <p className="pt-1 text-sm font-semibold">
              {active.length} court{active.length > 1 ? 's' : ''} · from {peso(cheapest)}/hour
            </p>
          )}
          <span className="mt-3 block rounded-control bg-accent py-2.5 text-center text-sm font-bold text-on-accent">
            Book a court
          </span>
        </div>
      </div>
    </div>
  );
}
