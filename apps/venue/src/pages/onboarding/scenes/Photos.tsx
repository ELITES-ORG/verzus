import { AnimatePresence, motion } from 'motion/react';
import { type ChangeEvent, type ReactNode, useId, useState } from 'react';
import { photoUrl, removeVenuePhoto, uploadVenuePhoto } from '../../../lib/photos';
import { supabase } from '../../../lib/supabase';
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
      intro="Optional, but venues with a cover photo get picked more. Phone photos are fine: they're resized before upload."
    >
      <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
        <div className="space-y-8">
          <Block label="Cover photo" hint="A wide shot of your courts. It's the big picture on your venue page.">
            <Drop
              url={photoUrl(v.cover_path)}
              busy={busy === 'cover'}
              onFiles={(f) => f[0] && replace('cover')(f[0])}
              className="aspect-[3/1] w-full"
              empty="Drop a cover photo, or click to choose"
            />
          </Block>
          <Block label="Logo" hint="Square works best.">
            <Drop
              url={photoUrl(v.logo_path)}
              busy={busy === 'logo'}
              onFiles={(f) => f[0] && replace('logo')(f[0])}
              className="aspect-square w-36"
              empty="Add logo"
            />
          </Block>
          <Block
            label={`More photos (${v.photo_paths.length} of ${MAX_GALLERY})`}
            hint="Courts, lockers, the entrance, the parking."
          >
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              <AnimatePresence initial={false}>
                {v.photo_paths.map((p) => (
                  <motion.figure
                    key={p}
                    layout
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    className="group relative aspect-[4/3] overflow-hidden rounded-2xl"
                  >
                    <img src={photoUrl(p) ?? ''} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeFromGallery(p)}
                      disabled={busy !== null}
                      className="absolute right-1.5 top-1.5 rounded-full bg-[#16133d]/80 px-2.5 py-1 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                    >
                      Remove
                    </button>
                  </motion.figure>
                ))}
              </AnimatePresence>
              {v.photo_paths.length < MAX_GALLERY && (
                <Drop multiple busy={busy === 'gallery'} onFiles={addToGallery} className="aspect-[4/3]" empty="+ Add" />
              )}
            </div>
          </Block>
        </div>

        <Block label="How players will see it">
          <PhonePreview setup={setup} />
        </Block>
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

/** A drop zone that shows the photo once there is one; click or drop to replace. */
function Drop(props: {
  url?: string | null;
  busy: boolean;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  className?: string;
  empty: ReactNode;
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
      className={`relative grid cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed text-sm font-semibold transition ${
        over ? 'border-[#dd2b37] bg-[#dd2b37]/10 text-white' : 'border-[#b8b3ff]/35 text-[#d9d6ff] hover:border-[#b8b3ff]'
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
      {props.busy && (
        <span className="absolute inset-0 grid place-items-center bg-[#16133d]/70">
          <motion.span
            className="h-8 w-8 rounded-full border-[3px] border-[#b8b3ff]/30 border-t-[#dd2b37]"
            animate={{ rotate: 360 }}
            transition={{ repeat: Number.POSITIVE_INFINITY, duration: 0.8, ease: 'linear' }}
          />
        </span>
      )}
      <input id={id} type="file" accept="image/*" multiple={props.multiple} className="sr-only" onChange={pick} />
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
    <div className="mx-auto w-[260px] rounded-[2.2rem] border-[6px] border-[#2b2768] bg-[#f6f5fb] p-2 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)]">
      <div className="overflow-hidden rounded-[1.6rem] bg-white">
        <div className="relative aspect-[16/10] bg-[#e8e6f5]">
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
            <span className="grid h-full place-items-center text-xs text-[#8580b0]">Cover photo</span>
          )}
          <div className="absolute -bottom-6 left-3 h-12 w-12 overflow-hidden rounded-xl border-[3px] border-white bg-[#dcd9ff] shadow">
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
        <div className="space-y-1 px-3 pb-4 pt-8 text-[#1d1a4a]">
          <p className="font-bold leading-tight">{v.name}</p>
          <p className="text-xs text-[#6f6a9c]">{[v.address, v.city].filter(Boolean).join(', ')}</p>
          {cheapest != null && (
            <p className="pt-1 text-xs font-semibold">
              {active.length} court{active.length > 1 ? 's' : ''} · from {peso(cheapest)}/hour
            </p>
          )}
          <span className="mt-2 block rounded-full bg-[#dd2b37] py-1.5 text-center text-xs font-bold text-white">
            Book a court
          </span>
        </div>
      </div>
    </div>
  );
}
