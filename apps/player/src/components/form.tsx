import type { ReactNode } from 'react';
import { Pressable, Text, TextInput, type TextInputProps, View } from 'react-native';

/**
 * Form pieces for the player app, in the verzus theme. Colours follow the rules in AGENTS.md:
 * green for go (the main button, a chosen chip), red only for what's wrong.
 */

/** A label, the control, and a line under it: what's wrong (red), or a hint. */
export function Field(props: { label: string; children: ReactNode; problem?: string | null; hint?: string; className?: string }) {
  return (
    <View className={`gap-1.5 ${props.className ?? ''}`}>
      <Text className="text-sm font-semibold text-fg-2">{props.label}</Text>
      {props.children}
      {props.problem ? (
        <Text className="text-xs font-semibold text-danger">{props.problem}</Text>
      ) : props.hint ? (
        <Text className="text-xs text-fg-3">{props.hint}</Text>
      ) : null}
    </View>
  );
}

export function TextField({ invalid, className, ...props }: TextInputProps & { invalid?: boolean }) {
  return (
    <TextInput
      className={`rounded-control border-2 bg-surface px-3.5 py-3 text-base text-fg placeholder:text-fg-3 ${invalid ? 'border-danger' : 'border-line-strong focus:border-violet'} ${className ?? ''}`}
      {...props}
    />
  );
}

export function PrimaryButton(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busyLabel?: string;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled || props.busy}
      onPress={props.onPress}
      className="items-center rounded-control bg-accent py-3.5 active:opacity-80 disabled:opacity-50"
    >
      <Text className="text-base font-semibold text-on-accent">
        {props.busy ? (props.busyLabel ?? 'One moment…') : props.label}
      </Text>
    </Pressable>
  );
}

export function SecondaryButton(props: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      className="items-center rounded-control border-2 border-line-strong bg-surface px-5 py-3 active:opacity-80 disabled:opacity-50"
    >
      <Text className="text-base font-semibold text-fg">{props.label}</Text>
    </Pressable>
  );
}

/** A choice that can be on or off (a sport, a suffix). On: green, with a check. */
export function Chip(props: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: props.on }}
      onPress={props.onPress}
      className={`rounded-control border-2 px-3.5 py-2 ${props.on ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface'}`}
    >
      <Text className={`text-sm font-semibold ${props.on ? 'text-accent-soft-fg' : 'text-fg-2'}`}>
        {props.on ? `✓ ${props.label}` : props.label}
      </Text>
    </Pressable>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="alert" className="text-sm font-semibold text-danger">
      {children}
    </Text>
  );
}
